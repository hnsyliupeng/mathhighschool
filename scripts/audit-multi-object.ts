/** Reproducible comparison for one prescribed, fixed object. Results describe
 * only this mesh, loading path and support assumption; they are not a free
 * grasp/force-closure certificate. */
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {ObjectHand3D,type ObjectHandFrame} from '../src/engine/object-hand3d'
import {createGraspObject,OBJECT_PRESETS,type ObjectPresetId} from '../src/engine/object-presets3d'
import {FINGERS,worldPoint,worldVector} from '../src/engine/bionic-hand3d'
import type {Vec3} from '../src/engine/gripper3d'

const args=process.argv.slice(2),value=(flag:string,fallback:string)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1]}
const id=value('--id','ball90') as ObjectPresetId,scale=Number(value('--scale','1')),target=Number(value('--target','6.75'))
if(!OBJECT_PRESETS.some(p=>p.id===id)||!Number.isFinite(target)||target<0||target>14.75||Math.abs(target/.25-Math.round(target/.25))>1e-9)throw Error('Usage: --id ball60|ball90|ball110|capsule|rounded-box|dumbbell --scale 0.65..1.25 --target <mm, multiple of .25>')
const files=['src/engine/object-hand3d.ts','src/engine/object-finger3d.ts','src/engine/rounded-object-contact.ts','src/engine/object-presets3d.ts','src/engine/bionic-hand3d.ts','src/engine/hand-object-contact.ts','src/engine/continuous-gripper3d.ts','src/engine/gripper3d.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts']
const hash=createHash('sha256');for(const file of files)hash.update(file).update(readFileSync(file))
const object=createGraspObject(id,scale),hand=new ObjectHand3D(object),history:ObjectHandFrame[]=[hand.last]
let failure:string|null=null
for(let i=1;i<=Math.round(target/.25);i++){
  const started=Date.now(),frame=hand.step(FINGERS.map(f=>i*.00025*f.scale))
  console.log(JSON.stringify({id,step:i,pullNormalizedMm:i*.25,seconds:(Date.now()-started)/1000,converged:frame.converged,objectContactFingers:frame.objectContactFingers,angles:frame.fingers.map(f=>f.local.tipAngleDeg),objectPenetrationUm:frame.maxObjectPenetration*1e6,tendonPenetrationUm:frame.maxTendonPenetration*1e6,message:frame.message}))
  if(!frame.converged){failure=frame.message||'unknown failure';break}
  history.push(frame)
}
const final=history.at(-1)!,frames=history.flatMap(h=>h.fingers)
const center:Vec3=[0,.045,object.supportHeight+object.dimensionsMm[2]/2000]
const moment:Vec3=[0,0,0]
for(let i=0;i<5;i++)for(const c of final.fingers[i].local.objectContacts){
  const point=worldPoint(FINGERS[i],c.point),force=worldVector(FINGERS[i],c.force,-(FINGERS[i].scale**2)),r=point.map((x,d)=>x-center[d]) as Vec3
  moment[0]+=r[1]*force[2]-r[2]*force[1];moment[1]+=r[2]*force[0]-r[0]*force[2];moment[2]+=r[0]*force[1]-r[1]*force[0]
}
const checks={
  reachedRequestedPull:history.length===Math.round(target/.25)+1,
  atLeastOneObjectContact:final.objectContactFingers>0,
  fiveTendonContactFingers:final.fingers.every(f=>f.local.contacts.length>0),
  fiveObjectContactFingers:final.objectContactFingers===5,
  residualAndBalance:frames.every(f=>f.local.residual<2e-5&&f.local.forceBalance<2e-5&&f.local.torqueBalance<2e-6),
  tendonKktAndPenetration:frames.every(f=>f.local.complementarity<=2e-8&&f.local.checkPenetration<=2e-8),
  objectKktAndPenetration:frames.every(f=>f.local.objectComplementarity<=2e-8&&f.local.objectPenetration<=2e-8),
  staticFingerChecks:frames.every(f=>f.local.selfIntersections===0&&f.local.volumeOverlaps===0&&f.local.interiorNodes===0&&f.local.surfaceIntersections===0),
  positivePathJacobianLowerBound:frames.every(f=>f.local.minPathJ>0),
  acceptedFrameInterFingerCCD:history.every(h=>h.converged),
}
const limitedPathChecksPass=Object.values(checks).every(Boolean)
const result={date:new Date().toISOString(),codeHash:hash.digest('hex'),sourceFiles:files,fixture:'fixed externally supported rigid object, frictionless; no gravity, no dynamics',object,normalizedTargetMm:target,acceptedSteps:history.length-1,acceptedNormalizedMm:(history.length-1)*.25,failure,checks,limitedPathChecksPass,strictGraspAcceptance:false,
  notValidated:['free object equilibrium and force closure','friction and gravity','finger-palm contact','inter-finger contact reactions','complete curved-face and continuum-interior CCD','mesh and tendon refinement for each shape','experimental calibration','full loading/unloading paths'],
  path:history.map(h=>({pullNormalizedMm:h.fingers[2].local.pull*1000,objectContactFingers:h.objectContactFingers,objectPenetrationUm:h.maxObjectPenetration*1e6,tendonPenetrationUm:h.maxTendonPenetration*1e6,reactionOnObjectN:h.objectReaction,anglesDeg:h.fingers.map(f=>f.local.tipAngleDeg),contacts:h.fingers.map(f=>f.local.objectContacts.length)})),
  final:{objectContacts:final.objectContactFingers,reactionOnObjectN:final.objectReaction,torqueOnObjectNm:moment,torqueReferenceM:center,maxObjectPenetrationUm:final.maxObjectPenetration*1e6,maxTendonPenetrationUm:final.maxTendonPenetration*1e6,minPathJ:Math.min(...frames.map(f=>f.local.minPathJ)),fingers:final.fingers.map(f=>({id:f.id,pullMm:f.local.pull*f.scale*1000,tipAngleDeg:f.local.tipAngleDeg,tipDisplacementMm:f.local.tipDeflection*f.scale*1000,tendonTensionN:f.local.tension*f.scale**2,tendonContacts:f.local.contacts.length,tendonPenetrationUm:f.local.checkPenetration*f.scale*1e6,objectContacts:f.local.objectContacts.length,objectForceOnFingerN:f.objectForce,objectPenetrationUm:f.local.objectPenetration*f.scale*1e6,freeResidualN:f.local.residual*f.scale**2,minJ:f.local.minJ,pathMinJ:f.local.minPathJ}))}}
