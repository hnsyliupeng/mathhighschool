/** Research-only single-finger comparison; failure is the recorded outcome. */
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {ObjectFinger3D} from '../experiments/multi-object/multifeature-finger'
const data=JSON.parse(readFileSync('/tmp/multi-object-rounded-box-snapshot.json','utf8')),s=data.snapshots.find((f:any)=>f.case==='middle')
if(!s)throw Error('Run the rounded-box audit to obtain a middle-finger snapshot')
const f=new ObjectFinger3D(s.params,s.object),history=[]
for(let i=1;i<=12;i++){
  const start=Date.now(),result=f.step(i*.00025)
  history.push({step:i,targetMm:i*.25,acceptedMm:f.pull*1000,converged:result.converged,contacts:result.objectContacts.length,residualN:result.residual,seconds:(Date.now()-start)/1000,message:result.message||null})
  console.log('STEP',JSON.stringify(history.at(-1)))
  if(!result.converged)break
}
const files=['experiments/multi-object/multifeature-finger.ts','scripts/experiment-multi-object-box-features.ts','src/engine/object-finger3d.ts','src/engine/rounded-object-contact.ts','src/engine/gripper3d.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts'],hash=createHash('sha256')
for(const file of files)hash.update(file).update(readFileSync(file))
const report={codeHash:hash.digest('hex'),sourceFiles:files,sourceSnapshotCodeHash:data.codeHash,history,integratedIntoGui:false,scope:'Experimental 12-feature rectangular-core contact; one middle finger only, not a verified replacement or free grasp.'}
writeFileSync('docs/screenshots/multi-object-box-feature-experiment.json',JSON.stringify(report,null,2)+'\n')
console.log('REPORT',JSON.stringify({acceptedMm:f.pull*1000,failed:!history.at(-1)?.converged,residualN:history.at(-1)?.residualN}))
