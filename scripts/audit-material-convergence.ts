import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {MATERIAL_PRESETS,MaterialGrasp3D,defaultMaterialGraspParams,type DynamicFrame,type GraspParams} from '../src/engine/material-grasp3d'

type Trajectory={params:GraspParams;frames:DynamicFrame[];error:string}
const report=JSON.parse(readFileSync('docs/screenshots/material-grasp-audit.json','utf8'))
for(const [path,hash] of Object.entries(report.hashes)){if(createHash('sha256').update(readFileSync(path)).digest('hex')!==hash)throw Error(`Stale baseline: ${path}`)}
function run(params:GraspParams):Trajectory{
  const sim=new MaterialGrasp3D(params),frames=[sim.last];let error=''
  while(sim.time<params.duration-1e-9){const f=sim.step();if(!f.finite){error=f.message||'step failed';break}frames.push(f)}
  return {params,frames,error}
}
function compare(a:Trajectory,b:Trajectory){
  const fineByTime=new Map(b.frames.map(f=>[Math.round(f.time*1e6),f])),paired=a.frames.flatMap(f=>{const g=fineByTime.get(Math.round(f.time*1e6));return g?[[f,g] as const]:[]})
  let maxCentreDifference=0,maxNodeDifference=0,maxFingerForceDifference=0,maxReferenceFingerForce=0,maxStrainDifference=0
  for(const [x,y] of paired){
    maxCentreDifference=Math.max(maxCentreDifference,Math.hypot(...x.centre.map((v,d)=>v-y.centre[d])))
    for(let i=0;i<x.positions.length;i++)maxNodeDifference=Math.max(maxNodeDifference,Math.hypot(...x.positions[i].map((v,d)=>v-y.positions[i][d])))
    for(let i=0;i<5;i++){maxFingerForceDifference=Math.max(maxFingerForceDifference,Math.abs(x.normalForces[i]-y.normalForces[i]));maxReferenceFingerForce=Math.max(maxReferenceFingerForce,y.normalForces[i])}
    maxStrainDifference=Math.max(maxStrainDifference,Math.abs(x.maxStructuralStrain-y.maxStructuralStrain))
  }
  const aLast=a.frames.at(-1)!,bLast=b.frames.at(-1)!,completed=!a.error&&!b.error&&aLast.time>=a.params.duration-1e-9&&bLast.time>=b.params.duration-1e-9
  return {completed,aError:a.error,bError:b.error,aLastTime:aLast.time,bLastTime:bLast.time,pairedFrames:paired.length,comparedUntil:paired.at(-1)?.[0].time??0,maxCentreDifference,maxNodeDifference,maxFingerForceDifference,maxReferenceFingerForce,relativePeakForceDifference:maxReferenceFingerForce?maxFingerForceDifference/maxReferenceFingerForce:null,maxStrainDifference,finalRiseDifference:completed?Math.abs(aLast.centreRise-bLast.centreRise):null}
}
const cases=[]
for(const preset of MATERIAL_PRESETS){
  const p=defaultMaterialGraspParams(preset.id),base=run(p),halfDt=run({...p,dt:1/480}),it24=run({...p,iterations:24}),it80=run({...p,iterations:80})
  const row={id:p.id,dt240_vs480:compare(base,halfDt),iter24_vs40:compare(it24,base),iter40_vs80:compare(base,it80)};cases.push(row)
  for(const [name,c] of Object.entries(row)){if(name==='id')continue;const x=c as ReturnType<typeof compare>;console.log(p.id,name,'complete',x.completed,'node(mm)',(1000*x.maxNodeDifference).toFixed(3),'peakFdiff(%)',x.relativePeakForceDifference===null?'n/a':(100*x.relativePeakForceDifference).toFixed(1),'errors',x.aError||x.bError)}
}
const auditorSha256=createHash('sha256').update(readFileSync('scripts/audit-material-convergence.ts')).digest('hex')
const data=JSON.stringify({sourceHash:report.sourceHash,auditorSha256,scope:'Same fixed mesh and matching sampled times only; not a mesh refinement or continuous-collision proof.',cases},null,2)+'\n'
writeFileSync('docs/screenshots/material-grasp-convergence.json',data)
writeFileSync('src/data/material-grasp-convergence.json',data)