mkdirSync('docs/screenshots',{recursive:true})
const filename=`docs/screenshots/multi-object-${id}-${scale.toFixed(2)}-${target.toFixed(2)}mm.json`
writeFileSync(filename,JSON.stringify(result,null,2)+'\n')
// Full states stay outside the repository; the small independent audit report
// is committed separately. Re-project multipliers at this accepted state.
const snapshots=hand.fingers.map((f,i)=>{
  const a=(f as any).assemble(f.q,false)
  return {case:FINGERS[i].id,codeHash:result.codeHash,params:f.params,mesh:f.mesh,q:Array.from(f.q),multipliers:Array.from(f.lambda),object:f.object,objectMultipliers:Array.from(f.objectLambda),energy:a.energy,gradient:Array.from(a.gradient),contactInfo:a.contactInfo,objectContacts:a.objectContacts,objectForce:a.objectForce,frame:f.last}
})
const snapshotPath=`/tmp/multi-object-${id}-snapshot.json`
writeFileSync(snapshotPath,JSON.stringify({codeHash:result.codeHash,sourceFiles:files,id,normalizedPullMm:result.acceptedNormalizedMm,snapshots}))
console.log('SNAPSHOT',snapshotPath)
console.log('REPORT',filename,JSON.stringify({accepted:result.acceptedNormalizedMm,checks,limitedPathChecksPass,failure}))
if(!limitedPathChecksPass)process.exitCode=1
