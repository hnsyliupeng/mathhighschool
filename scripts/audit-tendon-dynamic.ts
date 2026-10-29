import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {CompiledTendonManifold,TendonDynamicGrasp,defaultTendonDynamicParams,summarizeTendonDynamic,type FingerManifold,type TendonDynamicFrame} from '../src/engine/tendon-dynamic-grasp'
import type {MaterialObjectId} from '../src/engine/material-grasp3d'

const args=process.argv.slice(2),value=(key:string,defaultValue:string)=>{const i=args.indexOf(key);return i<0?defaultValue:args[i+1]}
const id=value('--id','egg') as MaterialObjectId,params=defaultTendonDynamicParams(id)
params.scale=Number(value('--scale','1'));params.stiffnessScale=Number(value('--stiffness','1'));params.offsetX=Number(value('--offset',String(params.offsetX)));params.pull=Number(value('--pull',String(params.pull)));params.driveStiffness=Number(value('--drive',String(params.driveStiffness)));params.friction=Number(value('--friction',String(params.friction)));params.dt=Number(value('--dt',String(params.dt)));params.iterations=Number(value('--iterations',String(params.iterations)));params.duration=Number(value('--duration',String(params.duration)));params.lift=Number(value('--lift',String(params.lift)));params.verifyCCD=!args.includes('--no-ccd')
const end=Math.min(params.duration,Number(value('--end',String(params.duration))))
const sourceFiles=['src/engine/tendon-dynamic-grasp.ts','src/engine/material-grasp3d.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/bionic-hand3d.ts','src/data/tendon-grasp-manifold.json','scripts/audit-tendon-dynamic.ts']
const sourceHash=()=>{const h=createHash('sha256');for(const f of sourceFiles)h.update(f).update(readFileSync(f));return h.digest('hex')},startingHash=sourceHash()
const data=JSON.parse(readFileSync('src/data/tendon-grasp-manifold.json','utf8')) as FingerManifold,compiled=new CompiledTendonManifold(data),started=Date.now(),history:TendonDynamicFrame[]=[]
let error='',attempted:unknown,mesh:unknown,fixtureNodes:number[]=[]
const captured:TendonDynamicFrame[]=[];let nextCapture=0
try{
  const sim=new TendonDynamicGrasp(data,params,compiled);mesh=sim.mesh;fixtureNodes=sim.fixtureNodes;history.push(sim.last);captured.push(sim.last);nextCapture=.2;let tick=0
  while(sim.time<end-1e-10){
    const frame=sim.step()
    if(!frame.finite){error=frame.message||'failed';attempted=frame.attempted;console.log('FAILED',JSON.stringify(frame.attempted));break}
    history.push(frame)
    if(frame.time+1e-10>=nextCapture||frame.phase==='finished'){captured.push(frame);nextCapture+=.2}
    if(++tick%24===0||sim.time>=params.duration-1e-10)console.log('FRAME',JSON.stringify({t:+frame.time.toFixed(4),p:frame.fingers.map(f=>+(f.pull*1000).toFixed(3)),riseMm:+(frame.rise*1000).toFixed(2),wristMm:+(frame.wristRise*1000).toFixed(2),contacts:frame.contactFingers,thumb:frame.thumbContact,forces:frame.normalForces.map(f=>+f.toFixed(3)),maxPenMm:+(frame.maxPenetration*1000).toFixed(4),residualMm:+(frame.maxContactResidual*1000).toFixed(4),strain:+frame.maxStructuralStrain.toFixed(3),substeps:frame.substeps,ccd:frame.verifiedCCD,checks:frame.ccdChecks}))
  }
}catch(e){error=e instanceof Error?e.message:String(e);console.log('ERROR',error)}
const endingHash=sourceHash(),sourceChanged=startingHash!==endingHash
if(sourceChanged)error=`源文件在计算期间发生改变，本报告无效${error?`；${error}`:''}`
const summary=summarizeTendonDynamic(history)
const report={params,requestedEnd:end,sourceHash:startingHash,sourceChanged,sourceFiles,referenceHash:data.sourceHash,steps:history.length-1,elapsedSeconds:(Date.now()-started)/1000,error,attempted,summary,certifiedEveryAcceptedStep:params.verifyCCD&&history.slice(1).every(f=>f.verifiedCCD),history:history.map(f=>({time:f.time,rise:f.rise,wristRise:f.wristRise,pulls:f.fingers.map(x=>x.pull),contactFingers:f.contactFingers,thumb:f.thumbContact,forces:f.normalForces,maxPenetration:f.maxPenetration,maxStructuralStrain:f.maxStructuralStrain,verifiedCCD:f.verifiedCCD,ccdChecks:f.ccdChecks,interFingerChecks:f.interFingerChecks}))}
console.log('RESULT',JSON.stringify({...report,history:undefined}))
const output=value('--out','');if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n')
const snapshots=value('--snapshots','');if(snapshots)writeFileSync(snapshots,JSON.stringify({params,sourceHash:report.sourceHash,referenceHash:data.sourceHash,mesh,fixtureNodes,frames:captured,error})+'\n')
if(error)process.exitCode=1
