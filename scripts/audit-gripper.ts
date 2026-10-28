// Numerical audit of the custom tendon-driven gripper. This is not experimental validation.
import {writeFileSync} from 'node:fs'
import {defaultGripperParams,TendonGripper,type GripperParams} from '../src/engine/gripper'

function run(overrides:Partial<GripperParams>={},unload=false){
  const solver=new TendonGripper({...defaultGripperParams,...overrides}),count=Math.ceil(solver.params.pull/.0002)
  let maxResidual=0,maxIterations=0
  for(let i=1;i<=count;i++){
    const frame=solver.step(Math.min(solver.params.pull,i*.0002));if(!frame.converged)throw Error(`load ${i}: ${frame.message}`)
    maxResidual=Math.max(maxResidual,frame.residual);maxIterations=Math.max(maxIterations,frame.iterations)
  }
  const loaded=solver.last,assembled=solver.evaluate(),support=solver.mesh.fixed.reduce((a,i)=>[a[0]+assembled.gradient[2*i],a[1]+assembled.gradient[2*i+1]],[0,0])
  const balance=Math.hypot(support[0]+loaded.actuatorForce[0],support[1]+loaded.actuatorForce[1])
  if(unload)for(let i=count-1;i>=0;i--){const frame=solver.step(solver.params.pull*i/count);if(!frame.converged)throw Error(`unload ${i}: ${frame.message}`)}
  return {solver,loaded,maxResidual,maxIterations,balance,unloaded:unload?solver.last:null}
}
const basic=run({},true),penaltyLow=run({contactStiffness:2500}),penaltyHigh=run({contactStiffness:10000}),noContact=run({clearance:.01}),fine=run({cellsPerTooth:8})
const boundaryConfigs:Partial<GripperParams>[]= [
  {young:100000,pull:.008,clearance:.0002,contactStiffness:2000,cableEA:60},
  {young:500000,pull:.008,clearance:.0002,contactStiffness:2000,cableEA:60},
  {young:500000,pull:.008,clearance:.001,contactStiffness:20000,cableEA:10},
  {young:100000,pull:.001,clearance:.001,contactStiffness:20000,cableEA:10},
  {young:500000,pull:.008,clearance:.0002,contactStiffness:20000,cableEA:60},
]
const compact=(r:ReturnType<typeof run>)=>({nodes:r.solver.mesh.reference.length,triangles:r.solver.mesh.triangles.length,pull_mm:r.loaded.pull*1e3,tip_mm:r.loaded.tipDeflection*1e3,tension_N:r.loaded.tension,max_stress_kPa:r.loaded.maxStress/1000,min_J:r.loaded.minJ,contacts:r.loaded.activeContacts,max_penetration_um:r.loaded.maxPenetration*1e6,max_penetration_to_clearance:Math.max(...r.loaded.contacts.map(c=>c.penetration/c.clearance)),max_section_reaction_N:Math.max(...r.loaded.contacts.map(c=>Math.abs(c.sectionReaction))),max_residual_N:r.maxResidual,max_iterations:r.maxIterations,external_force_balance_N:r.balance})
const b=compact(basic),lo=compact(penaltyLow),hi=compact(penaltyHigh),free=compact(noContact),f=compact(fine)
const boundary=boundaryConfigs.map(params=>({params,...compact(run(params))}))
const unloaded=basic.unloaded!
const checks={defaultContact:b.contacts>0,positiveDeterminants:b.min_J>0,forceBalance:b.external_force_balance_N<2e-7,smallDefaultPenetration:b.max_penetration_to_clearance<.01,penaltySensitivity:hi.max_penetration_um<lo.max_penetration_um/2,noContactResponds:free.contacts===0&&Math.abs(b.tension_N-free.tension_N)>.03,unloadingRecovery:Math.abs(unloaded.tipDeflection)<2e-8&&unloaded.tension<1e-6&&unloaded.activeContacts===0,boundariesConverged:boundary.every(x=>x.min_J>0)}
const report={date:new Date().toISOString().slice(0,10),checks,default:b,penalty_2500:lo,penalty_10000:hi,no_contact_large_clearance:free,mesh_refined:f,mesh_change_percent:{tip:100*(f.tip_mm/b.tip_mm-1),tension:100*(f.tension_N/b.tension_N-1)},unloading:{tip_mm:unloaded.tipDeflection*1e3,tension_N:unloaded.tension,active_contacts:unloaded.activeContacts,min_J:unloaded.minJ},boundary_cases:boundary,
  scope:'Reduced plane-strain Neo-Hookean solid and deformable-clearance guide sections; bores are not meshed, no 3-D bore contact, friction, object contact, dynamics or experimental reference. Mesh sensitivity is substantial; these checks do not validate engineering predictions.'}
writeFileSync('docs/screenshots/gripper-numerical-audit.json',JSON.stringify(report,null,2)+'\n')
if(process.argv.includes('--snapshot')){
  const out=process.argv[process.argv.indexOf('--snapshot')+1];if(!out)throw Error('Missing --snapshot path')
  // Re-run loaded state because basic has subsequently been unloaded.
  const s=run().solver,e=s.evaluate()
  writeFileSync(out,JSON.stringify({params:s.params,mesh:s.mesh,q:Array.from(s.q),stationDofs:s.stationDofs,actuatorDof:s.actuatorDof,restLengths:s.restLengths,free:s.free,expected:{energy:e.energy,gradient:Array.from(e.gradient),tip:s.last.tipDeflection,tension:s.last.tension}}))
}
console.log(JSON.stringify(report,null,2))
if(Object.values(checks).some(x=>!x))process.exitCode=1
