import {describe,it,expect} from 'vitest'
import fixture from '../../data/references/axis-shell-element-reference.json'
import {AxisymmetricShell,shellBendingElement,shellStretchElement,type ShellElement} from '../axisymmetric-shell'
import {defaultsFor,Simulation} from '../simulation'
import {AXIS_SHELL_DISPLAY_SEGMENTS,axisShellGuideSegments} from '../axis-shell-guides'
import {getCase} from '../../data/cases'

type V2=[number,number]
const pts=(x:number[])=>[[x[0],x[1]],[x[2],x[3]],[x[4],x[5]]] as [V2,V2,V2]
function checkDifferences(q:number[],evaluate:(x:number[])=>ShellElement,h:number,gradTolerance:number,hessianTolerance:number){
  const exact=evaluate(q)
  for(let j=0;j<q.length;j++){
    const a=[...q],b=[...q];a[j]+=h;b[j]-=h
    const plus=evaluate(a),minus=evaluate(b)
    expect(Math.abs(exact.gradient[j]-(plus.energy-minus.energy)/(2*h))).toBeLessThan(gradTolerance)
    for(let i=0;i<q.length;i++){
      expect(Math.abs(exact.hessian[i][j]-(plus.gradient[i]-minus.gradient[i])/(2*h))).toBeLessThan(hessianTolerance)
      expect(Math.abs(exact.hessian[i][j]-exact.hessian[j][i])).toBeLessThan(1e-8)
    }
  }
}
describe('axisymmetric linear shell elements',()=>{
  it('has the correct stretching energy gradient and Hessian',()=>{
    const q=[.20,.03,.23,.045],p=fixture.stretch
    checkDifferences(q,x=>shellStretchElement([x[0],x[1]],[x[2],x[3]],p.l0,p.r0,p.ea,p.nu),1e-7,1e-6,1e-4)
  })
  it('has the correct curvature-coupled bending gradient and Hessian',()=>{
    const q=fixture.points.flat(),p=fixture.bend
    checkDifferences(q,x=>shellBendingElement(...pts(x),p.l0,p.r0,p.ei,p.nu,p.k10,p.k20),1e-7,1e-5,1e-3)
  })
  it('matches the independent original Octave element force and matrix',()=>{
    const [a,b,c]=fixture.points as [V2,V2,V2],s=fixture.stretch,k=fixture.bend
    const stretch=shellStretchElement(a,b,s.l0,s.r0,s.ea,s.nu),bend=shellBendingElement(a,b,c,k.l0,k.r0,k.ei,k.nu,k.k10,k.k20)
    for(const [actual,ref] of [[stretch,s],[bend,k]] as const){
      for(let i=0;i<ref.gradient.length;i++){
        expect(Math.abs(actual.gradient[i]-ref.gradient[i])).toBeLessThan(1e-8)
        for(let j=0;j<ref.gradient.length;j++)expect(Math.abs(actual.hessian[i][j]-ref.hessian[i][j])).toBeLessThan(1e-7)
      }
    }
  })
  it('is invariant under axial translation but not radial translation',()=>{
    const q=fixture.points.flat(),k=fixture.bend,energy=(x:number[])=>shellBendingElement(...pts(x),k.l0,k.r0,k.ei,k.nu,k.k10,k.k20).energy
    const z=q.map((x,i)=>i%2?x+.31:x),r=q.map((x,i)=>i%2?x:x+.05)
    expect(Math.abs(energy(q)-energy(z))).toBeLessThan(1e-11)
    expect(Math.abs(energy(q)-energy(r))).toBeGreaterThan(1e-3)
  })
  it('rejects a degenerate edge or polar curvature',()=>{
    expect(()=>shellStretchElement([.2,0],[.2,0],.1,.2,10,.5)).toThrow()
    expect(()=>shellBendingElement([.1,0],[0,0],[.2,.1],.1,.1,1,.5,0,0)).toThrow()
  })
})
describe('axisymmetric shell integration',()=>{
  const p=(kind:'inflation'|'eversion')=>({nodes:40,stiffness:kind==='inflation'?1:1000,load:1,damping:.1})
  it.each(['inflation','eversion'] as const)('starts from its stress-free reference geometry: %s',kind=>{
    const sim=new AxisymmetricShell(kind,p(kind))
    expect(sim.energy()).toBeLessThan(1e-15)
    expect(sim.q[0]).toBeCloseTo(.0001,11)
    if(kind==='inflation'){expect(sim.q.at(-2)).toBeCloseTo(1,14);expect(sim.q.at(-1)).toBe(0)}
    else {expect(sim.q.at(-2)).toBeCloseTo(.696706709347165,14);expect(sim.q.at(-1)).toBeCloseTo(.717356090899523,14)}
  })
  it('inflates through the full pressure path while retaining the source boundary conditions',()=>{
    const sim=new AxisymmetricShell('inflation',p('inflation'))
    for(let i=0;i<200;i++)expect(sim.step(.01).converged).toBe(true)
    expect(sim.time).toBeCloseTo(2,10);expect(sim.q[1]).toBeGreaterThan(.7)
    expect(sim.q[0]).toBeCloseTo(.0001,14);expect(sim.q.at(-2)).toBe(1);expect(sim.q.at(-1)).toBe(0)
    expect(sim.last.residual).toBeLessThan(1e-5)
  },30000)
  it('follows a converged equilibrium across the cap branch switch through the full path',()=>{
    const sim=new AxisymmetricShell('eversion',p('eversion'))
    for(let i=0;i<1200;i++)expect(sim.step(.005).converged).toBe(true)
    expect(sim.time).toBeCloseTo(6,10);expect(sim.branchSwitches).toBe(1)
    expect(sim.q[1]).toBeCloseTo(sim.initial[1]-.6,10);expect(sim.q[3]).toBeCloseTo(sim.initial[3]-.6,10)
    expect(sim.q[0]).toBe(sim.initial[0]);expect(sim.q[2]).toBe(sim.initial[2]);expect(sim.q.at(-1)).toBe(sim.initial.at(-1))
    expect(sim.last.residual).toBeLessThan(1e-5)
  },45000)
  it('draws only the constrained directions in its shell guides',()=>{
    const diskItem=getCase('axis-inflate'),disk=new Simulation(diskItem,defaultsFor(diskItem))
    for(let i=0;i<30;i++)disk.step(.01)
    const diskFrame=disk.frame(),vertical=axisShellGuideSegments('inflation',diskFrame.positions),center=diskFrame.positions[0]
    expect(vertical).toHaveLength(6)
    expect(vertical[0]).toBe(center[0]);expect(vertical[2]).toBe(center[2])
    expect(vertical[3]).toBe(center[0]);expect(vertical[5]).toBe(center[2])
    expect(vertical[1]).toBeLessThan(center[1]);expect(vertical[4]).toBeGreaterThan(center[1])
    const capItem=getCase('axis-snap'),cap=new Simulation(capItem,defaultsFor(capItem))
    for(let i=0;i<30;i++)cap.step(.01)
    const frame=cap.frame(),guides=axisShellGuideSegments('eversion',frame.positions)
    expect(guides).toHaveLength(8*6)
    for(let i=0;i<8;i++){
      const p=frame.positions[frame.positions.length-AXIS_SHELL_DISPLAY_SEGMENTS+i*AXIS_SHELL_DISPLAY_SEGMENTS/8],a=guides.slice(i*6,i*6+3),b=guides.slice(i*6+3,i*6+6)
      expect(a[1]).toBeCloseTo(p[1],12);expect(b[1]).toBeCloseTo(p[1],12)
      expect((a[0]-p[0])*p[2]-(a[2]-p[2])*p[0]).toBeCloseTo(0,12)
      expect((b[0]-p[0])*p[2]-(b[2]-p[2])*p[0]).toBeCloseTo(0,12)
      expect(Math.hypot(a[0],a[2])).toBeLessThan(Math.hypot(p[0],p[2]))
      expect(Math.hypot(b[0],b[2])).toBeGreaterThan(Math.hypot(p[0],p[2]))
    }
    // The rim's vertical coordinate is constrained, not its full position.
    expect(frame.fixed).toHaveLength(0)
    const collapsed=frame.positions.map((v,i):[number,number,number]=>i>=frame.positions.length-AXIS_SHELL_DISPLAY_SEGMENTS?[0,v[1],0]:v)
    expect(axisShellGuideSegments('eversion',collapsed).every(Number.isFinite)).toBe(true)
  },15000)
  it('reports current meridional engineering strain and restores it on rewind',()=>{
    const item=getCase('axis-inflate'),sim=new Simulation(item,defaultsFor(item))
    const initial=sim.frame();expect(initial.meridionalStrain).toBe(0)
    sim.step(.01)
    const current=sim.frame(),snapshot=sim.snapshot(),s=AXIS_SHELL_DISPLAY_SEGMENTS
    const edgeLength=(positions:typeof current.positions,i:number)=>Math.hypot(...positions[i*s].map((value,j)=>positions[(i+1)*s][j]-value))
    const independent=Math.max(...Array.from({length:39},(_,i)=>Math.abs(edgeLength(current.positions,i)/edgeLength(initial.positions,i)-1)))
    expect(current.meridionalStrain).toBeCloseTo(independent,12)
    sim.step(.01);sim.restore(snapshot)
    expect(sim.frame().meridionalStrain).toBeCloseTo(independent,12)
  })
  it('restores the cap state and branch count on rewind and reproduces continuation',()=>{
    const item=getCase('axis-snap'),sim=new Simulation(item,defaultsFor(item))
    for(let i=0;i<30;i++)sim.step(.01)
    const snapshot=sim.snapshot()
    for(let i=0;i<10;i++)sim.step(.01)
    const expected=sim.snapshot()
    sim.restore(snapshot)
    expect(sim.frame().residual).toBe(snapshot.residual)
    expect(sim.frame().converged).toBe(snapshot.converged)
    for(let i=0;i<10;i++)sim.step(.01)
    const replay=sim.snapshot()
    expect(replay.time).toBeCloseTo(expected.time,12);expect(replay.axisBranches).toBe(expected.axisBranches)
    expect(Math.max(...replay.axisQ!.map((x,i)=>Math.abs(x-expected.axisQ![i])))).toBeLessThan(1e-11)
    expect(sim.frame().loadCurve?.y).toBeCloseTo(expected.axisReaction!,7)
  },15000)
})
