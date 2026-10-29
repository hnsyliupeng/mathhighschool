import {describe,it,expect} from 'vitest'
import {makeGripper3DMesh,type Vec3} from '../gripper3d'
import {hexesFromStructuredTets,neoHookeanHex} from '../hexahedron'
import {Gripper3DSafety,sweptMinHexJ,sweptMinTetJ} from '../gripper3d-safety'
import {certifyHexJacobian} from '../hex-jacobian-bound'

const mesh=makeGripper3DMesh(),hex=hexesFromStructuredTets(mesh)[0],ref=mesh.reference
const setCorners=(p:Vec3[],corners:Vec3[])=>{hex.nodes.forEach((id,i)=>p[id]=corners[i]);return p}
const clone=()=>ref.map(x=>[...x] as Vec3)
describe('full-reference-domain swept hexahedral Jacobian',()=>{
  it('certifies the reference configuration and rigid translations',()=>{
    const translated=ref.map(([x,y,z]):Vec3=>[x+1.2,y-.7,z+.3])
    expect(certifyHexJacobian(hex,ref,ref).lowerBound).toBeGreaterThan(.999999)
    const c=certifyHexJacobian(hex,ref,translated)
    expect(c.safe).toBe(true);expect(c.lowerBound).toBeGreaterThan(.999999)
  })
  it('rejects a corner inversion missed by Gauss points AND all six geometric tetrahedra',()=>{
    // Deterministic counterexample found by a seeded perturbation search.
    const q=setCorners(clone(),[[.0011839371069024007,-.00046401190587785094,-.0006042498403787612],[.004525058459800979,-.0018535468155983833,.0012283420960605145],[-.004364521570503712,.002941483154310845,-.0016419087305665017],[.006766329817163448,.005254662910383194,.0019544124837219718],[-.0008811420146375894,-.00177202211569529,.003789353475570679],[.006857310004842778,-.0002769661973696202,.0036544515655934813],[-.00197957498456041,.003229865973140113,.0031229020467400553],[.004972780226108929,.00448481164816767,.0020712222696840765]])
    expect(neoHookeanHex(q,hex,250000,.35,false).minJ).toBeGreaterThan(.78)
    expect(Math.min(...mesh.tets.slice(0,6).map(t=>sweptMinTetJ(t,q,q)))).toBeGreaterThan(.26)
    const c=certifyHexJacobian(hex,q,q)
    expect(c.safe).toBe(false);expect(c.reason).toBe('nonpositive-sample');expect(c.minimumSample).toBeLessThan(-.15)
    const oneCell={...mesh,tets:mesh.tets.slice(0,6),surface:[]},path=new Gripper3DSafety(oneCell,[hex]).motion(q,q,[],[],0)
    expect(path.safe).toBe(false);expect(path.reason).toContain('full-domain J')
  })
  it('rejects a path with positive end determinants but an intermediate inversion',()=>{
    const q=ref.map(([x,y,z]):Vec3=>[-1.5*x,-.5*y,z])
    expect(sweptMinHexJ(hex,ref,ref)).toBeCloseTo(1,12);expect(sweptMinHexJ(hex,q,q)).toBeCloseTo(.75,12)
    expect(certifyHexJacobian(hex,ref,q).safe).toBe(false)
  })
  it('subdivides an inconclusive Bernstein hull and fails closed when the budget is exhausted',()=>{
    // The exact J(u,v,w)=(u-1/2)^2+0.2^2 is strictly positive,
    // but its unsplit quadratic Bernstein coefficient is negative.
    const lo=ref[hex.nodes[0]],h=[0,1,2].map(j=>ref[hex.nodes[1<<j]][j]-lo[j]),q=clone()
    const corners=Array.from({length:8},(_,n):Vec3=>{const u=n&1?1:0,v=n&2?1:0,w=n&4?1:0;return [lo[0]+h[0]*u,lo[1]+h[1]*((u-.5)*v+.2*w),lo[2]+h[2]*(-.2*v+(u-.5)*w)]})
    setCorners(q,corners)
    const coarse=certifyHexJacobian(hex,q,q,1e-8,0),fine=certifyHexJacobian(hex,q,q)
    expect(coarse.safe).toBe(false);expect(coarse.reason).toBe('indeterminate')
    expect(fine.safe).toBe(true);expect(fine.subdivisions).toBeGreaterThan(0);expect(fine.lowerBound).toBeGreaterThan(0);expect(fine.lowerBound).toBeLessThanOrEqual(.04+1e-10)
  })
  it('bounds independently evaluated interior samples on seeded distorted trajectories',()=>{
    const lo=ref[hex.nodes[0]],h=[0,1,2].map(j=>ref[hex.nodes[1<<j]][j]-lo[j]);let seed=0x7a815b31,certified=0
    const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)
    const determinant=(p:Vec3[],t:number,u:number,v:number,w:number,q:Vec3[])=>{
      const A=[[0,0,0],[0,0,0],[0,0,0]],x=[u,v,w]
      for(let n=0;n<8;n++)for(let j=0;j<3;j++){
        let d=n&(1<<j)?1:-1;for(let k=0;k<3;k++)if(k!==j)d*=n&(1<<k)?x[k]:1-x[k]
        for(let i=0;i<3;i++){const a=p[hex.nodes[n]][i],b=q[hex.nodes[n]][i],origin=(1-t)*p[hex.nodes[0]][i]+t*q[hex.nodes[0]][i];A[i][j]+=((1-t)*a+t*b-origin)*d}
      }
      return (A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]))/(8*hex.weight)
    }
    for(let test=0;test<40;test++){
      const p=clone(),q=clone();for(const id of hex.nodes)for(let k=0;k<3;k++){p[id][k]+=(random()-.5)*h[k]*.9;q[id][k]+=(random()-.5)*h[k]*.9}
      const c=certifyHexJacobian(hex,p,q);if(!c.safe)continue;certified++
      for(let i=0;i<80;i++){const j=determinant(p,random(),random(),random(),random(),q);expect(j).toBeGreaterThanOrEqual(c.lowerBound-1e-9);expect(j).toBeGreaterThan(1e-8)}
    }
    expect(certified).toBeGreaterThan(5)
  })
  it('fails closed on an exactly singular affine map hidden by floating-point cancellation',()=>{
    // The third row is exactly the sum of the first two, so det(A)=0 using
    // integer arithmetic. Direct double-precision cofactor evaluation of this
    // matrix on the 3x3x3 interpolation grid returns +33554432 instead.
    const A=[[-85726087,-6961944,-26373100],[-34790182,-82239127,17849900],[-120516269,-89201071,-8523200]]
    expect(A[2].every((x,i)=>x===A[0][i]+A[1][i])).toBe(true)
    const p=Array.from({length:8},(_,n)=>A.map(row=>row.reduce((s,x,i)=>s+x*((n>>i)&1),0)) as Vec3)
    const c=certifyHexJacobian({...hex,nodes:[0,1,2,3,4,5,6,7],weight:1/8},p,p)
    expect(c.minimumSample).toBeGreaterThan(0);expect(c.safe).toBe(false);expect(c.reason).toBe('indeterminate')
  })
  it('rejects non-finite coordinates and invalid tolerances instead of declaring them safe',()=>{
    const q=clone();q[hex.nodes[2]][1]=NaN
    expect(certifyHexJacobian(hex,ref,q).safe).toBe(false)
    expect(certifyHexJacobian(hex,ref,ref,NaN).safe).toBe(false)
    expect(certifyHexJacobian(hex,ref,ref,-1).safe).toBe(false)
    expect(certifyHexJacobian(hex,ref,ref,1e-8,0,0).safe).toBe(false)
  })
})
