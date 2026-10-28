import { describe, expect, it } from 'vitest'
import { magneticEdge, sourceDragEdge, SoftRobot } from '../soft-robot'
import { PlanarBeam, type Vec2 } from '../planar'
import { cases } from '../../data/cases'
import { defaultsFor, Simulation } from '../simulation'

const max=(x:number[])=>Math.max(...x.map(Math.abs))

describe('magnetic edge',()=>{
  const values=[.12,-.08,.41,.17],rest=.37,area=.002,t0:Vec2=[.8,.6],br:Vec2=[120,35],ba:Vec2=[2,-1.2]
  const evaluate=(x:number[])=>magneticEdge([x[0],x[1]],[x[2],x[3]],rest,area,t0,br,ba)
  it('force is the negative energy gradient and conserves total force',()=>{
    const r=evaluate(values),h=1e-7
    for(let j=0;j<4;j++){
      const p=[...values],m=[...values];p[j]+=h;m[j]-=h
      expect(Math.abs(r.force[j]+(evaluate(p).energy-evaluate(m).energy)/(2*h))).toBeLessThan(1e-9)
    }
    expect(r.force[0]+r.force[2]).toBeCloseTo(0,14)
    expect(r.force[1]+r.force[3]).toBeCloseTo(0,14)
  })
  it('exact force Jacobian agrees with central differences and is symmetric',()=>{
    const r=evaluate(values),h=1e-7,diffs:number[]=[]
    for(let j=0;j<4;j++){
      const p=[...values],m=[...values];p[j]+=h;m[j]-=h
      const fp=evaluate(p).force,fm=evaluate(m).force
      for(let i=0;i<4;i++){
        diffs.push(r.jacobian[i][j]-(fp[i]-fm[i])/(2*h))
        expect(r.jacobian[i][j]).toBeCloseTo(r.jacobian[j][i],12)
      }
    }
    expect(max(diffs)).toBeLessThan(1e-8)
  })
})

describe('source anisotropic drag',()=>{
  const values=[.02,.013,.031,.018],old:Vec2=[.019,.014],dt=.01,r=.001
  const evaluate=(x:number[])=>sourceDragEdge([x[0],x[1]],[x[2],x[3]],old,dt,r)
  it('uses the same first-end velocity for both ends, as upstream',()=>{
    const f=evaluate(values).force
    expect(f.slice(0,2)).toEqual(f.slice(2,4))
    expect(max(f)).toBeGreaterThan(0)
  })
  it('differentiates geometry, velocity and cross-node blocks',()=>{
    const result=evaluate(values),h=1e-8,diffs:number[]=[]
    for(let j=0;j<4;j++){
      const p=[...values],m=[...values];p[j]+=h;m[j]-=h
      const fp=evaluate(p).force,fm=evaluate(m).force
      for(let i=0;i<4;i++)diffs.push(result.jacobian[i][j]-(fp[i]-fm[i])/(2*h))
    }
    expect(max(diffs)).toBeLessThan(1e-8)
    expect(Math.abs(result.jacobian[2][0])).toBeGreaterThan(1e-6)
    const upstream=sourceDragEdge([values[0],values[1]],[values[2],values[3]],old,dt,r,true)
    expect(upstream.jacobian[2][0]).toBe(0)
    expect(max(result.jacobian.flat().map((x,i)=>x-upstream.jacobian.flat()[i]))).toBeGreaterThan(1e-5)
  })
  it('vanishes at zero velocity',()=>expect(max(sourceDragEdge([0,0],[1,0],[0,0],.01,r).force)).toBe(0))
})

describe('soft robot integration',()=>{
  it('allows a single constrained coordinate without clamping the whole node',()=>{
    const b=new PlanarBeam({nodes:4,length:1,young:1e6,radius:.01,density:1000,gravity:0,damping:0,fixedDofs:[7]})
    expect([...b.fixedDofs]).toEqual([7]);expect(b.freeDofs).toContain(6);expect(b.freeDofs).not.toContain(7)
  })
  it('runs each physical case to its declared final time and honors its original constraints',()=>{
    for(const [kind,stiffness,damping,steps] of [['magnetic',100,.1,2000],['swimmer',.1,0,500]] as const){
      const s=new SoftRobot(kind,{nodes:40,stiffness,load:1,damping})
      for(let i=0;i<steps;i++)expect(s.step(.01).converged,`${kind} step ${i+1}`).toBe(true)
      expect(s.beam.time).toBeCloseTo(steps*.01,8)
      if(kind==='magnetic')expect(s.beam.q.slice(0,4)).toEqual([-.5,0,-.4744,0])
      else {expect(s.beam.q[79]).toBe(0);expect(s.beam.q[78]).toBeGreaterThan(.1)}
    }
  },60000)
  it('restores a swimmer and continues from the same physical state',()=>{
    const item=cases.find(c=>c.id==='robot-swim')!,s=new Simulation(item,defaultsFor(item))
    for(let i=0;i<20;i++)s.step(.01)
    const state=s.snapshot()
    for(let i=0;i<10;i++)s.step(.01)
    const expected=s.snapshot(),frame=s.frame()
    expect(frame.displacement).toBeCloseTo(expected.beamQ![78]-.1,12)
    expect(frame.fixed).toEqual([]) // The remaining y-only constraint is not a clamped node.
    expect(frame.isApproximation).toBe(false)
    s.restore(state);for(let i=0;i<10;i++)s.step(.01)
    expect(s.snapshot().beamQ).toEqual(expected.beamQ)
  })
})
