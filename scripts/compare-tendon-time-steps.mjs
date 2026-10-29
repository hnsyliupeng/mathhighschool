import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const paths=['docs/screenshots/tendon-dynamic-egg-ccd.json','docs/screenshots/tendon-dynamic-egg-halfstep-ccd.json'],[coarse,fine]=paths.map(p=>JSON.parse(readFileSync(p,'utf8')))
if(coarse.sourceHash!==fine.sourceHash||coarse.sourceChanged||fine.sourceChanged||!coarse.certifiedEveryAcceptedStep||!fine.certifiedEveryAcceptedStep||coarse.error||fine.error)throw Error('结果、源码或 CCD 不一致')
for(const key of Object.keys(coarse.params))if(key!=='dt'&&coarse.params[key]!==fine.params[key])throw Error(`参数不一致 ${key}`)
const pairs=[]
for(const a of coarse.history.filter(x=>x.time<=fine.requestedEnd+1e-10)){
  const b=fine.history.reduce((best,x)=>Math.abs(x.time-a.time)<Math.abs(best.time-a.time)?x:best,fine.history[0])
  if(Math.abs(a.time-b.time)>1e-8)throw Error('时间网格不重合');pairs.push([a,b])
}
const maxPullDifference_m=Array.from({length:5},(_,i)=>Math.max(...pairs.map(([a,b])=>Math.abs(a.pulls[i]-b.pulls[i])))),maxRiseDifference_m=Math.max(...pairs.map(([a,b])=>Math.abs(a.rise-b.rise)))
const force=Array.from({length:5},(_,i)=>{const maxAbsDifference=Math.max(...pairs.map(([a,b])=>Math.abs(a.forces[i]-b.forces[i]))),peak=Math.max(...pairs.flatMap(([a,b])=>[Math.abs(a.forces[i]),Math.abs(b.forces[i])]));return {maxAbsDifference_N:maxAbsDifference,peakEither_N:peak,ratioToPeak:peak>1e-10?maxAbsDifference/peak:0}})
const last=pairs.at(-1),files=[...paths,'scripts/compare-tendon-time-steps.mjs'],h=createHash('sha256');for(const f of files)h.update(f).update(readFileSync(f))
const report={sourceFiles:files,sourceHash:h.digest('hex'),solverHash:coarse.sourceHash,coarseDt:coarse.params.dt,fineDt:fine.params.dt,end:fine.requestedEnd,pairedFrames:pairs.length,maxPullDifference_m,maxRiseDifference_m,force,lastAtEnd:{time:last[0].time,coarseForces_N:last[0].forces,fineForces_N:last[1].forces},scope:'Only the first 0.6 s (closure while fixture remains active). Does not establish time-step convergence during release or lift.'}
writeFileSync('docs/screenshots/tendon-dynamic-egg-time-step.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
