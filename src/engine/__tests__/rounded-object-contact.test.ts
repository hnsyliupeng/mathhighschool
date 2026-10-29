import {describe,it,expect} from 'vitest'
import type {Vec3} from '../gripper3d'
import {sphereTriangleContact} from '../hand-object-contact'
import {roundedCoreTriangleClosest,roundedTriangleContact,roundedObjectMotion,validateRoundedObject,type RoundedPrimitive} from '../rounded-object-contact'
import {OBJECT_PRESETS,createGraspObject} from '../object-presets3d'
import {ObjectFinger3D} from '../object-finger3d'
import {SphereFinger3D} from '../sphere-finger3d'
import {defaultContinuousGripper3DParams} from '../continuous-gripper3d'
import {FINGERS} from '../bionic-hand3d'
import {ObjectHand3D,toFingerObject} from '../object-hand3d'

type Tri=[Vec3,Vec3,Vec3]
const tri:Tri=[[0,0,0],[1,0,0],[0,1,0]]
const face=[{nodes:[0,1,2] as [number,number,number]}]

describe('fixed rounded cores',()=>{
  it('reduces a zero-length capsule exactly to the existing sphere contact',()=>{
    for(const center of [[.3,.3,1],[.7,.7,1]] as Vec3[]){
      const sphere={center,radius:1.2,stiffnessPerArea:100},p:RoundedPrimitive={kind:'segment',a:center,b:center,radius:sphere.radius}
      const a=sphereTriangleContact(sphere,tri,200,.5),b=roundedTriangleContact(p,tri,200,.5)
      expect(b.gap).toBeCloseTo(a.gap,14);expect(b.lambda).toBeCloseTo(a.lambda,11)
      expect(b.energy).toBeCloseTo(a.energy,11)
      for(let i=0;i<3;i++){expect(b.bary[i]).toBeCloseTo(a.bary[i],14);expect(b.normal[i]).toBeCloseTo(a.normal[i],14)}
    }
  })
  it('matches finite-difference energy derivatives for capsule and rectangular cores',()=>{
    const shapes:RoundedPrimitive[]=[
      {kind:'segment',a:[.3,.3,1],b:[.5,.5,1.5],radius:1.2},
      {kind:'segment',a:[.75,.75,1],b:[.8,.8,1.4],radius:1.3},
      {kind:'rectangle',corners:[[.25,.25,1],[.45,.25,1.1],[.43,.45,1.14],[.23,.45,1.04]],radius:1.2},
      {kind:'rectangle',corners:[[.8,.8,1],[1,.8,1.1],[.98,1,1.14],[.78,1,1.04]],radius:1.3},
    ]
    for(const p of shapes){
      validateRoundedObject({primitives:[p],stiffnessPerArea:1})
      const hit=roundedTriangleContact(p,tri,200,0),eps=1e-6
      expect(hit.lambda).toBeGreaterThan(0)
      for(let i=0;i<3;i++)for(let d=0;d<3;d++){
        const a=tri.map(v=>[...v]) as Tri,b=tri.map(v=>[...v]) as Tri;a[i][d]+=eps;b[i][d]-=eps
        const numerical=(roundedTriangleContact(p,a,200,0).energy-roundedTriangleContact(p,b,200,0).energy)/(2*eps)
        expect(numerical).toBeCloseTo(-hit.lambda*hit.bary[i]*hit.normal[d],4)
      }
      expect(hit.bary.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12)
    }
  })
  it('finds core/triangle crossings, including the rectangle interior',()=>{
    const p:RoundedPrimitive={kind:'rectangle',corners:[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]],radius:.1}
    const crossing:Tri=[[0,0,-1],[0,0,1],[0,.2,1]]
    expect(roundedCoreTriangleClosest(p,crossing).distance).toBeLessThan(1e-12)
    expect(()=>roundedTriangleContact(p,crossing,1,0)).toThrow()
  })
  it('rejects swept crossings and indeterminate/invalid input for each shape',()=>{
    const shapes:RoundedPrimitive[]=[
      {kind:'segment',a:[-.5,0,0],b:[.5,0,0],radius:.25},
      {kind:'rectangle',corners:[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]],radius:.25},
    ]
    const from:Tri=[[-1,-1,.5],[1,-1,.5],[0,1,.5]],to=from.map(p=>[p[0],p[1],-.5]) as Tri
    for(const p of shapes){
      const obj={primitives:[p],stiffnessPerArea:1}
      expect(roundedObjectMotion(obj,face,from,to,0).safe).toBe(false)
      expect(roundedObjectMotion(obj,face,from,from,0).safe).toBe(true)
      expect(roundedObjectMotion(obj,face,from,to,NaN).safe).toBe(false)
      expect(roundedObjectMotion(obj,face,from,to,.26).safe).toBe(false)
    }
    const union={primitives:[{kind:'segment',a:[3,0,0],b:[3,0,0],radius:.2} as RoundedPrimitive,shapes[0]],stiffnessPerArea:1}
    expect(roundedObjectMotion(union,face,from,to,0).safe).toBe(false)
  })
  it('rejects non-finite, non-rectangular and collapsed geometry',()=>{
    expect(()=>validateRoundedObject({primitives:[],stiffnessPerArea:1})).toThrow()
    expect(()=>validateRoundedObject({primitives:[{kind:'segment',a:[0,0,0],b:[NaN,0,0],radius:.1}],stiffnessPerArea:1})).toThrow()
    expect(()=>validateRoundedObject({primitives:[{kind:'rectangle',corners:[[0,0,0],[1,0,0],[1,1,1],[0,1,0]],radius:.1}],stiffnessPerArea:1})).toThrow()
    expect(()=>roundedCoreTriangleClosest({kind:'segment',a:[0,0,1],b:[0,0,1],radius:.1},[[0,0,0],[0,0,0],[0,0,0]])).toThrow()
  })
  it('keeps the support height and similarity transformations for all presets',()=>{
    for(const preset of OBJECT_PRESETS)for(const size of [.75,1,1.25]){
      const object=createGraspObject(preset.id,size);validateRoundedObject(object)
      const bottom=Math.min(...object.primitives.map(p=>Math.min(...(p.kind==='segment'?[p.a,p.b]:p.corners).map(v=>v[2]))-p.radius))
      expect(bottom).toBeCloseTo(.018,12)
      for(const f of FINGERS){const local=toFingerObject(f,object);expect(local.primitives[0].radius*f.scale).toBeCloseTo(object.primitives[0].radius,12);validateRoundedObject(local)}
    }
    expect(()=>createGraspObject('ball90',NaN)).toThrow()
    expect(()=>createGraspObject('ball90',1.26)).toThrow()
  })
})

