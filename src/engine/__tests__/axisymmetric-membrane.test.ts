import {describe,expect,it} from 'vitest'
import {AxisymmetricMembrane,membraneElement} from '../axisymmetric-membrane'
import {cases} from '../../data/cases'
import {defaultsFor,Simulation} from '../simulation'

const max=(xs:number[])=>Math.max(...xs.map(Math.abs))

describe('axisymmetric Mooney–Rivlin membrane element',()=>{
  const q=[1.3,.2,1.4,.35],l0=.16,r0=1.2,h0=.01,c1=100,c2=20
  const evalAt=(x:number[])=>membraneElement([x[0],x[1]],[x[2],x[3]],l0,r0,h0,c1,c2)
  it('matches the energy gradient and analytic Hessian by central differences',()=>{
    const r=evalAt(q),h=1e-6,gErr:number[]=[],hErr:number[]=[]
    for(let j=0;j<4;j++){
      const a=[...q],b=[...q];a[j]+=h;b[j]-=h
      const pa=evalAt(a),pb=evalAt(b)
      gErr.push(r.gradient[j]-(pa.energy-pb.energy)/(2*h))
      for(let i=0;i<4;i++){
        hErr.push(r.hessian[i][j]-(pa.gradient[i]-pb.gradient[i])/(2*h))
        expect(r.hessian[i][j]).toBeCloseTo(r.hessian[j][i],8)
      }
    }
    expect(max(gErr)).toBeLessThan(1e-7);expect(max(hErr)).toBeLessThan(1e-6)
  })
  it('is stress free in its reference configuration and invariant to axial translation',()=>{
    const a:[number,number]=[1.1,.1],b:[number,number]=[1.2,.2],l=Math.hypot(.1,.1),r=1.15
    const x=membraneElement(a,b,l,r,.01,c1,c2),y=membraneElement([a[0],a[1]+2],[b[0],b[1]+2],l,r,.01,c1,c2)
    expect(Math.abs(x.energy)).toBeLessThan(1e-12);expect(max(x.gradient)).toBeLessThan(1e-12)
    expect(y.energy).toBeCloseTo(x.energy,12)
  })
  it('rejects degenerate radius and edge length',()=>{
    expect(()=>membraneElement([0,0],[0,1],1,1,.01,c1,c2)).toThrow()
    expect(()=>membraneElement([1,0],[1,0],1,1,.01,c1,c2)).toThrow()
  })
})

describe('axisymmetric membrane case',()=>{
  it('runs the complete default 2 s, with the first z coordinate constrained',()=>{
    const s=new AxisymmetricMembrane({nodes:60,stiffness:1,load:1,damping:1})
    for(let i=0;i<200;i++)expect(s.step(.01).converged,`step ${i+1}`).toBe(true)
    expect(s.time).toBeCloseTo(2,10);expect(s.q[1]).toBe(0);expect(s.q[0]).toBeCloseTo(6.9868573,5)
  },30000)
  it('uses 60 numerical nodes, displays a surface of revolution, and rewinds exactly',()=>{
    const item=cases.find(c=>c.id==='hyper-membrane')!,s=new Simulation(item,defaultsFor(item))
    const initial=s.frame();expect(initial.numericalNodes).toBe(60);expect(initial.positions.length).toBe(60*24)
    expect(initial.faces.length).toBe(60*24*2);expect(initial.isApproximation).toBe(false)
    for(let i=0;i<10;i++)s.step(.01)
    const saved=s.snapshot();for(let i=0;i<10;i++)s.step(.01)
    const expected=s.snapshot();s.restore(saved);for(let i=0;i<10;i++)s.step(.01)
    expect(s.snapshot().axisQ).toEqual(expected.axisQ);expect(s.frame().displacement).toBeGreaterThan(0)
  },30000)
})
