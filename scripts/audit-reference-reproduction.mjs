/** Re-run source baselines and compare saved samples (not an app-vs-source physics test).
 * Usage: node scripts/audit-reference-reproduction.mjs /path/to/DDG_Tutorial
 * Requires optional external Playwright, Chromium and octave-wasm; see README. */
import {spawn,execFileSync} from 'node:child_process'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const repo=process.argv[2],pinned='20d732f3fffdd5137eee720e46175de3a98016c6'
if(!repo)throw Error('Specify the DDG_Tutorial checkout')
const commit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
if(commit!==pinned)throw Error(`Expected upstream ${pinned}, got ${commit}`)
const dirty=execFileSync('git',['-C',repo,'status','--porcelain','--untracked-files=normal'],{encoding:'utf8'}).trim()
if(dirty)throw Error('Upstream checkout must be clean; refuse to label modified files as the pinned commit')
const temp=await mkdtemp(path.join(os.tmpdir(),'ddg-repro-'))
const load=async file=>JSON.parse(await readFile(file,'utf8'))
const reference=file=>load(path.join('src/data/references',file))
const results=[]
const run=(script,args)=>new Promise((resolve,reject)=>{
  console.log(`\n--- ${script} ---`)
  const p=spawn(process.execPath,[path.join('scripts',script),repo,...args],{stdio:'inherit',env:process.env})
  p.once('error',reject);p.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${script} failed (${signal||code})`)))
})
const compare=(label,a,b,tolerance)=>{
  if(a.length!==b.length)throw Error(`${label}: unequal sample counts ${a.length}/${b.length}`)
  let max=0
  for(let i=0;i<a.length;i++){
    if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))throw Error(`${label}: non-finite sample ${i}`)
    max=Math.max(max,Math.abs(a[i]-b[i]))
  }
  if(max>tolerance)throw Error(`${label}: ${max} exceeds ${tolerance}`)
  return max
}
const frames=(fresh,saved,tolerance)=>{
  let max=0,count=0
  const indexed=new Map(saved.map(f=>[f.step,f]))
  for(const f of fresh){const old=indexed.get(f.step);if(old){max=Math.max(max,compare('frame '+f.step,f.positions,old.positions,tolerance));count++}}
  if(!count)throw Error('No common frames in saved reference')
  return {commonFrames:count,maxFrameDifference:max}
}
const normal=(id,fresh,saved,tolerance=1e-9,warnings=fresh.metadata?.warnings)=>{
  const key=fresh.probe?'probe':'trajectory',newValues=fresh[key].flat(),oldValues=saved[key].flat().slice(0,newValues.length)
  const maxProbeDifference=compare(id+' probe',newValues,oldValues,tolerance)
  const result={case:id,stepsReproduced:fresh.steps,maxProbeDifference,...frames(fresh.frames,saved.frames,tolerance),tolerance}
  if(Array.isArray(warnings))result.sourceIterationLimitExits=warnings.length
  if(fresh.reactions){result.maxReactionDifference=compare(id+' reaction',fresh.reactions,saved.reactions.slice(0,fresh.reactions.length),1e-5);result.reactionTolerance=1e-5}
  results.push(result);console.log('PASS',JSON.stringify(result))
}
const out=name=>path.join(temp,name+'.json')
try{
  await run('generate-small-reference-wasm.mjs',[out('small')])
  const small=await load(out('small')),savedSmall=await reference('octave-reference.json')
  for(const [key,id] of [['single','mass-single'],['multiple','mass-multi'],['beam','beam-gravity']]){
    const a=small[key],b=savedSmall[key]
    if(a.length!==b.length||a.some((x,i)=>x.step!==b[i].step))throw Error(`${id}: inconsistent steps`)
    const flatten=rows=>rows.flatMap(r=>[r.time_label,...(r.positions||[r.tip_y])])
    const maxDifference=compare(id,flatten(a),flatten(b),1e-9)
    const result={case:id,sourceIntegrationSteps:key==='beam'?50:999,savedSamplesCompared:a.length,maxDifference,tolerance:1e-9};results.push(result);console.log('PASS',JSON.stringify(result))
  }
  await run('generate-planar-reference.mjs',['--buckling-steps','20','--snap-steps','20','--output',out('planar')])
  const planar=await load(out('planar')),savedPlanar=await reference('planar-reference.json')
  normal('beam-buckling',planar.buckling,savedPlanar.buckling,1e-9,planar.metadata.warnings.buckling)
  normal('beam-snap',planar.snap,savedPlanar.snap,1e-9,planar.metadata.warnings.snap)
  await run('generate-axis-shell-element-reference.mjs',[out('element')])
  const element=await load(out('element')),savedElement=await reference('axis-shell-element-reference.json')
  const a=[],b=[];for(const kind of ['stretch','bend'])for(const key of ['gradient','hessian']){a.push(...element[kind][key].flat());b.push(...savedElement[kind][key].flat())}
  const elementDifference=compare('shell element matrices',a,b,1e-9)
  console.log('PASS shell element source matrix reproduction:',elementDifference)
  for(const n of [1,2]){
    await run('generate-axis-shell-reference.mjs',['--case',String(n),'--steps','5','--output',out('shell'+n)])
    normal(n===1?'axis-inflate':'axis-snap',await load(out('shell'+n)),await reference(`axis-shell-${n}-reference.json`))
  }
  for(const [name,extra] of [['original',[]],['vectorized',['--fast-assembly']]]){
    await run('generate-net-reference.mjs',['--steps','5','--frame-every','1',...extra,'--output',out('net-'+name)])
    normal('net-gravity ('+name+')',await load(out('net-'+name)),await reference(`net-gravity-${name}-5.json`),1e-12)
  }
  const original=await load(out('net-original')),vectorized=await load(out('net-vectorized'))
  const netAssembliesDifference=compare('net original/vectorized',original.frames.flatMap(f=>f.positions),vectorized.frames.flatMap(f=>f.positions),1e-12)
  console.log('PASS net original/vectorized five-step full nodes:',netAssembliesDifference)
  await run('generate-hyper-reference.mjs',['--steps','25','--output',out('hyper')])
  normal('hyper-cable',await load(out('hyper')),await reference('hyper-reference.json'))
  await run('generate-membrane-reference.mjs',['--steps','10','--output',out('membrane')])
  normal('hyper-membrane',await load(out('membrane')),await reference('membrane-reference.json'))
  for(const n of [1,2]){
    await run('generate-soft-reference.mjs',['--case',String(n),'--steps','10','--output',out('soft'+n)])
    normal(n===1?'robot-magnetic':'robot-swim',await load(out('soft'+n)),await reference(`soft-${n}-reference.json`))
  }
  const report={date:new Date().toISOString().slice(0,10),referenceCommit:commit,runner:small.metadata.runner,results,extra:{shellElementMaxDifference:elementDifference,netOriginalVersusVectorizedMaxDifference:netAssembliesDifference},scope:'Reproduces saved source samples, not app-versus-source agreement. Mass scripts rerun 999 steps; gravity beam reruns 50. Other models rerun only early windows: 20 planar steps, 5 shell/network steps, 25 cable steps, 10 membrane/robot steps. Only shared saved full-node frames are compared. This does not verify late-time behavior or the nine teaching approximations.'}
  await writeFile('docs/screenshots/reference-reproduction-audit.json',JSON.stringify(report,null,2)+'\n')
  console.log(`\nPASS: ${results.length} source replay comparisons; source assembly and shell elements checked separately`)
}finally{await rm(temp,{recursive:true,force:true})}
