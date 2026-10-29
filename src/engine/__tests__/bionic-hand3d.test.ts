import {describe,it,expect} from 'vitest'
import {sphereTriangleContact,sphereMotion} from '../hand-object-contact'
import {SphereFinger3D} from '../sphere-finger3d'
import {ContinuousGripper3D,defaultContinuousGripper3DParams} from '../continuous-gripper3d'
import {BionicHand3D,FINGERS,interFingerMotion,localPoint,worldPoint} from '../bionic-hand3d'
import type {Mesh3D,Vec3} from '../gripper3d'

describe('fixed sphere contact geometry',()=>{
  const sphere={center:[.3,.3,1] as Vec3,radius:1.2,stiffnessPerArea:100}
  const tri:[Vec3,Vec3,Vec3]=[[0,0,0],[1,0,0],[0,1,0]]
  it('matches the energy gradient for face and edge closest points',()=>{
    for(const center of [[.3,.3,1],[.7,.7,1]] as Vec3[]){
      const shape={...sphere,center},hit=sphereTriangleContact(shape,tri,200,0),eps=1e-6
      expect(hit.lambda).toBeGreaterThan(0)
      for(let i=0;i<3;i++)for(let d=0;d<3;d++){
        const a=tri.map(v=>[...v]) as [Vec3,Vec3,Vec3],b=tri.map(v=>[...v]) as [Vec3,Vec3,Vec3]
        a[i][d]+=eps;b[i][d]-=eps
        const numerical=(sphereTriangleContact(shape,a,200,0).energy-sphereTriangleContact(shape,b,200,0).energy)/(2*eps)
        expect(numerical).toBeCloseTo(-hit.lambda*hit.bary[i]*hit.normal[d],5)
      }
      expect(hit.bary.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12)
    }
  })
  it('detects a crossing even when both endpoint triangles are separated',()=>{
    const s={center:[0,0,0] as Vec3,radius:.25,stiffnessPerArea:1}
    const from:[Vec3,Vec3,Vec3]=[[-1,-1,.5],[1,-1,.5],[0,1,.5]],to=from.map(p=>[p[0],p[1],-.5]) as [Vec3,Vec3,Vec3]
    const face=[{nodes:[0,1,2] as [number,number,number]}]
    expect(sphereMotion(s,face,from,to,0).safe).toBe(false)
    expect(sphereMotion(s,face,from,from,0).safe).toBe(true)
    expect(sphereMotion(s,face,from,to,NaN).safe).toBe(false)
  })
})

