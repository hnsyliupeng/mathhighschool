import { describe,it,expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { jsKernels } from '../kernels'
import { bendingElement, bendingHessian, upstreamBendingJacobian, stretchElement, mooneyRivlinElement, mooneyRivlinHessian, PlanarBeam, type Vec2 } from '../planar'
import { PrescribedBeam } from '../planar-cases'
import { chainMatrices, chainStep } from '../linear'
import { Simulation, defaultsFor } from '../simulation'
import { cases } from '../../data/cases'
import { theory } from '../../data/theory'
import { axisShellReferenceWindows, referenceChecks, referenceMetadata, planarReferenceMetadata, hyperReferenceMetadata } from '../reference'
import { curvatureFromDegrees } from '../../components/CurvatureLab'
import jacobianReference from '../../data/references/bending-jacobian-reference.json'

const finiteDifference=(fn:(x:number[])=>number,x:number[],h=1e-6)=>x.map((_,i)=>{const a=[...x],b=[...x];a[i]+=h;b[i]-=h;return (fn(a)-fn(b))/(2*h)})

describe('energy and geometry',()=>{
  it('stretching gradient agrees with central differences and action/reaction',()=>{
    const q=[.1,-.2,1.3,.4], evaluate=(x:number[])=>stretchElement([x[0],x[1]],[x[2],x[3]],.9,12)
    const result=evaluate(q), fd=finiteDifference(x=>evaluate(x).energy,q)
    result.gradient.forEach((v,i)=>expect(v).toBeCloseTo(fd[i],7))
    expect(result.gradient[0]+result.gradient[2]).toBeCloseTo(0,12)
    expect(result.gradient[1]+result.gradient[3]).toBeCloseTo(0,12)
  })
  it('discrete bending gradient agrees with central differences',()=>{
    const q=[-.4,.1,.2,.3,.8,-.15], evaluate=(x:number[])=>bendingElement([x[0],x[1]],[x[2],x[3]],[x[4],x[5]],.7,2.3,.05)
    const result=evaluate(q), fd=finiteDifference(x=>evaluate(x).energy,q)
    result.gradient.forEach((v,i)=>expect(v).toBeCloseTo(fd[i],6))
  })
  it('analytic planar bending Hessian agrees with the gradient difference and is symmetric',()=>{
    const q=[-.4,.1,.2,.3,.8,-.15], args=(x:number[])=>[[x[0],x[1]],[x[2],x[3]],[x[4],x[5]]] as [Vec2,Vec2,Vec2]
    for(const beta0 of [0,.25,-.35]) {
      const [a,b,c]=args(q),H=bendingHessian(a,b,c,.7,2.3,beta0),h=1e-6
      for(let j=0;j<6;j++){
        const plus=[...q],minus=[...q];plus[j]+=h;minus[j]-=h
        const gp=bendingElement(...args(plus),.7,2.3,beta0).gradient,gm=bendingElement(...args(minus),.7,2.3,beta0).gradient
        for(let i=0;i<6;i++){expect(Math.abs(H[i][j]-(gp[i]-gm[i])/(2*h))).toBeLessThan(2e-6);expect(H[i][j]).toBeCloseTo(H[j][i],10)}
      }
      for(const row of H){expect(row[0]+row[2]+row[4]).toBeCloseTo(0,10);expect(row[1]+row[3]+row[5]).toBeCloseTo(0,10)}
    }
  })
  it('upstream Jacobian reproduces Octave but differs from the true Hessian',()=>{
    const [a,b,c]=jacobianReference.points as [Vec2,Vec2,Vec2],{restVoronoi,ei,restBeta}=jacobianReference
    const upstream=upstreamBendingJacobian(a,b,c,restVoronoi,ei,restBeta),exact=bendingHessian(a,b,c,restVoronoi,ei,restBeta)
    let sourceError=0,difference=0
    for(let i=0;i<6;i++)for(let j=0;j<6;j++){sourceError=Math.max(sourceError,Math.abs(upstream[i][j]-jacobianReference.matrix[i][j]));difference=Math.max(difference,Math.abs(upstream[i][j]-exact[i][j]))}
    expect(sourceError).toBeLessThan(1e-7);expect(difference).toBeGreaterThan(100)
  })
  it('Mooney–Rivlin edge energy, force and Hessian agree with finite differences',()=>{
    const q=[.1,-.2,1.3,.4],args=(x:number[])=>[[x[0],x[1]],[x[2],x[3]]] as [Vec2,Vec2]
    const evaluate=(x:number[])=>mooneyRivlinElement(...args(x),.9,12,3),fd=finiteDifference(x=>evaluate(x).energy,q),H=mooneyRivlinHessian(...args(q),.9,12,3),h=1e-6
    const gradient=evaluate(q).gradient;gradient.forEach((v,i)=>expect(Math.abs(v-fd[i])).toBeLessThan(1e-6))
    for(let j=0;j<4;j++){const a=[...q],b=[...q];a[j]+=h;b[j]-=h;const ga=evaluate(a).gradient,gb=evaluate(b).gradient;for(let i=0;i<4;i++){expect(Math.abs(H[i][j]-(ga[i]-gb[i])/(2*h))).toBeLessThan(1e-5);expect(H[i][j]).toBeCloseTo(H[j][i],10)}}
    const reference=mooneyRivlinElement([0,0],[1,0],1,12,3);expect(reference.energy).toBeCloseTo(0,12);expect(reference.gradient.every(x=>Math.abs(x)<1e-12)).toBe(true)
  })
  it('energy is invariant under planar rigid translations and rotations',()=>{
    const points:Vec2[]=[[-.4,.1],[.2,.3],[.8,-.15]]
    const energy=(p:Vec2[])=>stretchElement(p[0],p[1],.9,12).energy+bendingElement(p[0],p[1],p[2],.7,2.3).energy
    const angle=.8,c=Math.cos(angle),s=Math.sin(angle)
    const transformed=points.map(([x,y]):Vec2=>[c*x-s*y+3,s*x+c*y-2])
    expect(energy(transformed)).toBeCloseTo(energy(points),11)
  })
  it('interactive turning-angle diagram uses the signed integrated curvature',()=>{
    expect(curvatureFromDegrees(0)).toBeCloseTo(0,12)
    expect(curvatureFromDegrees(90)).toBeCloseTo(2,12)
    expect(curvatureFromDegrees(-45)).toBeCloseTo(-curvatureFromDegrees(45),12)
  })
  it('the theory caveat renders the source-versus-exact relation as KaTeX, not literal qquad text',()=>{
    const formula=theory.find(c=>c.id==='planar')!.steps.find(s=>s.title.includes('原脚本 Jacobian'))!.formula!
    expect(formula).toContain(String.raw`\qquad`)
  })
  it('Neo-Hookean derivative matches finite difference',()=>{
    const mu=3, W=(l:number)=>mu/2*(l*l+2/l-3), l=1.34, h=1e-6
    expect((W(l+h)-W(l-h))/(2*h)).toBeCloseTo(mu*(l-1/l**2),8)
  })
})

describe('implicit dynamics and beam',()=>{
  it('single DOF satisfies the implicit residual',()=>{
    const x=1.2,v=-.3,dt=.01,m=1,c=.1,k=10,l0=1,f=.8
    const next=jsKernels.sdof_step(x,v,m,c,k,l0,f,dt)
    const r=m*((next-x)/dt-v)/dt+c*(next-x)/dt+k*(next-l0)-f
    expect(Math.abs(r)).toBeLessThan(1e-10)
  })
  it('first-order implicit Euler converges toward a harmonic analytic solution as dt shrinks',()=>{
    const simulate=(dt:number)=>{let x=1,v=0;for(let i=0;i<Math.round(1/dt);i++){const next=jsKernels.sdof_step(x,v,1,0,4,0,0,dt);v=(next-x)/dt;x=next}return Math.abs(x-Math.cos(2))}
    expect(simulate(.01)).toBeLessThan(simulate(.02)*.55)
    expect(simulate(.01)).toBeLessThan(.02)
  })
  it('assembled chain has symmetric matrices and satisfies its implicit equation',()=>{
    const q=[.03,-.02,.01], v=[.1,.02,-.03], dt=.01,t=.7
    const {q:next,K,C}=chainStep(q,v,t,dt)
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){expect(K[i][j]).toBe(K[j][i]);expect(C[i][j]).toBe(C[j][i])}
    for(let i=0;i<3;i++) {
      const r=(next[i]-q[i]-dt*v[i])/(dt*dt)+K[i].reduce((a,k,j)=>a+k*next[j],0)+C[i].reduce((a,c,j)=>a+c*(next[j]-q[j])/dt,0)-(i+1)*Math.sin((i+1)*(t+dt))
      expect(Math.abs(r)).toBeLessThan(1e-9)
    }
    expect(chainMatrices().K[0][0]).toBe(30)
  })
  it('planar beam converges toward the small-deflection cantilever tip solution',()=>{
    const error=(nodes:number)=>{
      const beam=new PlanarBeam({nodes,length:1,young:1e6,radius:.1,density:1,gravity:0,damping:.1})
      const F=.001,load=new Array(beam.q.length).fill(0);load[load.length-1]=-F
      expect(beam.solve(load).converged).toBe(true)
      const effectiveLength=1-beam.rest, analytical=-F*effectiveLength**3/(3*beam.ei)
      return Math.abs(beam.q.at(-1)!/analytical-1)
    }
    const coarse=error(20), fine=error(60)
    expect(fine).toBeLessThan(coarse)
    expect(fine).toBeLessThan(.03)
  })
  it('prescribed clamped coordinates update transactionally and leave free DOFs free',()=>{
    const beam=new PlanarBeam({nodes:12,length:1,young:1e7,radius:.01,density:1000,gravity:0,damping:.1,fixedNodes:[0,1,10,11]})
    const initial=[...beam.q],load=new Array(beam.q.length).fill(0);load[11]=.001
    expect(beam.solve(load,undefined,{prescribed:{20:initial[20]-.00001,22:initial[22]-.00001},pseudoTimeStep:.01}).converged).toBe(true)
    expect(beam.q.slice(0,4)).toEqual(initial.slice(0,4))
    expect(beam.q[20]).toBeCloseTo(initial[20]-.00001,12);expect(beam.q[22]).toBeCloseTo(initial[22]-.00001,12)
    expect(beam.q[11]).toBeGreaterThan(0);expect(beam.time).toBeCloseTo(.01,12)
    const committed=[...beam.q];expect(()=>beam.solve(load,undefined,{prescribed:{4:0}})).toThrow();expect(beam.q).toEqual(committed)
  })
  it('both original planar loading paths run through their full durations and snap switches side',()=>{
    const casesToTest=[new PrescribedBeam('buckling',{nodes:40,stiffness:10,load:1,damping:.1}),new PrescribedBeam('snap',{nodes:40,stiffness:10,load:1,damping:.1})]
    for(const model of casesToTest){
      const steps=model.kind==='buckling'?1000:2000
      for(let i=0;i<steps;i++){
        const result=model.step(.01);expect(result.converged,`${model.kind} failed at ${i+1}, residual ${result.residual}`).toBe(true)
        if(model.kind==='snap'&&i===1399)expect(model.beam.q[39]).toBeGreaterThan(.1)
        if(model.kind==='snap'&&i===1599)expect(model.beam.q[39]).toBeLessThan(-.1)
      }
      expect(model.beam.time).toBeCloseTo(steps*.01,8)
      expect(model.beam.q.every(Number.isFinite)).toBe(true)
    }
  },30000)
  it.each([.5,1.5,2])('quasi-static continuation follows the positive branch at load scale %s',scale=>{
    const model=new PrescribedBeam('buckling',{nodes:40,stiffness:10,load:scale,damping:.1})
    for(let i=0;i<300;i++)expect(model.step(.01).converged,`scale ${scale}, step ${i+1}`).toBe(true)
    expect(model.beam.q[39]).toBeGreaterThan(.08);expect(model.beam.time).toBeCloseTo(3,8)
  },30000)
  it('rewind restores the path-dependent load state and produces the same continuation',()=>{
    for(const id of ['beam-buckling','beam-snap']) {
      const item=cases.find(c=>c.id===id)!,sim=new Simulation(item,defaultsFor(item))
      for(let i=0;i<149;i++)sim.step(.01)
      const state=sim.snapshot()
      for(let i=0;i<60;i++)sim.step(.01)
      const expected=sim.snapshot()
      sim.restore(state);for(let i=0;i<60;i++)sim.step(.01)
      const actual=sim.snapshot()
      expect(actual.beamQ).toEqual(expected.beamQ);expect(actual.beamV).toEqual(expected.beamV);expect(actual.prescribedBeam).toEqual(expected.prescribedBeam)
    }
  },30000)
  it('hyperelastic cable reaches one second with fixed ends and 1 ms internal steps',()=>{
    const item=cases.find(c=>c.id==='hyper-cable')!,sim=new Simulation(item,defaultsFor(item)),initial=sim.frame()
    for(let i=0;i<100;i++){sim.step(.01);expect(sim.converged).toBe(true)}
    const result=sim.frame();expect(result.time).toBeCloseTo(1,9);expect(result.displacement).toBeCloseTo(-.63162313,6)
    expect(result.positions[0]).toEqual(initial.positions[0]);expect(result.positions.at(-1)).toEqual(initial.positions.at(-1));expect(result.isApproximation).toBe(false)
  },30000)
  it('default physical cantilever steps without violating its clamped boundary',()=>{
    const beam=new PlanarBeam({nodes:18,length:1,young:1e8,radius:.01,density:1000,gravity:10,damping:.1})
    const fixed=beam.q.slice(0,4)
    for(let i=0;i<20;i++) expect(beam.step(.01).converged).toBe(true)
    expect(beam.q.slice(0,4)).toEqual(fixed)
    expect(beam.q.at(-1)!).toBeLessThan(0)
  })
})

