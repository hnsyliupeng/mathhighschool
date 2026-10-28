import {describe,it,expect} from 'vitest'
import {TendonGripper3D,defaultGripper3DParams,makeGripper3DMesh,neoHookeanTet,wallClosestGeometry,wallPenalty,type Vec3} from '../gripper3d'

const norm=(v:readonly number[])=>Math.hypot(...v)
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const diff=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]

describe('3-D physically perforated mesh',()=>{
  it('has three real open rectangular lumens, correct volume, and manifold surface',()=>{
    for(const level of [1,2] as const){
      const m=makeGripper3DMesh(level)
      expect(m.reference.length).toBe(level===1?288:1654);expect(m.tets.length).toBe(level===1?816:6528)
      expect(m.walls.length).toBe(level===1?64:256)
      expect(m.tets.reduce((s,t)=>s+t.volume,0)).toBeCloseTo(7.330133333333333e-6,14)
      expect(m.tets.every(t=>t.volume>0)).toBe(true)
      // No tetrahedron centroid occupies the missing bore volume.
      for(const t of m.tets){const center=t.nodes.map(i=>m.reference[i]).reduce((x,p)=>x.map((v,j)=>v+p[j]/4) as Vec3,[0,0,0] as Vec3);expect(center[1]>m.hole.y0&&center[1]<m.hole.y1&&center[2]>m.hole.z0&&center[2]<m.hole.z1).toBe(false)}
      const edgeCount=new Map<string,number>()
      for(const f of m.surface)for(let i=0;i<3;i++){const key=[f.nodes[i],f.nodes[(i+1)%3]].sort((a,b)=>a-b).join(':');edgeCount.set(key,(edgeCount.get(key)||0)+1)}
      expect([...edgeCount.values()].every(n=>n===2)).toBe(true)
      for(const face of m.walls){const [a,b,c]=face.nodes.map(i=>m.reference[i]),n=cross(diff(b,a),diff(c,a)),axis=face.wall<2?1:2,sign=face.wall===0||face.wall===2?1:-1;expect(sign*n[axis]).toBeGreaterThan(0)}
    }
  })
})

describe('3-D neo-Hookean material',()=>{
  const mesh=makeGripper3DMesh(),tet=mesh.tets[20]
  const start=tet.nodes.flatMap(i=>mesh.reference[i]);start[3]+=.0002;start[7]-=.0001
  const element=(q:number[],h=true)=>neoHookeanTet(Array.from({length:4},(_,i):Vec3=>[q[3*i],q[3*i+1],q[3*i+2]]),{...tet,nodes:[0,1,2,3]},250000,.35,h)
  it('has the correct zero-energy reference and is objective under rigid motion',()=>{
    const e=neoHookeanTet(mesh.reference,tet,250000,.35)
    expect(Math.abs(e.energy)).toBeLessThan(1e-16);expect(norm(e.gradient)).toBeLessThan(1e-12);expect(e.J).toBeCloseTo(1,12)
    const rotated=mesh.reference.map(([x,y,z]):Vec3=>[-y+.013,x-.023,z+.004]),r=neoHookeanTet(rotated,tet,250000,.35)
    expect(Math.abs(r.energy)).toBeLessThan(1e-15);expect(norm(r.gradient)).toBeLessThan(1e-11);expect(r.J).toBeCloseTo(1,12)
  })
  it('matches finite differences for the energy gradient and consistent tangent',()=>{
    const e=element(start),h=1e-8;let ge=0,he=0
    for(let j=0;j<12;j++){const a=[...start],b=[...start];a[j]+=h;b[j]-=h;const A=element(a,false),B=element(b,false);ge=Math.max(ge,Math.abs((A.energy-B.energy)/(2*h)-e.gradient[j]));for(let i=0;i<12;i++){he=Math.max(he,Math.abs((A.gradient[i]-B.gradient[i])/(2*h)-e.hessian[i*12+j]));expect(e.hessian[i*12+j]).toBeCloseTo(e.hessian[j*12+i],8)}}
    expect(ge).toBeLessThan(1e-8);expect(he).toBeLessThan(1e-4)
  })
  it('rejects inverted tetrahedra',()=>{const x=[...start],a=x.slice(0,3),b=x.slice(3,6);x.splice(0,3,...b);x.splice(3,3,...a);expect(()=>element(x)).toThrow()})
})

