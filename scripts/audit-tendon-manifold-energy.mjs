import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const files=['src/data/tendon-grasp-manifold.json','scripts/audit-tendon-manifold-energy.mjs'],hash=createHash('sha256');for(const f of files)hash.update(f).update(readFileSync(f))
const data=JSON.parse(readFileSync(files[0],'utf8')),samples=[]
for(let i=1;i<data.frames.length-1;i++){
  const a=data.frames[i-1],b=data.frames[i],c=data.frames[i+1],slope=(c.energy-a.energy)/(c.pull-a.pull),difference=b.tension-slope
  samples.push({index:i,pull:b.pull,firstSegmentTension:b.tension,centralEnergySlope:slope,difference,relative:Math.abs(difference)/Math.max(.001,Math.abs(slope))})
}
const worst=samples.reduce((a,b)=>a.relative>b.relative?a:b)
const report={sourceFiles:files,sourceHash:hash.digest('hex'),referenceHash:data.sourceHash,samples:samples.length,worst,maximumAbsoluteDifference_N:Math.max(...samples.map(s=>Math.abs(s.difference))),scope:'Central finite differences of stored free-finger augmented energies versus first-segment axial tension. This measures a heuristic mismatch; it does not prove an exact energy derivative.'}
writeFileSync('docs/screenshots/tendon-manifold-energy-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
