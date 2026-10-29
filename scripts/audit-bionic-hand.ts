/** Reproducible *limited* supported-sphere path. Its green checks never imply
 * complete grasp acceptance; see the explicitly listed missing checks. */
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {BionicHand3D,FINGERS,type HandFrame} from '../src/engine/bionic-hand3d'
const files=['src/engine/bionic-hand3d.ts','src/engine/sphere-finger3d.ts','src/engine/hand-object-contact.ts','src/engine/continuous-gripper3d.ts','src/engine/gripper3d.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts']
const hash=createHash('sha256');for(const file of files)hash.update(file).update(readFileSync(file))
const codeHash=hash.digest('hex'),hand=new BionicHand3D(),history:HandFrame[]=[hand.last]
let failure:string|null=null
for(let i=1;i<=32;i++){
  const started=Date.now(),frame=hand.step(FINGERS.map(f=>i*.00025*f.scale))
  console.log(JSON.stringify({step:i,pullNormalizedMm:i*.25,seconds:(Date.now()-started)/1000,converged:frame.converged,objectFingerCount:frame.sphereContactFingers,angles:frame.fingers.map(f=>f.local.tipAngleDeg),spherePenetrationUm:frame.maxSpherePenetration*1e6,tendonPenetrationUm:frame.maxTendonPenetration*1e6,message:frame.message}))
  if(!frame.converged){failure=frame.message||'unknown failure';break}
  history.push(frame)
}
const final=history.at(-1)!,frames=history.flatMap(h=>h.fingers)
const checks={
  reached8mm:history.length===33,
  fiveTendonContactFingers:final.fingers.every(f=>f.local.contacts.length>0),
  fiveSphereContactFingers:final.sphereContactFingers===5,
  residual:frames.every(f=>f.local.residual<2e-5&&f.local.forceBalance<2e-5&&f.local.torqueBalance<2e-6),
  tendonComplementarityAndPenetration:frames.every(f=>f.local.complementarity<=2e-8&&f.local.checkPenetration<=2e-8),
  sphereComplementarityAndPenetration:frames.every(f=>f.local.sphereComplementarity<=2e-8&&f.local.spherePenetration<=2e-8),
  singleFingerStaticChecks:frames.every(f=>f.local.selfIntersections===0&&f.local.volumeOverlaps===0&&f.local.interiorNodes===0&&f.local.surfaceIntersections===0),
  positivePathJacobianLowerBound:frames.every(f=>f.local.minPathJ>0),
  acceptedFrameInterFingerCCD:history.every(h=>h.converged),
}
const result={date:new Date().toISOString(),codeHash,sourceFiles:files,fixture:'90 mm rigid sphere, fixed and externally supported, frictionless',normalizedTargetMm:8,acceptedSteps:history.length-1,failure,checks,limitedPathChecksPass:Object.values(checks).every(Boolean),strictGraspAcceptance:false,notValidated:['free object equilibrium or force closure','friction and gravity','finger-palm contact or collision','inter-finger contact force','complete curved-face and continuum-interior CCD','five-finger mesh and tendon refinement convergence','experimental calibration','large-curl complete five-finger path and full unloading'],final:{sphereContacts:final.sphereContactFingers,sphereForceOnObject:final.sphereReaction,maxSpherePenetrationUm:final.maxSpherePenetration*1e6,maxTendonPenetrationUm:final.maxTendonPenetration*1e6,interFingerChecks:final.interFingerChecks,fingers:final.fingers.map(f=>({id:f.id,pullMm:f.local.pull*f.scale*1000,tipAngleDeg:f.local.tipAngleDeg,tipDisplacementMm:f.local.tipDeflection*f.scale*1000,tendonTensionN:f.local.tension*f.scale**2,tendonContacts:f.local.contacts.length,tendonPenetrationUm:f.local.checkPenetration*f.scale*1e6,sphereContacts:f.local.sphereContacts.length,sphereForceOnFingerN:f.sphereForce,spherePenetrationUm:f.local.spherePenetration*f.scale*1e6,freeResidualN:f.local.residual*f.scale**2,minJ:f.local.minJ,pathMinJ:f.local.minPathJ}))}}
mkdirSync('docs/screenshots',{recursive:true});writeFileSync('docs/screenshots/bionic-hand-audit.json',JSON.stringify(result,null,2)+'\n')
console.log('AUDIT',JSON.stringify(result));if(!result.limitedPathChecksPass)process.exitCode=1
