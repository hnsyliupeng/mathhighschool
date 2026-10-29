import {describe,it,expect} from 'vitest'
import {ContinuousGripper3D} from '../continuous-gripper3d'
import {defaultGripper3DParams,makeGripper3DMesh,type Mesh3D,type Vec3} from '../gripper3d'
import {Gripper3DSafety,sweptMinTetJ,sweptMinHexJ,positiveTetOverlap} from '../gripper3d-safety'
import {hexesFromStructuredTets} from '../hexahedron'

describe('3-D full-segment constrained contact and safety',()=>{
  it('catches self-intersection of non-neighbouring surface triangles',()=>{
    const m=makeGripper3DMesh(1),safety=new Gripper3DSafety(m)
    expect(safety.staticSelf(m.reference).intersections).toBe(0)
    const p:Vec3[]=[[0,0,0],[1,0,0],[0,1,0],[.2,.2,-1],[.2,.2,1],[.8,.2,0]]
    const fake={...m,reference:p,tets:[],surface:[{nodes:[0,1,2],tet:0,wall:-1},{nodes:[3,4,5],tet:0,wall:-1}]} as Mesh3D
    expect(new Gripper3DSafety(fake).staticSelf(p).intersections).toBe(1)
  })
  it('finds overlap beyond a shared vertex or edge, including a swept fold',()=>{
    const m=makeGripper3DMesh(1),base=(nodes:[number,number,number][])=>({...m,tets:[],surface:nodes.map(n=>({nodes:n,tet:0,wall:-1 as const}))})
    const vertex:Vec3[]=[[0,0,0],[2,0,0],[0,2,0],[1,.2,-1],[1,.2,1]]
    expect(new Gripper3DSafety(base([[0,1,2],[0,3,4]])).staticSelf(vertex).intersections).toBe(1)
    const overlap:Vec3[]=[[0,0,0],[2,0,0],[0,2,0],[.4,.8,0]],safety=new Gripper3DSafety(base([[0,1,2],[0,1,3]]))
    expect(safety.staticSelf(overlap).intersections).toBe(1)
    const above=overlap.map(p=>[...p] as Vec3),below=overlap.map(p=>[...p] as Vec3);above[3][2]=1;below[3][2]=-1
    expect(safety.staticSelf(above).intersections).toBe(0);expect(safety.staticSelf(below).intersections).toBe(0)
    expect(safety.motion(above,below,[],[],0).safe).toBe(false)
  })
  it('distinguishes shared tetrahedral boundaries from positive-volume overlap',()=>{
    const a:[Vec3,Vec3,Vec3,Vec3]=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],touch:[Vec3,Vec3,Vec3,Vec3]=[[0,0,0],[1,0,0],[0,1,0],[0,0,-1]],overlap:[Vec3,Vec3,Vec3,Vec3]=[[0,0,0],[1,0,0],[0,1,0],[.1,.1,.5]]
    expect(positiveTetOverlap(a,touch)).toBe(false);expect(positiveTetOverlap(a,overlap)).toBe(true)
    const m=makeGripper3DMesh(1);expect(new Gripper3DSafety(m).staticSolidOverlap(m.reference).overlaps).toBe(0)
  })
  it('checks the entire cubic element-Jacobian trajectory, not just endpoints',()=>{
    const p:Vec3[]=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],q:Vec3[]=[[0,0,0],[-1.5,0,0],[0,-.5,0],[0,0,1]],tet={nodes:[0,1,2,3] as [number,number,number,number],gradients:[] as unknown as [Vec3,Vec3,Vec3,Vec3],volume:1/6}
    expect(sweptMinTetJ(tet,p,p)).toBeCloseTo(1,12);expect(sweptMinTetJ(tet,q,q)).toBeCloseTo(.75,12);expect(sweptMinTetJ(tet,p,q)).toBeLessThan(0)
    const mesh=makeGripper3DMesh(1),hex=hexesFromStructuredTets(mesh)[0],r=mesh.reference,z=r.map(([x,y,z]):Vec3=>[-1.5*x,-.5*y,z])
    expect(sweptMinHexJ(hex,r,r)).toBeCloseTo(1,12);expect(sweptMinHexJ(hex,z,z)).toBeCloseTo(.75,12);expect(sweptMinHexJ(hex,r,z)).toBeLessThan(0)
  })
  it('rejects non-finite geometry and invalid CCD inputs instead of reporting no interference',()=>{
    const mesh=makeGripper3DMesh(),safety=new Gripper3DSafety(mesh,hexesFromStructuredTets(mesh)),q=mesh.reference.map(p=>[...p] as Vec3)
    q[2][0]=NaN
    expect(safety.motion(mesh.reference,q,[],[],0).safe).toBe(false)
    expect(safety.motion(mesh.reference,mesh.reference,[],[],NaN).safe).toBe(false)
    expect(safety.motion(mesh.reference,mesh.reference,[],[],-1).safe).toBe(false)
    expect(safety.motion(mesh.reference,mesh.reference,[[0,0,0]],[[0,0,0]],0).safe).toBe(false)
    expect(()=>safety.staticSelf(q)).toThrow('Invalid')
    expect(()=>safety.staticSolidOverlap(q)).toThrow('Invalid')
    const tet:[[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]]
    expect(()=>positiveTetOverlap(tet,tet,NaN)).toThrow('Invalid')
    const s=new ContinuousGripper3D();expect(()=>s.auditGeometry(q,[[0,0,0],[0,0,0]])).toThrow('Invalid')
  })
  it('detects tendon vertices hidden in solid material',()=>{
    const s=new ContinuousGripper3D(),p=s.mesh.reference,tet=s.mesh.tets[0],center=tet.nodes.reduce((v,id)=>v.map((x,k)=>x+p[id][k]/4) as Vec3,[0,0,0] as Vec3)
    const r=s.auditGeometry(p,[center,center]);expect(r.interiorNodes).toBe(2)
  })
  it('converges coupled contact, preserves action/reaction, and rolls back',()=>{
    const s=new ContinuousGripper3D({...defaultGripper3DParams,pull:.0005,step:.00025}),first=s.step(.00025),last=s.step(.0005)
    expect(first.converged).toBe(true);expect(last.converged).toBe(true);expect(last.contacts.length).toBeGreaterThan(0)
    const center=(ids:number[])=>ids.reduce((sum,id)=>sum.map((x,k)=>x+last.positions[id][k]/ids.length) as Vec3,[0,0,0] as Vec3)
    const tip=center(s.tipSensor),previous=center(s.precedingTipSensor)
    expect(last.tipAngleDeg).toBeCloseTo(Math.atan2(tip[1]-previous[1],tip[0]-previous[0])*180/Math.PI,12)
    expect(last.tipAngleDeg).toBeGreaterThan(3)
    expect(last.residual).toBeLessThan(s.forceTolerance);expect(last.contactConverged).toBe(true);expect(last.checkPenetration).toBeLessThanOrEqual(s.contactTolerance)
    expect(last.interiorNodes).toBe(0);expect(last.surfaceIntersections).toBe(0);expect(last.selfIntersections).toBe(0);expect(last.volumeOverlaps).toBe(0);expect(last.minPathJ).toBeGreaterThan(0)
    expect(last.forceBalance).toBeLessThan(2e-5);expect(last.torqueBalance).toBeLessThan(2e-6)
    expect(last.collisionChecks).toBeGreaterThan(0)
    const before=Array.from(s.q),lambda=Array.from(s.lambda),failed=s.step(.001)
    expect(failed.converged).toBe(false);expect(Array.from(s.q)).toEqual(before);expect(Array.from(s.lambda)).toEqual(lambda);expect(s.pull).toBe(.0005)
    expect(s.step(.00025).converged).toBe(true);const unloaded=s.step(0)
    expect(unloaded.converged).toBe(true);expect(unloaded.contactConverged).toBe(true);expect(unloaded.tipDeflection).toBeCloseTo(0,12);expect(unloaded.tension).toBe(0);expect(unloaded.minPathJ).toBeGreaterThan(0)
  },30000)
  it('matches directional derivatives of the coupled contact energy',()=>{
    const s=new ContinuousGripper3D({...defaultGripper3DParams,pull:.0005,step:.00025}) as any
    expect(s.step(.00025).converged).toBe(true);expect(s.step(.0005).converged).toBe(true)
    const q=s.q as Float64Array,v=Float64Array.from(q,(_,i)=>s.fixedDofs[i]?0:Math.sin(i*1.731)),n=Math.hypot(...v);for(let i=0;i<v.length;i++)v[i]/=n
    const a=s.assemble(q,false),h=1e-8,up=Float64Array.from(q,(x,i)=>x+h*v[i]),down=Float64Array.from(q,(x,i)=>x-h*v[i]),fd=(s.assemble(up,false).energy-s.assemble(down,false).energy)/(2*h),exact=v.reduce((sum,x,i)=>sum+x*a.gradient[i],0)
    expect(Math.abs(fd-exact)).toBeLessThan(2e-6)
  },30000)
})
