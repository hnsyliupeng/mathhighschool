import {createHash} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {ContinuousGripper3D,defaultContinuousGripper3DParams} from '../src/engine/continuous-gripper3d'

// Reference states come from the ACTUAL Q1 solid/tendon/bore solver. Interpolating
// between them restricts deformation to a one-dimensional manifold and does
// not reproduce a fully coupled full-DOF Q1 contact solution.
const sourceFiles=['src/engine/continuous-gripper3d.ts','src/engine/gripper3d.ts','src/engine/hexahedron.ts','src/engine/gripper3d-safety.ts','src/engine/hex-jacobian-bound.ts','src/engine/continuous-collision.ts','src/engine/segment-triangle.ts','scripts/precompute-tendon-manifold.ts']
const hash=createHash('sha256');for(const f of sourceFiles)hash.update(f).update(readFileSync(f))
const sim=new ContinuousGripper3D(defaultContinuousGripper3DParams),frames=[]
let previous=sim.last,error=''
function snapshot(frame:typeof sim.last){return {pull:frame.pull,positions:frame.positions,tendon:frame.tendon,tip:frame.tip,tipAngleDeg:frame.tipAngleDeg,tipDeflection:frame.tipDeflection,tension:frame.tension,energy:frame.energy,residual:frame.residual,minJ:frame.minJ,minPathJ:frame.minPathJ,maxPenetration:frame.checkPenetration,contactCount:frame.contacts.length,contacts:frame.contacts.map(c=>({point:c.point,wallPoint:c.wallPoint,force:c.force,gap:c.gap,penetration:c.penetration,triangle:c.triangle,segment:c.segment,feature:c.feature})),interpolationSafe:true,interpolationMinPathJ:1}}
frames.push(snapshot(previous))
for(let i=1;i<=59;i++){
  const start=Date.now(),frame=sim.step(i*.00025)
  if(!frame.converged){error=frame.message||'nonlinear solver failed';console.log('FAIL',i,error);break}
  const interpolation=sim.safety.motion(previous.positions,frame.positions,previous.tendon,frame.tendon,sim.sweptClearance)
  if(!interpolation.safe){error=`accepted-frame interpolation: ${interpolation.reason}`;console.log('INTERPOLATION FAIL',i,error);break}
  frames.push({...snapshot(frame),interpolationSafe:interpolation.safe,interpolationMinPathJ:interpolation.minimumPathJ})
  console.log(JSON.stringify({index:i,pullMm:frame.pull*1000,angle:frame.tipAngleDeg,tendonContacts:frame.contacts.length,residual:frame.residual,penetration:frame.checkPenetration,pathJ:interpolation.minimumPathJ,seconds:(Date.now()-start)/1000}))
  previous=frame
}
mkdirSync('src/data',{recursive:true});mkdirSync('docs/screenshots',{recursive:true})
const result={sourceFiles,sourceHash:hash.digest('hex'),scope:'Free-finger Q1 tendon/bore equilibria and certified straight interpolation only; contact-loaded finger remains a one-coordinate reduced model.',params:sim.params,mesh:sim.mesh,frames,error}
writeFileSync('src/data/tendon-grasp-manifold.json',JSON.stringify(result)+'\n')
writeFileSync('docs/screenshots/tendon-manifold-audit.json',JSON.stringify({sourceHash:result.sourceHash,sourceFiles,frameCount:frames.length,lastPull:frames.at(-1)?.pull,lastAngle:frames.at(-1)?.tipAngleDeg,maxResidual:Math.max(...frames.map(f=>f.residual)),maxTendonPenetration:Math.max(...frames.map(f=>f.maxPenetration)),minPathJ:Math.min(...frames.map(f=>f.interpolationMinPathJ)),error,scope:result.scope},null,2)+'\n')
if(error||frames.length!==60)process.exitCode=1
