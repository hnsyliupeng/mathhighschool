import {describe,it,expect} from 'vitest'
import dataJson from '../../data/tendon-grasp-manifold.json'
import {CompiledTendonManifold,TendonDynamicGrasp,defaultTendonDynamicParams,trianglePairClosest,type FingerManifold,type TendonDynamicFrame} from '../tendon-dynamic-grasp'
import {summarizeCompleteTendonDynamic} from '../tendon-dynamic-certification'
import {FINGERS,worldPoint} from '../bionic-hand3d'
import type {Vec3} from '../gripper3d'

const data=dataJson as unknown as FingerManifold,manifold=new CompiledTendonManifold(data)
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const mul=(a:Vec3,k:number):Vec3=>[a[0]*k,a[1]*k,a[2]*k]
const sum=(tri:[Vec3,Vec3,Vec3],b:Vec3)=>add(add(mul(tri[0],b[0]),mul(tri[1],b[1])),mul(tri[2],b[2]))

describe('reduced-coordinate tendon hand and deformable object',()=>{
  it('uses actual Q1 reference states and certified adjacent paths, not pad spheres',()=>{
    expect(data.frames.length).toBe(60);expect(data.mesh.reference.length).toBe(288);expect(data.mesh.surface.length).toBe(520)
    expect(data.frames.at(-1)!.tendon.length).toBe(24);expect(data.frames.at(-1)!.tipAngleDeg).toBeGreaterThan(90)
    expect(data.frames.every(f=>f.interpolationSafe&&f.interpolationMinPathJ>0&&f.maxPenetration<=2e-8)).toBe(true)
    expect(data.frames.at(-1)!.contactCount).toBeGreaterThan(0)
    for(let i=0;i<5;i++)for(const k of [0,20,59]){
      const f=manifold.geometry(i,data.frames[k].pull,0,0),expected=worldPoint(FINGERS[i],data.frames[k].positions[100])
      for(let d=0;d<3;d++)expect(f.positions[100][d]).toBeCloseTo(expected[d],13)
    }
    expect(()=>new CompiledTendonManifold({...data,error:'not certified'})).toThrow()
  })
  it('has an actual geometric Jacobian equal to finite differences for every finger',()=>{
    for(let f=0;f<5;f++){
      const p=.0061,h=1e-8,node=245,j=manifold.vertex(f,p,node,0).derivative,a=manifold.vertex(f,p-h,node,0).position,b=manifold.vertex(f,p+h,node,0).position
      for(let d=0;d<3;d++)expect((b[d]-a[d])/(2*h)).toBeCloseTo(j[d],7)
    }
  })
  it('computes symmetric triangle distances and barycentric closest points, including piercing',()=>{
    const a:[Vec3,Vec3,Vec3]=[[0,0,0],[1,0,0],[0,1,0]],b:[Vec3,Vec3,Vec3]=[[.2,.2,.3],[.5,.2,.3],[.2,.5,.3]],r=trianglePairClosest(a,b),s=trianglePairClosest(b,a)
    expect(r.distance).toBeCloseTo(.3,12);expect(s.distance).toBeCloseTo(r.distance,12)
    for(const x of [r.fingerBary,r.objectBary]){expect(x.reduce((v,w)=>v+w,0)).toBeCloseTo(1,12);expect(Math.min(...x)).toBeGreaterThanOrEqual(-1e-12)}
    expect(sum(a,r.fingerBary)).toEqual(r.fingerPoint);expect(sum(b,r.objectBary)).toEqual(r.objectPoint)
    const piercing:[Vec3,Vec3,Vec3]=[[.2,.2,-1],[.2,.2,1],[.8,.2,1]];expect(trianglePairClosest(a,piercing).distance).toBeCloseTo(0,12)
  })
  it('applies the exact contact virtual work to the tendon coordinate and opposite object barycentric impulses',()=>{
    const sim=new TendonDynamicGrasp(data,{...defaultTendonDynamicParams(),iterations:2,verifyCCD:false},manifold),f=1,nodes:[number,number,number]=[0,1,2],bary:Vec3=[.2,.3,.5],jac:Vec3=[.8,-.4,1.1],impulse:Vec3=[1e-6,-2e-6,3e-6],weights=new Float64Array(sim.mesh.positions.length).fill(sim.inverseObjectMass)
    sim.p[f]=.004;const p0=sim.p[f],q0=sim.q.slice(),apply=(sim as unknown as {apply:(f:number,nodes:[number,number,number],bary:Vec3,jac:Vec3,change:Vec3,w:Float64Array)=>void}).apply.bind(sim)
    apply(f,nodes,bary,jac,impulse,weights)
    const virtualWork=jac.reduce((s,v,d)=>s+v*impulse[d],0);expect((sim.p[f]-p0)/sim.inverseFingerMass[f]).toBeCloseTo(virtualWork,14)
    for(let d=0;d<3;d++){let objectImpulse=0;for(let k=0;k<3;k++)objectImpulse+=(sim.q[3*nodes[k]+d]-q0[3*nodes[k]+d])/weights[nodes[k]];expect(objectImpulse).toBeCloseTo(-impulse[d],14)}
  })
  it('changes actual object shape, mass, stiffness and initial grasp position',()=>{
    const base=defaultTendonDynamicParams('egg'),a=new TendonDynamicGrasp(data,{...base,verifyCCD:false},manifold),b=new TendonDynamicGrasp(data,{...base,scale:1.2,stiffnessScale:2,offsetX:0,verifyCCD:false},manifold)
    expect(b.mesh.mass/a.mesh.mass).toBeCloseTo(1.2**3,12);expect(b.mesh.springs[0].k/a.mesh.springs[0].k).toBeCloseTo(2,12)
    expect(b.mesh.springs[0].rest/a.mesh.springs[0].rest).toBeCloseTo(1.2,12);expect(b.initialCentre[0]-a.initialCentre[0]).toBeCloseTo(.013,12)
    for(const id of ['screwdriver','bottle-cap','cloth'] as const){const s=new TendonDynamicGrasp(data,{...defaultTendonDynamicParams(id),verifyCCD:false},manifold);expect(s.mesh.triangles.length).toBeGreaterThan(50);expect(s.fixtureNodes.length).toBeGreaterThan(0)}
  },30000)
  it('advances gravity and reports whether CCD was actually performed',()=>{
    const sim=new TendonDynamicGrasp(data,{...defaultTendonDynamicParams(),iterations:2,verifyCCD:true},manifold),initial=sim.initialCentre[2],frame=sim.step()
    expect(frame.finite).toBe(true);expect(frame.verifiedCCD).toBe(true);expect(frame.fixtureActive).toBe(true);expect(frame.centre[2]).toBeLessThan(initial);expect(frame.substeps).toBeGreaterThan(0)
  },30000)
  it('fully rolls back a failed adaptive requested step',()=>{
    const sim=new TendonDynamicGrasp(data,{...defaultTendonDynamicParams(),iterations:2,verifyCCD:false},manifold),q=Array.from(sim.q),v=Array.from(sim.v),p=Array.from(sim.p),pv=Array.from(sim.pv),last=sim.last
    sim.mesh.springs[0].k=NaN;const frame=sim.step()
    expect(frame.finite).toBe(false);expect(frame.message).toContain('回滚');expect(Array.from(sim.q)).toEqual(q);expect(Array.from(sim.v)).toEqual(v);expect(Array.from(sim.p)).toEqual(p);expect(Array.from(sim.pv)).toEqual(pv);expect(sim.time).toBe(0);expect(sim.last).toBe(last)
  },30000)
  it('requires dense, finite, fully CCD-checked history for a finite hold indicator',()=>{
    const params=defaultTendonDynamicParams(),sim=new TendonDynamicGrasp(data,{...params,iterations:2,verifyCCD:false},manifold),first=sim.last
    const fake=(i:number):TendonDynamicFrame=>({...first,time:Math.min(i*params.dt,params.duration),phase:i===516?'finished':'lifting',fixtureActive:i*params.dt<=.95,rise:.04,wristRise:.04,contactFingers:2,thumbContact:true,verifiedCCD:i>0,substeps:i>0?1:0,finite:true})
    const dense=Array.from({length:517},(_,i)=>fake(i))
    expect(summarizeCompleteTendonDynamic(dense,params).retained).toBe(true)
    expect(summarizeCompleteTendonDynamic([dense[0],dense[480],dense[516]],params).retained).toBe(false)
    expect(summarizeCompleteTendonDynamic(dense.slice(0,-1),params).retained).toBe(false)
    expect(summarizeCompleteTendonDynamic(dense,{...params,verifyCCD:false}).retained).toBe(false)
    const changed=(index:number,patch:Partial<TendonDynamicFrame>)=>dense.map((f,i)=>i===index?{...f,...patch}:f)
    expect(summarizeCompleteTendonDynamic(changed(200,{verifiedCCD:false}),params).retained).toBe(false)
    expect(summarizeCompleteTendonDynamic(changed(200,{time:NaN}),params).retained).toBe(false)
    expect(summarizeCompleteTendonDynamic(changed(200,{time:dense[199].time}),params).retained).toBe(false)
    expect(summarizeCompleteTendonDynamic(changed(200,{maxContactResidual:.001}),params).retained).toBe(false)
    expect(summarizeCompleteTendonDynamic(changed(500,{fixtureActive:true}),params).retained).toBe(false)
    expect(summarizeCompleteTendonDynamic(changed(516,{rise:.06}),params).retained).toBe(false)
  },30000)
})
