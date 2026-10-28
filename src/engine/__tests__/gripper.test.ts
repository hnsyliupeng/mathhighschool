import {describe,it,expect} from 'vitest'
import {defaultGripperParams,makeGripperMesh,neoHookeanTriangle,tendonLengthEnergy,deformableGuideContact,TendonGripper,type Point2} from '../gripper'

function finiteDifference(x:number[],evaluate:(q:number[],h:boolean)=>{energy:number;gradient:number[];hessian:number[]},h=1e-7){
  const initial=evaluate(x,true);let energyError=0,hessianError=0
  for(let j=0;j<x.length;j++){
    const plus=[...x],minus=[...x];plus[j]+=h;minus[j]-=h
    const a=evaluate(plus,false),b=evaluate(minus,false)
    energyError=Math.max(energyError,Math.abs((a.energy-b.energy)/(2*h)-initial.gradient[j]))
    for(let i=0;i<x.length;i++)hessianError=Math.max(hessianError,Math.abs((a.gradient[i]-b.gradient[i])/(2*h)-initial.hessian[i*x.length+j]))
  }
  return {energyError,hessianError}
}
function run(pull=.004,k=5000){const sim=new TendonGripper({...defaultGripperParams,pull,contactStiffness:k});for(let i=1;i<=20;i++){const result=sim.step(pull*i/20);expect(result.converged,result.message).toBe(true)}return sim}

