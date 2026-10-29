import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {MATERIAL_PRESETS,MaterialGrasp3D,defaultMaterialGraspParams,effectiveBite,type DynamicFrame,type GraspParams} from '../src/engine/material-grasp3d'
import {summarizeMaterialRun,NUMERICAL_HOLD} from '../src/engine/material-grasp-analysis'

const SOURCE_FILES=['src/engine/material-grasp3d.ts','src/engine/material-grasp-analysis.ts','src/engine/segment-triangle.ts','scripts/audit-material-grasp.ts']
const hashes=Object.fromEntries(SOURCE_FILES.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]))
const sourceHash=createHash('sha256').update(JSON.stringify(hashes)).digest('hex')
const samples:unknown[]=[]
function run(params:GraspParams,saveSamples=false){
  const sim=new MaterialGrasp3D(params),frames:DynamicFrame[]=[sim.last];let error='',attempted:DynamicFrame['attempted']
  const wanted=[0,.4,.7,.9,1.2,1.4,1.6],sampleFrames:DynamicFrame[]=[];let sampleIndex=0,maxFrictionExcess=0
  const record=(f:DynamicFrame)=>{
    while(sampleIndex<wanted.length&&f.time>=wanted[sampleIndex]-1e-9){sampleFrames.push(f);sampleIndex++}
    for(const c of f.contacts)maxFrictionExcess=Math.max(maxFrictionExcess,c.tangentialForce-params.friction*c.normalForce)
  }
  record(sim.last)
  while(sim.time<params.duration-1e-10){const frame=sim.step();if(!frame.finite){error=frame.message||'failed';attempted=frame.attempted;break}frames.push(frame);record(frame)}
  const summary=summarizeMaterialRun(frames,params,error)
  if(saveSamples)samples.push({id:params.id,scale:params.scale,params,mesh:{triangles:sim.mesh.triangles,springs:sim.mesh.springs,radii:sim.mesh.radii,mass:sim.mesh.mass,clipNodes:sim.mesh.clipNodes},frames:sampleFrames})
  return {params,effectiveBite:effectiveBite(params),mass:sim.mesh.mass,dimensionsMm:sim.mesh.dimensionsMm,nodes:sim.count,triangles:sim.mesh.triangles.length,springs:sim.mesh.springs.length,...summary,maxFrictionExcess,error,attempted}
}
const baseline=[]
for(const preset of MATERIAL_PRESETS)for(const scale of [.7,1,1.3]){
  const row=run({...defaultMaterialGraspParams(preset.id),scale},true);baseline.push(row)
  console.log(`BASE ${preset.id.padEnd(11)} ${scale.toFixed(1)} retained=${row.retained} rise=${(row.finalRise*1000).toFixed(2)}mm maxPen=${(row.maxPenetration*1000).toFixed(3)}mm ${row.error}`)
}
const sweeps:Record<string,ReturnType<typeof run>[]>={}
if(!process.argv.includes('--baseline-only'))for(const preset of MATERIAL_PRESETS){
  const p=defaultMaterialGraspParams(preset.id),cases:[string,Partial<GraspParams>][]=[
    ['dt-1/120',{dt:1/120}],['dt-1/480',{dt:1/480}],
    ['iterations-12',{iterations:12}],['iterations-24',{iterations:24}],['iterations-80',{iterations:80}],
    ['stiffness-0.25',{stiffnessScale:.25}],['stiffness-4',{stiffnessScale:4}],['friction-0',{friction:0}],
  ]
  for(const [name,change] of cases){const row=run({...p,...change});(sweeps[name]??=[]).push(row);console.log(`SWEEP ${preset.id.padEnd(11)} ${name.padEnd(16)} retained=${row.retained} rise=${(row.finalRise*1000).toFixed(2)}mm maxPen=${(row.maxPenetration*1000).toFixed(3)}mm ${row.error}`)}
}
mkdirSync('docs/screenshots',{recursive:true});mkdirSync('src/data',{recursive:true})
const report={version:1,generatedAt:new Date().toISOString(),sourceHash,hashes,scope:'Reduced-order pad/triangle bench; not a Q1 tendon-driven hand or calibrated physical materials. Discrete substep checks only; no continuous collision certification.',criteria:NUMERICAL_HOLD,baseline,sweeps}
writeFileSync('docs/screenshots/material-grasp-audit.json',JSON.stringify(report,null,2)+'\n')
writeFileSync('docs/screenshots/material-grasp-samples.json',JSON.stringify({sourceHash,samples})+'\n')
writeFileSync('src/data/material-grasp-validation.json',JSON.stringify({sourceHash,criteria:NUMERICAL_HOLD,baseline,sweeps},null,2)+'\n')
console.log(`WROTE ${baseline.length} baseline runs and ${Object.values(sweeps).flat().length} sweeps; source ${sourceHash}`)