describe('example coverage and Rust/WASM contract',()=>{
  it('all 21 paper examples are present and have source paths',()=>{
    expect(cases).toHaveLength(21); expect(new Set(cases.map(x=>x.id)).size).toBe(21)
    cases.forEach(item=>{expect(item.path.length).toBeGreaterThan(5);expect(item.limitation.length).toBeGreaterThan(8)})
  })
  it.each(cases.map(c=>[c.id,c] as const))('%s initializes and remains finite when stepped',(_id,item)=>{
    const sim=new Simulation(item,defaultsFor(item)), before=sim.frame()
    expect(before.positions.length).toBeGreaterThan(1)
    for(let i=0;i<15;i++) sim.step(.01)
    const after=sim.frame()
    expect(after.converged).toBe(true)
    expect(after.time).toBeCloseTo(.15,6)
    expect(after.positions.flat().every(Number.isFinite)).toBe(true)
    expect(after.positions.some((p,i)=>p.some((v,j)=>Math.abs(v-before.positions[i][j])>1e-9))).toBe(true)
  })
  it.each(cases.map(c=>[c.id,c] as const))('%s stays bounded for its duration (up to 3 seconds) and responds to its load control',(_id,item)=>{
    const params=defaultsFor(item), loaded=new Simulation(item,params), unloaded=new Simulation(item,{...params,load:0})
    for(let i=0;i<Math.min(300,Math.round((item.duration??3)/.01));i++){loaded.step(.01);if(i<60)unloaded.step(.01)}
    const result=loaded.frame()
    expect(result.converged).toBe(true)
    expect(result.positions.flat().every(x=>Number.isFinite(x)&&Math.abs(x)<20)).toBe(true)
    // Compare both models at the same time; this is sensitivity, not a reference-solution test.
    const short=new Simulation(item,params);for(let i=0;i<60;i++)short.step(.01)
    const a=short.frame().positions,b=unloaded.frame().positions
    expect(a.some((p,i)=>p.some((v,j)=>Math.abs(v-b[i][j])>1e-8))).toBe(true)
  },30000)
  it('reference comparisons expose strict mismatches without hiding compatible replay',async()=>{
    // Yield between expensive trajectories so a slow/contended runner can keep
    // the Vitest worker and its timeout/RPC machinery responsive.
    const comparisons=[]
    for(const result of referenceChecks()){comparisons.push(result);await new Promise(resolve=>setTimeout(resolve,0))}
    expect(comparisons).toHaveLength(12)
    expect(comparisons.filter(c=>c.pass)).toHaveLength(10)
    const net=comparisons.find(c=>c.id==='net-gravity')!;expect(net.pass).toBe(true);expect(net.maxError).toBeLessThan(1e-6);expect(net.detail).toContain('稀疏向量化装配')
    const disk=comparisons.find(c=>c.id==='axis-inflate')!,cap=comparisons.find(c=>c.id==='axis-snap')!
    expect(disk.pass).toBe(true);expect(disk.compatibility?.pass).toBe(true)
    expect(cap.pass).toBe(true);expect(cap.compatibility?.pass).toBe(true)
    if(axisShellReferenceWindows.eversion<4.1)expect(cap.detail).toContain('尚未覆盖')
    // A separate seeded local replay crosses the fold and demonstrably disagrees;
    // never let the early-window PASS mask this conditional failure.
    expect(cap.conditional?.pass).toBe(false)
    expect(cap.conditional?.strictError).toBeGreaterThan(.1)
    expect(cap.conditional?.sourceLimits).toBe(7)
    expect(cap.conditional?.sourceUnconverged).toBe(6)
    expect(cap.conditional?.detail).toContain('不是独立全程')
    const snap=comparisons.find(c=>c.id==='beam-snap')!,buckling=comparisons.find(c=>c.id==='beam-buckling')!
    expect(snap.pass).toBe(false);expect(snap.maxError).toBeGreaterThan(snap.threshold)
    expect(snap.compatibility?.pass).toBe(true);expect(snap.compatibility?.reachedLimit).toBe(1);expect(snap.compatibility?.unconverged).toBe(0)
    expect(buckling.pass).toBe(true);expect(buckling.compatibility?.pass).toBe(true);expect(buckling.compatibility?.reachedLimit).toBe(3);expect(buckling.compatibility?.unconverged).toBe(2)
    const membrane=comparisons.find(c=>c.id==='hyper-membrane')!,swim=comparisons.find(c=>c.id==='robot-swim')!,magnetic=comparisons.find(c=>c.id==='robot-magnetic')!
    expect(membrane.pass).toBe(true);expect(membrane.compatibility?.pass).toBe(true)
    expect(swim.pass).toBe(false);expect(swim.maxError).toBeGreaterThan(swim.threshold);expect(swim.compatibility?.pass).toBe(true)
    expect(magnetic.pass).toBe(true);expect(magnetic.compatibility?.pass).toBe(true)
    expect(referenceMetadata.reference_commit).toBe('20d732f3fffdd5137eee720e46175de3a98016c6')
    expect(planarReferenceMetadata.reference_commit).toBe(referenceMetadata.reference_commit)
    expect(hyperReferenceMetadata.reference_commit).toBe(referenceMetadata.reference_commit)
  },180000)
  it('compiled Rust WASM exports agree with JS kernels',async()=>{
    const bytes=readFileSync('public/ddg_core.wasm')
    const {instance}=await WebAssembly.instantiate(bytes,{})
    const e=instance.exports as unknown as typeof jsKernels
    expect(e.stretch_energy(1.2,1,8)).toBeCloseTo(jsKernels.stretch_energy(1.2,1,8),12)
    expect(e.stretch_dedl(1.2,1,8)).toBeCloseTo(jsKernels.stretch_dedl(1.2,1,8),12)
    expect(e.turning_curvature(1,0,0,1)).toBeCloseTo(2,12)
    expect(e.sdof_step(1,.2,1,.1,10,1,.4,.01)).toBeCloseTo(jsKernels.sdof_step(1,.2,1,.1,10,1,.4,.01),12)
  })
})