describe('tendon-driven hyperelastic finger',()=>{
  it('builds five teeth and four embedded guide sections',()=>{
    const mesh=makeGripperMesh();expect(mesh.reference).toHaveLength(103);expect(mesh.triangles).toHaveLength(140)
    expect(mesh.guideWalls).toHaveLength(4);expect(mesh.fixed.length).toBeGreaterThanOrEqual(3)
  })
  it('has zero solid energy and stress under rigid translation and rotation',()=>{
    const mesh=makeGripperMesh(),tri=mesh.triangles[0],angle=.8,c=Math.cos(angle),s=Math.sin(angle)
    const transformed=mesh.reference.map(([x,y]):Point2=>[c*x-s*y+.013,s*x+c*y-.03])
    const e=neoHookeanTriangle(transformed,tri,250000,.35,.008)
    expect(Math.abs(e.energy)).toBeLessThan(1e-14);expect(Math.max(...e.gradient.map(Math.abs))).toBeLessThan(1e-10)
    expect(e.J).toBeCloseTo(1,12);expect(e.vonMises).toBeLessThan(1e-8)
  })
  it('matches the neo-Hookean gradient and consistent tangent to centered differences',()=>{
    const mesh=makeGripperMesh(),tri=mesh.triangles[0],x=tri.nodes.flatMap(i=>mesh.reference[i]);x[2]+=.0003;x[5]+=.0006
    const error=finiteDifference(x,(q,h)=>neoHookeanTriangle([[q[0],q[1]],[q[2],q[3]],[q[4],q[5]]],{...tri,nodes:[0,1,2]},250000,.35,.008,h))
    expect(error.energyError).toBeLessThan(2e-8);expect(error.hessianError).toBeLessThan(2e-5)
  })
  it('rejects inverted triangles',()=>{
    const mesh=makeGripperMesh(),tri=mesh.triangles[0],p=mesh.reference.map(x=>[...x] as Point2)
    ;[p[tri.nodes[1]],p[tri.nodes[2]]]=[p[tri.nodes[2]],p[tri.nodes[1]]]
    expect(()=>neoHookeanTriangle(p,tri,250000,.35,.008)).toThrow(/Inverted/)
  })
  it('models a slack cable and equal tension based on total length, not locked per-segment lengths',()=>{
    const points:Point2[]=[[0,0],[.011,0],[.033,0],[.048,0]]
    expect(tendonLengthEnergy(points,.05,30).tension).toBe(0)
    const first=tendonLengthEnergy(points,.047,30),second=tendonLengthEnergy([[0,0],[.014,0],[.029,0],[.048,0]],.047,30)
    expect(first.energy).toBeCloseTo(second.energy,14);expect(first.tension).toBeCloseTo(second.tension,14)
    expect(first.gradient[2]).toBeCloseTo(0,12);expect(first.gradient[4]).toBeCloseTo(0,12)
    const x=[0,0,.016,.001,.032,.002,.048,.004]
    const error=finiteDifference(x,(q,h)=>tendonLengthEnergy(Array.from({length:4},(_,i):Point2=>[q[2*i],q[2*i+1]]),.047,30,h))
    expect(error.energyError).toBeLessThan(1e-8);expect(error.hessianError).toBeLessThan(2e-5)
  })
  it('couples clearance changes to the deforming solid wall with a consistent tangent',()=>{
    const x=[0,.0105,.008,.0107,.004,.007,.004,.014,.0008]
    const evaluate=(q:number[],h:boolean)=>deformableGuideContact([q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]],q[8],.007,.0004,5000,h)
    const before=evaluate(x,true),opened=[...x];opened[7]+=.001;const after=evaluate(opened,true)
    expect(before.penetration).toBeGreaterThan(0);expect(after.clearance).toBeGreaterThan(before.clearance);expect(after.magnitude).toBeLessThan(before.magnitude)
    const error=finiteDifference(x,evaluate,1e-8);expect(error.energyError).toBeLessThan(2e-8);expect(error.hessianError).toBeLessThan(2e-4)
  })
  it('assembles a consistent tangent including moving guide orientation and contact',()=>{
    const sim=run(.002),q=sim.q,all=sim.evaluate(),dofs=[sim.actuatorDof,...sim.stationDofs,...[...sim.mesh.guideWalls,...sim.mesh.guideSpans].flatMap(pair=>pair.flatMap(i=>[2*i,2*i+1]))]
    let gError=0,hError=0;const eps=1e-7
    for(const j of dofs){const p=new Float64Array(q),m=new Float64Array(q);p[j]+=eps;m[j]-=eps;const A=sim.evaluate(p),B=sim.evaluate(m)
      gError=Math.max(gError,Math.abs((A.energy-B.energy)/(2*eps)-all.gradient[j]))
      for(const i of dofs)hError=Math.max(hError,Math.abs((A.gradient[i]-B.gradient[i])/(2*eps)-all.H![i*q.length+j]))
    }
    expect(gError).toBeLessThan(2e-7);expect(hError).toBeLessThan(.002)
  })
  it('activates unilateral contact and transmits balanced forces to the hyperelastic body',()=>{
    const sim=run(),frame=sim.last,evals=sim.evaluate()
    expect(frame.activeContacts).toBeGreaterThan(0);expect(frame.tipDeflection).toBeGreaterThan(.005);expect(frame.tension).toBeGreaterThan(.01)
    expect(frame.maxPenetration).toBeLessThan(.01*sim.params.clearance);expect(frame.minJ).toBeGreaterThan(.9);expect(frame.residual).toBeLessThan(2e-7)
    for(const c of frame.contacts){expect(c.magnitude).toBeCloseTo(sim.params.contactStiffness*c.penetration,10);expect(Math.hypot(...c.force)).toBeCloseTo(c.magnitude,10)}
    const support=sim.mesh.fixed.reduce((a,id)=>[a[0]+evals.gradient[2*id],a[1]+evals.gradient[2*id+1]],[0,0])
    expect(Math.hypot(support[0]+frame.actuatorForce[0],support[1]+frame.actuatorForce[1])).toBeLessThan(2e-7)
    expect(Math.max(...frame.contacts.map(c=>Math.abs(c.sectionReaction)))/frame.tension).toBeLessThan(.01)
  })
  it('changes the solved path when guide contact is removed by a wide clearance',()=>{
    const coupled=run().last,free=new TendonGripper({...defaultGripperParams,clearance:.01})
    for(let i=1;i<=20;i++)expect(free.step(.0002*i).converged).toBe(true)
    expect(free.last.activeContacts).toBe(0);expect(free.last.maxPenetration).toBe(0)
    expect(coupled.activeContacts).toBeGreaterThan(0);expect(Math.abs(coupled.tension-free.last.tension)).toBeGreaterThan(.03)
  })
  it('tracks penalty stiffness sensitivity rather than treating penetration as zero',()=>{
    const low=run(.004,2500).last,high=run(.004,10000).last
    expect(high.maxPenetration).toBeLessThan(low.maxPenetration/2)
    expect(Math.abs(high.tipDeflection-low.tipDeflection)).toBeLessThan(2e-5)
    expect(Math.abs(high.tension-low.tension)).toBeLessThan(.002)
  })
  it('unloads to the undeformed equilibrium without plasticity or friction',()=>{
    const sim=run()
    for(let i=19;i>=0;i--)expect(sim.step(i*.0002).converged).toBe(true)
    expect(Math.abs(sim.last.tipDeflection)).toBeLessThan(2e-8);expect(sim.last.tension).toBeLessThan(1e-6);expect(sim.last.activeContacts).toBe(0);expect(sim.last.minJ).toBeCloseTo(1,6)
  })
  it('rejects invalid inputs and leaves the last converged state unchanged on failed steps',()=>{
    expect(()=>new TendonGripper({...defaultGripperParams,poisson:.5})).toThrow(/Invalid/)
    expect(()=>tendonLengthEnergy([[0,0],[1,0]],0,1)).toThrow(/Invalid/)
    expect(()=>deformableGuideContact([0,0],[1,0],[0,0],[0,1],NaN,1,.1,1)).toThrow(/Invalid/)
    const sim=run(.002),old=sim.q.slice(),before=sim.pull,failed=sim.step(.01)
    expect(failed.converged).toBe(false);expect(sim.pull).toBe(before);expect(Array.from(sim.q)).toEqual(Array.from(old))
  })
})