describe('five-finger multi-object solver',()=>{
  it('matches the sphere solver on a loaded finger, including reactions',()=>{
    const sphere={center:[.055,.025,.004] as Vec3,radius:.01,stiffnessPerArea:2e8}
    const old=new SphereFinger3D({...defaultContinuousGripper3DParams,pull:.001},sphere)
    const next=new ObjectFinger3D({...defaultContinuousGripper3DParams,pull:.001},{primitives:[{kind:'segment',a:sphere.center,b:sphere.center,radius:sphere.radius}],stiffnessPerArea:sphere.stiffnessPerArea})
    for(let i=1;i<=4;i++){
      const a=old.step(i*.00025),b=next.step(i*.00025)
      expect(a.converged&&b.converged).toBe(true)
      expect(b.tipAngleDeg).toBeCloseTo(a.tipAngleDeg,8);expect(b.tension).toBeCloseTo(a.tension,10)
      expect(b.objectContacts.length).toBe(a.sphereContacts.length)
      for(let d=0;d<3;d++)expect(b.objectForce[d]).toBeCloseTo(a.sphereForce[d],9)
    }
    expect(next.last.objectContacts.length).toBeGreaterThan(0)
  },120000)
  it('rejects an object core enclosed by a finger, even without boundary crossing',()=>{
    expect(()=>new ObjectFinger3D(defaultContinuousGripper3DParams,{primitives:[{kind:'segment',a:[.04,.012,.004],b:[.04,.012,.004],radius:.00002}],stiffnessPerArea:1e8})).toThrow()
  },30000)
  it('rolls back all coordinates and both multiplier sets on a failed group step',()=>{
    const hand=new ObjectHand3D(createGraspObject('dumbbell')),q=hand.fingers.map(f=>Array.from(f.q)),wall=hand.fingers.map(f=>Array.from(f.lambda)),object=hand.fingers.map(f=>Array.from(f.objectLambda))
    const r=(hand as any).singleGroupStep([.00025*FINGERS[0].scale,.001,0,0,0])
    expect(r.converged).toBe(false);expect(hand.fingers.map(f=>Array.from(f.q))).toEqual(q)
    expect(hand.fingers.map(f=>Array.from(f.lambda))).toEqual(wall);expect(hand.fingers.map(f=>Array.from(f.objectLambda))).toEqual(object)
  },90000)
})
