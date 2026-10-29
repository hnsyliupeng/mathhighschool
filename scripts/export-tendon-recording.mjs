import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const id=process.argv[2]||'egg',cases={
  egg:{report:'docs/screenshots/tendon-dynamic-egg-ccd.json',snapshots:'/tmp/tendon-dynamic-egg-snapshots.json',out:'src/data/tendon-egg-recording.json'},
  screwdriver:{report:'docs/screenshots/tendon-dynamic-screwdriver-opposed-ccd.json',snapshots:'/tmp/tendon-dynamic-screwdriver-opposed-snapshots.json',out:'src/data/tendon-screwdriver-recording.json'},
  'bottle-cap':{report:'docs/screenshots/tendon-dynamic-cap-opposed-ccd.json',snapshots:'/tmp/tendon-dynamic-cap-opposed-snapshots.json',out:'src/data/tendon-cap-recording.json'},
}
const c=cases[id];if(!c)throw Error('未知回放工况')
const report=JSON.parse(readFileSync(c.report,'utf8')),snap=JSON.parse(readFileSync(c.snapshots,'utf8'))
const h=createHash('sha256');for(const f of report.sourceFiles)h.update(f).update(readFileSync(f))
if(report.sourceHash!==h.digest('hex')||report.sourceHash!==snap.sourceHash||report.sourceChanged||report.error||snap.error||JSON.stringify(report.params)!==JSON.stringify(snap.params)||!report.certifiedEveryAcceptedStep||report.steps<1||snap.frames.at(-1)?.time!==report.params.duration)throw Error('轨迹与已验证源码、完整工况或逐步 CCD 不一致，拒绝导出')
const recording={kind:'sampled-recording',params:report.params,sourceHash:report.sourceHash,referenceHash:report.referenceHash,steps:report.steps,certifiedEveryAcceptedStep:report.certifiedEveryAcceptedStep,summary:report.summary,frames:snap.frames}
writeFileSync(c.out,JSON.stringify(recording)+'\n')
console.log(JSON.stringify({id,frames:recording.frames.length,steps:recording.steps,retained:recording.summary.retained,sourceHash:recording.sourceHash}))
