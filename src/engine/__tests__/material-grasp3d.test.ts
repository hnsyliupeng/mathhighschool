import {describe,it,expect} from 'vitest'
import {MaterialGrasp3D,applyTriangleMultiplier,defaultMaterialGraspParams,effectiveBite,frictionImpulse,makeMaterialObject,projectCoulombTangent,xpbdDistanceDelta} from '../material-grasp3d'
import type {Vec3} from '../gripper3d'

describe('dynamic material grasp mechanics',()=>{
  it('satisfies the one-link XPBD residual and gives less deformation at greater stiffness',()=>{
    const length=1.1,rest=1,w=2,dt=.1
    const soft=xpbdDistanceDelta(length,rest,w,0,10,dt),stiff=xpbdDistanceDelta(length,rest,w,0,100,dt)
    expect(Math.abs(length-rest+w*stiff)).toBeLessThan(Math.abs(length-rest+w*soft))
    for(const [k,dl] of [[10,soft],[100,stiff]])expect((length-rest+w*dl)+dl/(k*dt*dt)).toBeCloseTo(0,14)
    expect(()=>xpbdDistanceDelta(1,1,1,0,NaN,.01)).toThrow()
  })
  it('projects tangent displacement into the Coulomb disk and opposes slip',()=>{
    const normal:Vec3=[1,0,0],relative:Vec3=[.02,.04,0]
    const limited=projectCoulombTangent(relative,normal,[0,0,0],2,.01,.5)
    expect(limited[0]).toBeCloseTo(0,14);expect(limited[1]).toBeLessThan(0)
    expect(Math.hypot(...limited)).toBeCloseTo(.005,14)
    const sticking=projectCoulombTangent(relative,normal,[0,0,0],2,1,.5)
    expect(sticking[1]).toBeCloseTo(-.02,14)
    expect(projectCoulombTangent(relative,normal,[0,0,0],2,0,.5)).toEqual([0,-0,0])
    expect(()=>projectCoulombTangent(relative,[2,0,0],[0,0,0],2,1,.5)).toThrow()
    const impulse=frictionImpulse([1,2,0],[1,0,0],2,.4,.5)
    expect(impulse[1]).toBeCloseTo(-.2,14)
  })
  it('applies exactly opposite mass-weighted reaction to pad and triangle vertices',()=>{
    const q=new Float64Array(12),weight=new Float64Array([2,4,5,10]),bary:Vec3=[.2,.3,.5],change:Vec3=[.002,-.003,.004]
    applyTriangleMultiplier(q,weight,3,[0,1,2],bary,change)
    for(let d=0;d<3;d++){
      let momentumLike=0;for(let i=0;i<4;i++)momentumLike+=q[3*i+d]/weight[i]
      expect(momentumLike).toBeCloseTo(0,14)
      for(let i=0;i<3;i++)expect(q[3*i+d]/weight[i]).toBeCloseTo(-bary[i]*change[d],14)
    }
  })
  it('changes actual coordinates, spring lengths and mass with object size',()=>{
    for(const id of ['screwdriver','egg','bottle-cap','cloth'] as const){
      const small=makeMaterialObject({...defaultMaterialGraspParams(id),scale:.7}),big=makeMaterialObject({...defaultMaterialGraspParams(id),scale:1.3})
      expect(big.positions.length).toBe(small.positions.length)
      for(const mesh of [small,big])for(let d=0;d<3;d++){const values=mesh.positions.map(p=>p[d]);expect((Math.max(...values)-Math.min(...values))*1000).toBeCloseTo(mesh.dimensionsMm[d],8)}
      for(let i=0;i<small.positions.length;i++)for(let d=0;d<3;d++)expect(big.positions[i][d]).toBeCloseTo(small.positions[i][d]*1.3/.7,12)
      expect(big.springs[0].rest/small.springs[0].rest).toBeCloseTo(1.3/.7,12)
      expect(big.mass/small.mass).toBeCloseTo((1.3/.7)**(id==='cloth'?2:3),12)
      expect(big.dimensionsMm[0]/small.dimensionsMm[0]).toBeCloseTo(1.3/.7,12)
    }
    const p=defaultMaterialGraspParams('egg')
    expect(effectiveBite({...p,scale:1.3})).toBeGreaterThan(effectiveBite({...p,scale:.7}))
    const a=makeMaterialObject(p),b=makeMaterialObject({...p,stiffnessScale:4})
    expect(b.springs[0].k/a.springs[0].k).toBe(4)
    expect(()=>makeMaterialObject({...p,scale:NaN})).toThrow()
  })
  it('uses gravity and only releases the cloth hem after its specified time',()=>{
    const egg=new MaterialGrasp3D(defaultMaterialGraspParams('egg')),z=egg.initialCentre[2]
    expect(egg.step().centre[2]).toBeLessThan(z)
    const cloth=new MaterialGrasp3D(defaultMaterialGraspParams('cloth')),clip=cloth.mesh.clipNodes[6],initial=Array.from(cloth.q.slice(3*clip,3*clip+3))
    let frame=cloth.last;while(frame.time<.69){frame=cloth.step();expect(frame.finite).toBe(true)}
    expect(frame.clipsActive).toBe(true);expect(frame.phase).toBe('holding');expect(Array.from(cloth.q.slice(3*clip,3*clip+3))).toEqual(initial)
    while(frame.time<.73){frame=cloth.step();expect(frame.finite).toBe(true)}
    expect(frame.clipsActive).toBe(false)
    expect(Math.hypot(...initial.map((v,d)=>v-cloth.q[3*clip+d]))).toBeGreaterThan(1e-5)
  },30000)
  it('reports actual triangle contacts and enforces the per-pair friction cap',()=>{
    const p=defaultMaterialGraspParams('egg'),sim=new MaterialGrasp3D(p);let frame=sim.last
    while(frame.time<.55){frame=sim.step();expect(frame.finite).toBe(true)}
    expect(frame.contacts.length).toBeGreaterThan(0)
    for(const c of frame.contacts){
      expect(c.triangle).toBeGreaterThanOrEqual(0);expect(c.triangle).toBeLessThan(sim.mesh.triangles.length)
      expect(c.bary.reduce((a,b)=>a+b,0)).toBeCloseTo(1,10)
      expect(c.tangentialForce).toBeLessThanOrEqual(p.friction*c.normalForce+1e-10)
    }
  },30000)
  it('restores state and time on a failed substep',()=>{
    const sim=new MaterialGrasp3D(defaultMaterialGraspParams('egg'))
    expect(sim.step().finite).toBe(true)
    const q=Array.from(sim.q),v=Array.from(sim.v),time=sim.time,last=sim.last
    sim.mesh.springs[0].k=NaN
    const rejected=sim.step()
    expect(rejected.finite).toBe(false);expect(rejected.message).toContain('回滚')
    expect(Array.from(sim.q)).toEqual(q);expect(Array.from(sim.v)).toEqual(v);expect(sim.time).toBe(time);expect(sim.last).toBe(last)
  })
  it('fails closed for invalid parameters',()=>{
    const p=defaultMaterialGraspParams('egg')
    expect(()=>new MaterialGrasp3D({...p,friction:NaN})).toThrow()
    expect(()=>new MaterialGrasp3D({...p,dt:0})).toThrow()
    expect(()=>new MaterialGrasp3D({...p,iterations:1})).toThrow()
  })
})