describe('actual deforming triangle contact',()=>{
  const run=(q:number[])=>wallPenalty([q[0],q[1],q[2]],[q[3],q[4],q[5]],[q[6],q[7],q[8]],[q[9],q[10],q[11]],.0004,4000)!
  // Normal points in +y, and the point is on the void side.
  const base=[0,0,0,0,0,.004,.006,0,0,.002,.0002,.001]
  it('has an exact two-way energy gradient and zero net force and torque',()=>{
    const r=run(base),h=1e-8;expect(r.penetration).toBeCloseTo(.0002,12)
    let max=0;for(let i=0;i<12;i++){const a=[...base],b=[...base];a[i]+=h;b[i]-=h;max=Math.max(max,Math.abs((run(a).energy-run(b).energy)/(2*h)-r.gradient[i]))}
    expect(max).toBeLessThan(1e-8)
    for(let d=0;d<3;d++)expect(r.gradient[d]+r.gradient[3+d]+r.gradient[6+d]+r.gradient[9+d]).toBeCloseTo(0,11)
    const torque=[0,0,0];for(let i=0;i<4;i++){const t=cross(base.slice(i*3,i*3+3) as Vec3,r.gradient.slice(i*3,i*3+3) as Vec3);for(let j=0;j<3;j++)torque[j]+=t[j]}expect(norm(torque)).toBeLessThan(1e-12)
  })
  it('includes edge closest points rather than dropping contact at a hole mouth',()=>{
    const q=[...base];q[9]=-.0001;q[10]=.0002;q[11]=.001
    const r=run(q);expect(r.bary.some(v=>Math.abs(v)<1e-12)).toBe(true);expect(r.penetration).toBeGreaterThan(0)
    let max=0;const h=1e-9;for(let i=0;i<12;i++){const a=[...q],b=[...q];a[i]+=h;b[i]-=h;max=Math.max(max,Math.abs((run(a).energy-run(b).energy)/(2*h)-r.gradient[i]))}expect(max).toBeLessThan(1e-7)
    expect(wallClosestGeometry([0,0,0],[0,0,.004],[.006,0,0],[-.0001,.0002,.001])?.distance).toBeCloseTo(Math.hypot(.0001,.0002),12)
  })
  it('is inactive when the tendon is outside the contact radius',()=>{const q=[...base];q[10]=.0006;const r=run(q);expect(r.energy).toBe(0);expect(norm(r.gradient)).toBe(0)})
})

describe('coupled 3-D equilibrium',()=>{
  it('matches a directional derivative with active sampled contacts',()=>{
    const s=new TendonGripper3D(),q=new Float64Array(s.q),id=s.cableStart+6;q[3*id+1]+=.00060;q[3*id+2]+=.00011
    const A=s.evaluate(q);expect(A.contactInfo.length).toBeGreaterThan(0)
    const direction=Float64Array.from(q,(_,i)=>Math.sin(i*1.371)*.17),h=1e-8,plus=new Float64Array(q),minus=new Float64Array(q);for(let i=0;i<q.length;i++){plus[i]+=h*direction[i];minus[i]-=h*direction[i]}
    const fd=(s.evaluate(plus).energy-s.evaluate(minus).energy)/(2*h),analytic=A.gradient.reduce((v,x,i)=>v+x*direction[i],0)
    expect(Math.abs(fd-analytic)).toBeLessThan(2e-6)
    const forces=[0,0,0];for(let i=0;i<A.gradient.length;i++)forces[i%3]+=A.gradient[i];expect(norm(forces)).toBeLessThan(1e-9)
  },20000)
  it('solves a coupled loading step, transmits contact, and rolls back failures',()=>{
    const s=new TendonGripper3D({...defaultGripper3DParams,pull:.0005}),f1=s.step(.00025),f2=s.step(.0005)
    expect(f1.converged&&f2.converged).toBe(true);expect(f2.tipDeflection).toBeGreaterThan(.001);expect(f2.tension).toBeGreaterThan(0);expect(f2.contacts.length).toBeGreaterThan(0)
    expect(f2.residual).toBeLessThan(2e-5);expect(f2.minJ).toBeGreaterThan(0);expect(f2.forceBalance).toBeLessThan(2e-5)
    const previous=Array.from(s.q),bad=s.step(.001);expect(bad.converged).toBe(false);expect(Array.from(s.q)).toEqual(previous);expect(s.last).toBe(f2)
    const skipped=new TendonGripper3D({...defaultGripper3DParams,pull:.0005}).step(.0005);expect(skipped.converged).toBe(false);expect(skipped.message).toContain('增量过大')
  },30000)
  it('rejects invalid physical and mesh parameters',()=>{
    expect(()=>new TendonGripper3D({...defaultGripper3DParams,radius:.001})).toThrow();expect(()=>new TendonGripper3D({...defaultGripper3DParams,young:NaN})).toThrow();expect(()=>makeGripper3DMesh(4 as 1)).toThrow()
    const m=makeGripper3DMesh();expect(()=>neoHookeanTet(m.reference,m.tets[0],250000,NaN)).toThrow();expect(()=>wallPenalty([0,0,0],[0,0,1],[1,0,0],[.1,.1,.1],NaN,1)).toThrow()
  })
})
