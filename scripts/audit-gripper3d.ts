/* Reproducible numerical audit. The independent NumPy check is a separate script.
 * Run: npx vite-node scripts/audit-gripper3d.ts [--snapshot /tmp/gripper3d-snapshot.json]
 * Full mesh comparison is intentionally not called a convergence proof. */
import {writeFileSync} from 'node:fs'
import {TendonGripper3D,defaultGripper3DParams,type Gripper3DParams,type Frame3D} from '../src/engine/gripper3d'

const assert=(x:unknown,m:string)=>{if(!x)throw Error(m)}
function run(name:string,patch:Partial<Gripper3DParams>={},unload=false){
  const params={...defaultGripper3DParams,...patch},solver=new TendonGripper3D(params),frames:Frame3D[]=[solver.last],n=Math.ceil(params.pull/params.step)
  for(let i=1;i<=n;i++){const f=solver.step(Math.min(params.pull,i*params.step));assert(f.converged,`${name}: ${f.message} at ${i}`);frames.push(f)}
  if(unload)for(let i=n-1;i>=0;i--){const f=solver.step(Math.min(params.pull,i*params.step));assert(f.converged,`${name} unload: ${f.message} at ${i}`);frames.push(f)}
  const f=frames.at(-1)!,stats={name,params,nodes:solver.mesh.reference.length,tets:solver.mesh.tets.length,wallTriangles:solver.mesh.walls.length,states:frames.length,tipMm:f.tipDeflection*1e3,tensionN:f.tension,activeSamples:f.contacts.length,contactSumN:f.contactForce,sampledPenetrationUm:f.maxPenetration*1e6,checkPenetrationUm:f.checkPenetration*1e6,minJ:f.minJ,maxStressKPa:f.maxStress/1e3,anchorSlipUm:f.anchorSlip*1e6,maxResidualN:Math.max(...frames.map(x=>x.residual)),maxBalanceErrorN:Math.max(...frames.map(x=>x.forceBalance)),finalResidualN:f.residual,negativeSignedContacts:f.contacts.filter(c=>c.gap<0).length}
  console.log(name,JSON.stringify(stats));return {solver,frames,stats}
}
const base=run('standard-12'),fine=run('refined-12',{meshLevel:2}),coarseSamples=run('standard-4',{samples:4})
// Counterfactual to isolate contact, not a physically calibrated cable.
const noContact=run('near-zero-radius-isolation',{radius:.000001})
const soft=run('soft-100kPa',{young:100000,pull:.001}),stiff=run('stiff-500kPa',{young:500000,pull:.001})
const lowPenalty=run('penalty-2MN',{contactPerLength:2e6,pull:.001}),highPenalty=run('penalty-8MN',{contactPerLength:8e6,pull:.001})
const unload=run('load-unload-1mm',{pull:.001},true)
const tipChangePercent=(fine.stats.tipMm/base.stats.tipMm-1)*100,tensionChangePercent=(fine.stats.tensionN/base.stats.tensionN-1)*100
const checks={
  defaultPath:base.frames.length===13&&base.stats.activeSamples>0&&base.stats.minJ>0&&base.stats.maxResidualN<2e-5,
  twoWayBalance:base.stats.maxBalanceErrorN<2e-5,
  contactChangesEquilibrium:noContact.stats.activeSamples===0&&Math.abs(noContact.stats.tensionN-base.stats.tensionN)>.01,
  penaltyPenetrationReduces:highPenalty.stats.sampledPenetrationUm<lowPenalty.stats.sampledPenetrationUm,
  materialResponse:stiff.stats.tensionN>soft.stats.tensionN&&stiff.stats.tipMm<soft.stats.tipMm,
  unloadingRecovery:Math.abs(unload.stats.tipMm)<.02&&unload.stats.tensionN<.0001,
  separateDenseCheckExposesMissedPenetration:coarseSamples.stats.checkPenetrationUm>coarseSamples.stats.sampledPenetrationUm*2,
  gridConverged:Math.abs(tipChangePercent)<5&&Math.abs(tensionChangePercent)<5,
}
for(const [key,value] of Object.entries(checks))if(key!=='gridConverged')assert(value,`Failed audit: ${key}`)
const report={date:new Date().toISOString().slice(0,10),description:'3-D explicit-bore coupled quasi-static model; assumed parameters, not experimental validation',checks,tipChangePercent,tensionChangePercent,results:[base.stats,fine.stats,coarseSamples.stats,noContact.stats,soft.stats,stiff.stats,lowPenalty.stats,highPenalty.stats,unload.stats]}
writeFileSync('docs/screenshots/gripper3d-numerical-audit.json',JSON.stringify(report,null,2)+'\n')
const index=process.argv.indexOf('--snapshot');if(index>=0){const A=base.solver.evaluate();writeFileSync(process.argv[index+1],JSON.stringify({params:base.solver.params,mesh:base.solver.mesh,q:Array.from(base.solver.q),energy:A.energy,gradient:Array.from(A.gradient),frame:base.solver.last,fixed:Array.from(base.solver.fixedDofs)}))}
console.log('PASS (gridConverged is deliberately reported separately)',JSON.stringify(checks))
