import {describe,it,expect} from 'vitest'
import original from '../../data/references/net-gravity-original-5.json'
import vectorized from '../../data/references/net-gravity-vectorized-5.json'
import reference from '../../data/references/net-gravity-reference.json'
import {GravityNet,netStretchElement,type NetVec3} from '../net-gravity'
import {getCase} from '../../data/cases'
import {defaultsFor,Simulation} from '../simulation'

const parameter={stiffness:1,load:50,damping:.1}
describe('3D stretching network',()=>{
  it('matches independent finite differences and preserves action-reaction',()=>{
    const q=[-.2,.1,.3,.9,.4,-.1],args=(x:number[])=>[x.slice(0,3),x.slice(3)] as [NetVec3,NetVec3]
    const fn=(x:number[])=>netStretchElement(...args(x),.9,20),result=fn(q),h=1e-6
    for(let j=0;j<6;j++){
      const p=[...q],m=[...q];p[j]+=h;m[j]-=h
      const a=fn(p),b=fn(m)
      expect(Math.abs(result.gradient[j]-(a.energy-b.energy)/(2*h))).toBeLessThan(1e-7)
      for(let i=0;i<6;i++){
        expect(Math.abs(result.hessian[i][j]-(a.gradient[i]-b.gradient[i])/(2*h))).toBeLessThan(1e-6)
        expect(result.hessian[i][j]).toBeCloseTo(result.hessian[j][i],12)
      }
    }
    for(let d=0;d<3;d++)expect(result.gradient[d]+result.gradient[d+3]).toBeCloseTo(0,12)
    const compressed=netStretchElement([0,0,0],[.8,0,0],1,20)
    expect(compressed.energy).toBeGreaterThan(0);expect(compressed.hessian[1][1]).toBeLessThan(0)
    expect(()=>netStretchElement([0,0,0],[0,0,0],1,20)).toThrow()
  })
  it('loads the source topology and distributes each edge mass to both endpoints',()=>{
    const net=new GravityNet(parameter)
    expect(net.n).toBe(631);expect(net.edges).toHaveLength(720)
    expect([...net.fixedNodes]).toEqual([1,20,35,50,65,80])
    const sourceMass=net.edges.reduce((sum,e)=>sum+1000*Math.PI*.01**2*e.rest,0)
    expect(net.mass.reduce((sum,m)=>sum+m,0)/3).toBeCloseTo(sourceMass,10)
    expect(net.q.every((v,i)=>v===net.initial[i])).toBe(true);expect(net.maxEdgeStrain()).toBe(0)
  })
  it('the accelerated source assembly agrees with original assembly over five complete states',()=>{
    let max=0
    for(let i=0;i<5;i++)for(let j=0;j<original.frames[i].positions.length;j++)max=Math.max(max,Math.abs(original.frames[i].positions[j]-vectorized.frames[i].positions[j]))
    expect(max).toBeLessThan(1e-12)
    expect(original.metadata.fastAssembly).toBe(false);expect(vectorized.metadata.fastAssembly).toBe(true)
    expect(original.metadata.warnings).toHaveLength(0);expect(vectorized.metadata.warnings).toHaveLength(0)
    expect(reference.metadata.warnings).toHaveLength(0);expect(reference.metadata.fastAssembly).toBe(true)
    expect(reference.steps).toBe(200);expect(reference.frames).toHaveLength(11)
    for(let i=0;i<5;i++)for(let k=0;k<3;k++)expect(reference.probe[i][k]).toBeCloseTo(vectorized.probe[i][k],12)
  })
  it('matches the unvectorized Octave first five steps at every node',()=>{
    const net=new GravityNet(parameter);let max=0
    for(let i=0;i<5;i++){
      expect(net.step(.01).converged).toBe(true)
      for(let j=0;j<net.q.length;j++)max=Math.max(max,Math.abs(net.q[j]-original.frames[i].positions[j]))
    }
    expect(max).toBeLessThan(1e-7)
  },15000)
  it('runs the complete default path with constraints and converged residual',()=>{
    const net=new GravityNet(parameter);let maxResidual=0
    for(let i=0;i<200;i++){
      const result=net.step(.01);expect(result.converged).toBe(true);maxResidual=Math.max(maxResidual,result.residual)
    }
    expect(net.time).toBeCloseTo(2,12);expect(maxResidual).toBeLessThan(1e-5)
    expect(net.q[2]).toBeCloseTo(-.4391352103,7);expect(Number.isFinite(net.energy())).toBe(true)
    expect(net.maxEdgeStrain()).toBeCloseTo(.1744696044,8)
    for(const node of net.fixedNodes)for(let k=0;k<3;k++)expect(net.q[3*node+k]).toBe(net.initial[3*node+k])
  },30000)
  it('falls back to symmetric-indefinite MINRES without accepting an unconverged state',()=>{
    const net=new GravityNet({stiffness:3,load:100,damping:1})
    expect(net.step(.01).converged).toBe(true)
    const step=net.step(.01)
    expect(step.minresFallbacks).toBeGreaterThan(0);expect(step.converged).toBe(true);expect(step.residual).toBeLessThan(1e-5)
    expect(net.time).toBeCloseTo(.02,12)
    for(const node of net.fixedNodes)for(let k=0;k<3;k++)expect(net.q[3*node+k]).toBe(net.initial[3*node+k])
  },15000)
  it('rolls back on a degenerate trial and rejects invalid input',()=>{
    const net=new GravityNet(parameter),{a,b}=net.edges[0]
    for(let k=0;k<3;k++)net.q[3*b+k]=net.q[3*a+k]
    const q=[...net.q],v=[...net.v],result=net.step(.01)
    expect(result.converged).toBe(false);expect([...net.q]).toEqual(q);expect([...net.v]).toEqual(v);expect(net.time).toBe(0)
    expect(()=>net.step(0)).toThrow();expect(()=>new GravityNet({...parameter,stiffness:0})).toThrow()
  })
  it('restores the entire physical state and deterministically resumes after rewind',()=>{
    const item=getCase('net-gravity'),sim=new Simulation(item,defaultsFor(item))
    for(let i=0;i<12;i++)sim.step(.01)
    const snap=sim.snapshot();for(let i=0;i<10;i++)sim.step(.01)
    const expected=sim.snapshot();sim.restore(snap)
    for(let i=0;i<10;i++)sim.step(.01)
    const actual=sim.snapshot();expect(actual.time).toBeCloseTo(expected.time,12)
    expect(actual.netQ).toEqual(expected.netQ);expect(actual.netV).toEqual(expected.netV)
    expect(sim.frame().fixed).toHaveLength(6);expect(sim.frame().positions).toHaveLength(631);expect(sim.frame().edges).toHaveLength(720)
  },15000)
})