describe('five-finger experimental assembly',()=>{
  it('uses rigid, invertible adult-size coordinate transformations',()=>{
    for(const spec of FINGERS){
      const p:[number,number,number]=[.034,.008,.005]
      expect(localPoint(spec,worldPoint(spec,p))).toEqual(expect.arrayContaining(p.map(v=>expect.closeTo(v,12))))
      expect(.08*spec.scale).toBeGreaterThan(.06)
      expect(.08*spec.scale).toBeLessThanOrEqual(.08)
    }
  })
  it('rejects crossing triangular finger surfaces between separated endpoints',()=>{
    const mesh={reference:[[0,0,0],[1,0,0],[0,1,0]],surface:[{nodes:[0,1,2]}]} as unknown as Mesh3D
    const tri=(z:number):Vec3[]=>[[-1,-1,z],[1,-1,z],[0,1,z]]
    expect(interFingerMotion(mesh,[tri(-1),tri(1)],[tri(1),tri(-1)]).safe).toBe(false)
    expect(interFingerMotion(mesh,[tri(-1),tri(1)],[tri(-.5),tri(.5)]).safe).toBe(true)
  })
  it('agrees with the existing finger in the absence of an object',()=>{
    const p={...defaultContinuousGripper3DParams,pull:.00025}
    const base=new ContinuousGripper3D(p),extension=new SphereFinger3D(p)
    const a=base.step(.00025),b=extension.step(.00025)
    expect(a.converged&&b.converged).toBe(true)
    expect(b.tipAngleDeg).toBeCloseTo(a.tipAngleDeg,10)
    expect(b.tension).toBeCloseTo(a.tension,10)
    expect(b.checkPenetration).toBeCloseTo(a.checkPenetration,12)
  },60000)
  it('solves a loaded finger against the sphere with reaction and small penetration',()=>{
    const sphere={center:[.055,.025,.004] as Vec3,radius:.01,stiffnessPerArea:2e8}
    const f=new SphereFinger3D({...defaultContinuousGripper3DParams,pull:.001},sphere)
    for(let i=1;i<=4;i++)expect(f.step(i*.00025).converged).toBe(true)
    expect(f.last.sphereContacts.length).toBeGreaterThan(0)
    expect(Math.hypot(...f.last.sphereForce)).toBeGreaterThan(.0001)
    expect(f.last.spherePenetration).toBeLessThanOrEqual(f.contactTolerance)
    expect(f.last.sphereComplementarity).toBeLessThanOrEqual(f.contactTolerance)
    expect(f.last.forceBalance).toBeLessThan(2e-5)
    expect(f.last.torqueBalance).toBeLessThan(2e-6)
  },90000)
  it('subdivides indeterminate group motion and atomically rolls back a failed second half',()=>{
    const exercise=(failSecond:boolean)=>{
      const hand=new BionicHand3D(),base=hand.last,first=hand.fingers[0],q0=Array.from(first.q),lambda0=Array.from(first.sphereLambda),wall0=Array.from(first.lambda)
      ;(hand as any).singleGroupStep=(targets:number[])=>{
        const target=targets[0]/FINGERS[0].scale,increment=target-first.pull
        if(increment>.0001250001||(failSecond&&target>.00019))return {...hand.last,converged:false,message:'indeterminate CCD'}
        first.pull=target;first.q[0]+=1;first.sphereLambda[0]+=1;first.lambda[0]+=1
        const j=target<.0002?.8:.9,local={...hand.last.fingers[0].local,pull:target,minPathJ:j,substeps:1,iterations:1,linearIterations:1,collisionChecks:1}
        const fingers=hand.last.fingers.map((f,i)=>i===0?{...f,local}:f)
        hand.last={...hand.last,fingers,converged:true,interFingerChecks:5,minPathJ:j};return hand.last
      }
      const result=hand.step([.00025*FINGERS[0].scale,0,0,0,0])
      if(failSecond){
        expect(result.converged).toBe(false);expect(hand.last).toBe(base);expect(first.pull).toBe(0)
        expect(Array.from(first.q)).toEqual(q0);expect(Array.from(first.sphereLambda)).toEqual(lambda0);expect(Array.from(first.lambda)).toEqual(wall0)
      }else{
        expect(result.converged).toBe(true);expect(result.groupSubsteps).toBe(2);expect(result.interFingerChecks).toBe(10)
        expect(result.minPathJ).toBe(.8);expect(result.fingers[0].local.minPathJ).toBe(.8);expect(result.fingers[0].local.substeps).toBe(2)
      }
    }
    exercise(false);exercise(true)
  },60000)
  it('changes just the selected actuator and rolls back invalid group steps',()=>{
    const hand=new BionicHand3D(),before=hand.last.fingers.map(f=>f.tip)
    const result=hand.step([0,0,.00025,0,0])
    expect(result.converged).toBe(true)
    expect(result.fingers[2].local.pull).toBeCloseTo(.00025,12)
    for(const i of [0,1,3,4])expect(result.fingers[i].tip).toEqual(before[i])
    const q=hand.fingers.map(f=>Array.from(f.q)),l=hand.fingers.map(f=>Array.from(f.sphereLambda))
    // The thumb is advanced first; the index then rejects its oversized step.
    // This exercises group rollback after a previously accepted finger solve.
    expect((hand as any).singleGroupStep([.00025*FINGERS[0].scale,.001,.00025,0,0]).converged).toBe(false)
    expect(hand.fingers.map(f=>Array.from(f.q))).toEqual(q)
    expect(hand.fingers.map(f=>Array.from(f.sphereLambda))).toEqual(l)
  },90000)
})
