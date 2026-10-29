/* Combine the opt-in coarse/fine/finer research paths. A non-zero exit means
 * missing/stale data or that the same 5% endpoint criterion is not met. */
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
const inputs=['src/engine/gripper3d.ts','src/engine/continuous-gripper3d.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts','experiments/gripper3d/incompatible-hex.ts'],hash=createHash('sha256');for(const p of inputs)hash.update(p).update(readFileSync(p));const codeHash=hash.digest('hex')
const names=['coarse','fine','finer'] as const,missing:string[]=[],results:Record<string,any>={}
for(const name of names){
  const path=`/tmp/gripper3d-incompatible-${name}.json`;if(!existsSync(path)){missing.push(name);continue}
  const r=JSON.parse(readFileSync(path,'utf8')),pull=name==='finer'?.0005:.003,level=name==='coarse'?1:name==='fine'?2:3
  if(r.name!==name||r.codeHash!==codeHash||r.params.meshLevel!==level||r.params.pull!==pull||!Array.isArray(r.history)||(!r.failure&&Math.abs(r.history.at(-1)?.pullMm-pull*1000)>1e-8)){missing.push(`${name} (stale or incomplete)`);continue}results[name]=r
}
const compare=(a:string,b:string,pullMm:number)=>{
  const x=results[a]?.history.find((r:any)=>Math.abs(r.pullMm-pullMm)<1e-8),y=results[b]?.history.find((r:any)=>Math.abs(r.pullMm-pullMm)<1e-8)
  if(!x||!y)return null
  const pct=(v:number,w:number)=>100*(w-v)/Math.max(Math.abs(v),1e-12)
  return {pullMm,from:a,to:b,fromTensionN:x.tensionN,toTensionN:y.tensionN,tensionChangePercent:pct(x.tensionN,y.tensionN),tipChangePercent:pct(x.tipMm,y.tipMm)}
}
const comparisons=[compare('coarse','fine',.5),compare('fine','finer',.5),compare('coarse','fine',3)],pathConverged=missing.length===0&&names.every(n=>!results[n].failure),meshConverged=comparisons.every(c=>c&&Math.abs(c.tensionChangePercent)<5&&Math.abs(c.tipChangePercent)<5)
const report={codeHash,missing,pathConverged,meshConverged,comparisons,results:Object.values(results),passed:pathConverged&&meshConverged,scope:'Opt-in research candidate, contact coupled with nonconforming internal displacement; only the listed endpoints are compared. Not production, not high-load, not a full-path convergence or CCD certification.'}
writeFileSync('docs/screenshots/gripper3d-incompatible-path-research.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({missing,pathConverged,meshConverged,comparisons,passed:report.passed},null,2));if(!report.passed)process.exitCode=1
