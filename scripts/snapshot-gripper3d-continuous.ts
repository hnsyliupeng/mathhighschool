/* Reassemble a saved strict-audit state for the independent Python check. */
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {ContinuousGripper3D} from '../src/engine/continuous-gripper3d'
const dir='/tmp/gripper3d-continuous-audit',name=process.argv[2]||'mesh1'
if(!['mesh1','curl'].includes(name))throw Error('Use mesh1 or curl')
const raw=JSON.parse(readFileSync(`${dir}/${name}-state.json`,'utf8')),audit=JSON.parse(readFileSync(`${dir}/${name}.json`,'utf8'))
const hash=createHash('sha256');for(const p of ['src/engine/gripper3d.ts','src/engine/continuous-gripper3d.ts','src/engine/hexahedron.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts'])hash.update(p).update(readFileSync(p))
const codeHash=hash.digest('hex'),s=new ContinuousGripper3D(raw.params),f=raw.frame,coordinates=[...f.positions,...f.tendon].flat()
if(audit.codeHash!==codeHash||(raw.codeHash&&raw.codeHash!==codeHash)||audit.failure||JSON.stringify(raw.params)!==JSON.stringify(audit.params)||JSON.stringify(raw.mesh)!==JSON.stringify(s.mesh)||f.pull*1000!==audit.loaded.pullMm||f.tipDeflection*1000!==audit.loaded.tipMm||f.tipAngleDeg!==audit.loaded.tipAngleDeg||f.tension!==audit.loaded.tensionN||f.minJ!==audit.loaded.minJ||!f.converged||raw.q.length!==coordinates.length||raw.q.some((v:number,i:number)=>!Number.isFinite(v)||v!==coordinates[i])||raw.multipliers.length!==s.lambda.length||raw.multipliers.some((v:number)=>!Number.isFinite(v)||v<0))throw Error('Stale, mismatched or failed audit state')
s.q.set(raw.q);s.lambda.set(raw.multipliers)
const a=(s as any).assemble(s.q,false)
writeFileSync(`${dir}/independent-snapshot.json`,JSON.stringify({...raw,case:name,codeHash,energy:a.energy,gradient:Array.from(a.gradient),contactInfo:a.contactInfo}))
console.log('Saved independent snapshot with',a.contactInfo.length,'active contact features')
