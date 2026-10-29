import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const ids=['ball60','ball90','ball110','capsule','rounded-box','dumbbell'],cases=[]
let sourceHash=''
for(const id of ids){
  const report=JSON.parse(await readFile(`docs/screenshots/multi-object-${id}-1.00-6.75mm.json`,'utf8'))
  const hash=createHash('sha256');for(const file of report.sourceFiles)hash.update(file).update(await readFile(file))
  if(hash.digest('hex')!==report.codeHash||report.normalizedTargetMm!==6.75||report.object.id!==id||report.object.scale!==1)throw Error(`Stale or mismatched case: ${id}`)
  if(sourceHash&&sourceHash!==report.codeHash)throw Error('Cases were produced by different numerical source versions')
  sourceHash=report.codeHash
  cases.push({id,name:report.object.name,dimensionsMm:report.object.dimensionsMm,acceptedNormalizedMm:report.acceptedNormalizedMm,contactFingers:report.final.objectContacts,netObjectForceN:Math.hypot(...report.final.reactionOnObjectN),maxObjectPenetrationUm:Math.max(...report.path.map(x=>x.objectPenetrationUm)),maxTendonPenetrationUm:Math.max(...report.path.map(x=>x.tendonPenetrationUm)),maxResidualN:Math.max(...report.final.fingers.map(f=>f.freeResidualN)),limitedPathChecksPass:report.limitedPathChecksPass,failure:report.failure})
}
const summary={status:'complete',sourceHash,targetNormalizedMm:6.75,cases}
await writeFile('src/data/multi-object-comparison.json',JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify(summary,null,2))
