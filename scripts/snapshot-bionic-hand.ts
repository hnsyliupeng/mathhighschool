/* Save all five accepted states for independent SciPy reassembly. */
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {BionicHand3D,FINGERS} from '../src/engine/bionic-hand3d'
const files=['src/engine/bionic-hand3d.ts','src/engine/sphere-finger3d.ts','src/engine/hand-object-contact.ts','src/engine/continuous-gripper3d.ts','src/engine/gripper3d.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts']
const hash=createHash('sha256');for(const p of files)hash.update(p).update(readFileSync(p));const codeHash=hash.digest('hex')
const hand=new BionicHand3D(),steps=Number(process.argv[2]||14)
if(!Number.isInteger(steps)||steps<1||steps>59)throw Error('Steps must be an integer from 1 through 59')
for(let i=1;i<=steps;i++){
  const result=hand.step(FINGERS.map(f=>i*.00025*f.scale));console.log(JSON.stringify({step:i,pullNormalizedMm:i*.25,ok:result.converged,objectFingers:result.sphereContactFingers}))
  if(!result.converged)throw Error(result.message||'five-finger step failed')
}
const snapshots=hand.fingers.map((f,i)=>{
  // Re-project the saved multipliers consistently; the Python script checks
  // this exact reassembly, not a different iteration or reported animation.
  const a=(f as any).assemble(f.q,false)
  return {case:FINGERS[i].id,codeHash,params:f.params,mesh:f.mesh,q:Array.from(f.q),multipliers:Array.from(f.lambda),sphere:f.sphere,sphereMultipliers:Array.from(f.sphereLambda),energy:a.energy,gradient:Array.from(a.gradient),contactInfo:a.contactInfo,sphereContacts:a.sphereContacts,sphereForce:a.sphereForce,frame:f.last}
})
const path='/tmp/bionic-hand-independent-snapshots.json';writeFileSync(path,JSON.stringify({codeHash,normalizedPullMm:steps*.25,snapshots}));console.log(`Saved ${snapshots.length} states to ${path}`)
