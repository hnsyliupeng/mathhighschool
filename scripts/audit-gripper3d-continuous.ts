/* Strict, reproducible audit of the new 3-D contact solver.
 *
 * Run individual cases, potentially in parallel:
 *   npx vite-node scripts/audit-gripper3d-continuous.ts --case mesh1
 *   ... mesh2 mesh3 cable2 cable3 halfstep cycle large penalty2 penalty8 nearZero
 *   npx vite-node scripts/audit-gripper3d-continuous.ts --combine
 * Per-case files live in /tmp; --combine refuses stale/missing solver hashes,
 * writes a report, and exits non-zero unless EVERY required check passes.
 */
import {createHash} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {ContinuousGripper3D,type ContinuousFrame} from '../src/engine/continuous-gripper3d'
import {defaultGripper3DParams,type Gripper3DParams} from '../src/engine/gripper3d'

const inputs=['src/engine/gripper3d.ts','src/engine/continuous-gripper3d.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts']
const hash=createHash('sha256');for(const p of inputs)hash.update(p).update(readFileSync(p));const codeHash=hash.digest('hex')
const baseline={pull:.003}
const specs:Record<string,{params:Partial<Gripper3DParams>;cycle?:boolean;resume?:string}>={
  mesh1:{params:baseline},mesh2:{params:{...baseline,meshLevel:2}},
  mesh1Low:{params:{pull:.0005}},mesh2Low:{params:{pull:.0005,meshLevel:2}},mesh3:{params:{pull:.0005,meshLevel:3}},
  cable2:{params:{...baseline,tendonResolution:2}},cable3:{params:{...baseline,tendonResolution:3}},
  halfstep:{params:{...baseline,step:.000125}},cycle:{params:baseline,cycle:true},large:{params:{pull:.005}},
  penalty2:{params:{...baseline,contactPerLength:2e6}},penalty8:{params:{...baseline,contactPerLength:8e6}},thinCable:{params:{...baseline,radius:.0002}},nearZero:{params:{...baseline,radius:.000001}},
  curl:{params:{pull:.01475}},curlHalfstep:{params:{pull:.01475,step:.000125}},
  curlCable2:{params:{pull:.01475,tendonResolution:2}},curlCable3:{params:{pull:.01475,tendonResolution:3}},curlMesh2:{params:{pull:.01475,meshLevel:2}},curlCycle:{params:{pull:.01475},cycle:true,resume:'curl'},
}
const dir='/tmp/gripper3d-continuous-audit';mkdirSync(dir,{recursive:true})
const names=Object.keys(specs)
const brief=(f:ContinuousFrame)=>({pullMm:f.pull*1e3,tipMm:f.tipDeflection*1e3,tipAngleDeg:f.tipAngleDeg,tensionN:f.tension,contacts:f.contacts.length,contactSumN:f.contactForce,penetrationUm:f.checkPenetration*1e6,complementarityUm:f.complementarity*1e6,minGapUm:f.minGap*1e6,residualN:f.residual,forceBalanceN:f.forceBalance,torqueBalanceNm:f.torqueBalance,minJ:f.minJ,minPathJ:f.minPathJ,interiorNodes:f.interiorNodes,surfaceIntersections:f.surfaceIntersections,selfIntersections:f.selfIntersections,volumeOverlaps:f.volumeOverlaps,sweptChecks:f.collisionChecks,solidChecks:f.solidChecks,outerIterations:f.outerIterations,substeps:f.substeps,iterations:f.iterations,converged:f.converged,contactConverged:f.contactConverged})
function run(name:string){
  const spec=specs[name];if(!spec)throw Error(`Unknown case: ${name}; available: ${names.join(', ')}`)
  const params={...defaultGripper3DParams,...spec.params},s=new ContinuousGripper3D(params),frames:ContinuousFrame[]=[],n=Math.ceil(params.pull/params.step)
  let failure:string|null=null
  if(spec.resume){
    const prior=JSON.parse(readFileSync(`${dir}/${spec.resume}.json`,'utf8')),state=JSON.parse(readFileSync(`${dir}/${spec.resume}-state.json`,'utf8'))
    const coordinates=[...state.frame.positions,...state.frame.tendon].flat()
    if(prior.codeHash!==codeHash||(state.codeHash&&state.codeHash!==codeHash)||prior.failure||JSON.stringify(prior.params)!==JSON.stringify(params)||JSON.stringify(state.params)!==JSON.stringify(params)||JSON.stringify(state.mesh)!==JSON.stringify(s.mesh)||JSON.stringify(brief(state.frame))!==JSON.stringify(prior.loaded)||state.frame.pull!==params.pull||!state.frame.converged||state.q.length!==coordinates.length||state.q.some((v:number,i:number)=>!Number.isFinite(v)||v!==coordinates[i])||state.multipliers.length!==s.lambda.length||state.multipliers.some((v:number)=>!Number.isFinite(v)||v<0))throw Error('Invalid or stale resume state')
    s.q.set(state.q);s.lambda.set(state.multipliers);s.pull=state.frame.pull;s.last=state.frame;frames.push(s.last)
  }else{
    frames.push(s.last)
    for(let i=1;i<=n;i++){
      const f=s.step(Math.min(params.pull,i*params.step));if(!f.converged){failure=`loading ${i}: ${f.message}`;break}frames.push(f)
      console.log(name,JSON.stringify(brief(f)))
    }
  }
  const loaded=frames.at(-1)!
  if(!failure&&spec.cycle)for(let i=n-1;i>=0;i--){
    const f=s.step(Math.min(params.pull,i*params.step));if(!f.converged){failure=`unloading ${i}: ${f.message}`;break}frames.push(f);console.log(name,'unload',JSON.stringify(brief(f)))
  }
  const result={name,codeHash,params,mesh:{nodes:s.mesh.reference.length,hexes:s.hexes.length,boundaryTriangles:s.mesh.surface.length,tendonSegments:s.cableCount-1},failure,loaded:brief(loaded),final:brief(frames.at(-1)!),history:frames.map(brief)}
  writeFileSync(`${dir}/${name}.json`,JSON.stringify(result,null,2)+'\n')
  if(name==='mesh1'||name==='curl')writeFileSync(`${dir}/${name}-state.json`,JSON.stringify({codeHash,params,mesh:s.mesh,q:Array.from(s.q),multipliers:Array.from(s.lambda),frame:s.last,fixed:Array.from(s.fixedDofs)}))
  console.log(`${name}: ${failure?'FAIL '+failure:'done'}`);if(failure)process.exitCode=1
}
function combine(){
  const results:Record<string,ReturnType<typeof readCase>>={};const missing:string[]=[]
  function readCase(name:string){return JSON.parse(readFileSync(`${dir}/${name}.json`,'utf8')) as {name:string;codeHash:string;failure:string|null;params:Gripper3DParams;mesh:Record<string,number>;loaded:ReturnType<typeof brief>;final:ReturnType<typeof brief>;history:ReturnType<typeof brief>[]}}
  for(const name of names){
    if(!existsSync(`${dir}/${name}.json`)){missing.push(name);continue}
    const r=readCase(name),spec=specs[name],expected={...defaultGripper3DParams,...spec.params}
    if(r.codeHash!==codeHash){missing.push(`${name} (stale code)`);continue}
    if(r.name!==name||JSON.stringify(r.params)!==JSON.stringify(expected)){missing.push(`${name} (stale parameters)`);continue}
    if(!Array.isArray(r.history)||!r.history.length||!r.loaded||!r.final||(!r.failure&&(Math.abs(r.loaded.pullMm-r.params.pull*1e3)>1e-8||(spec.cycle&&Math.abs(r.final.pullMm)>1e-8)))){missing.push(`${name} (incomplete path)`);continue}
    results[name]=r
  }
  const all=Object.values(results),relative=(x:number,y:number)=>Math.abs(y-x)/Math.max(Math.abs(x),1e-12)*100
  const pair=(a:string,b:string)=>results[a]&&results[b]?{tipPercent:relative(results[a].loaded.tipMm,results[b].loaded.tipMm),tensionPercent:relative(results[a].loaded.tensionN,results[b].loaded.tensionN)}:null
  const grid12=pair('mesh1','mesh2'),grid23=pair('mesh2Low','mesh3'),cable12=pair('mesh1','cable2'),cable23=pair('cable2','cable3'),steps=pair('mesh1','halfstep'),penalty=pair('penalty2','penalty8'),curlSteps=pair('curl','curlHalfstep'),curlCable=pair('curl','curlCable2'),curlCable23=pair('curlCable2','curlCable3'),curlGrid=pair('curl','curlMesh2')
  const both=(x:{tipPercent:number;tensionPercent:number}|null,tol:number)=>!!x&&x.tipPercent<tol&&x.tensionPercent<tol
  const rows=all.flatMap(x=>x.history),checks={
    allCasesPresent:missing.length===0,
    allPathsConverged:missing.length===0&&all.every(x=>!x.failure&&x.history.every(f=>f.converged)),
    allContactKKT:rows.length>0&&rows.every(f=>f.contactConverged&&f.penetrationUm<=.020001&&f.complementarityUm<=.020001),
    forceAndMoment:rows.length>0&&rows.every(f=>f.residualN<2e-5&&f.forceBalanceN<2e-5&&f.torqueBalanceNm<2e-6),
    noDiscreteInterference:rows.length>0&&rows.every(f=>!f.interiorNodes&&!f.surfaceIntersections&&!f.selfIntersections&&!f.volumeOverlaps),
    pathChecksAndPositiveJ:rows.length>0&&rows.every(f=>f.minJ>0&&f.minPathJ>0&&f.sweptChecks>0),
    loadingAndUnloading:!!results.cycle&&!results.cycle.failure&&Math.abs(results.cycle.final.tipMm)<.02&&results.cycle.final.tensionN<.0001,
    largeCurlUnloading:!!results.curlCycle&&!results.curlCycle.failure&&Math.abs(results.curlCycle.final.tipMm)<.02&&results.curlCycle.final.tensionN<.0001,
    largeDeformation5mm:!!results.large&&!results.large.failure&&results.large.loaded.pullMm>=5-1e-9,
    realTipRotationOver90:!!results.curl&&!results.curl.failure&&results.curl.loaded.tipAngleDeg>=90,
    largeCurlLoadStepConverged:both(curlSteps,5),
    largeCurlTendonConverged:both(curlCable,5)&&both(curlCable23,5),
    largeCurlMeshConverged:both(curlGrid,5),
    meshConverged:both(grid12,5)&&both(grid23,5),
    tendonConverged:both(cable12,5)&&both(cable23,5),
    loadStepConverged:both(steps,5),
    augmentedScaleConverged:both(penalty,5),
    radiusSensitivity:!!results.thinCable&&!!results.mesh1&&!results.thinCable.failure&&results.thinCable.loaded.contacts>0&&Math.abs(results.thinCable.loaded.tensionN-results.mesh1.loaded.tensionN)>.001,
    extremelyThinTendonStressCase:!!results.nearZero&&!results.nearZero.failure,
    // The finite-element hex surface is represented by flat triangles and
    // the swept interior is not independently tested pairwise. Do not call
    // the entire continuum an interference-free certified physical model.
    continuumInteriorAndCurvedFaceCCD:false,
  }
  const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),report={date:new Date().toISOString(),codeHash,scope:'quasi-static assumed gripper; not calibrated or experimental',scopeLimitations:{experimentalCalibration:false,objectContact:false,rowChecks:'accepted frames only; rejected steps are recorded separately as failures',comparisons:'endpoints at specified loads; not full-path convergence'},criteria:{forceResidualN:2e-5,contactComplementarityUm:.02,meshAndStepDifferencePercent:5},missing,checks,comparisons:{grid12,grid23,cable12,cable23,steps,penalty,curlSteps,curlCable,curlCable23,curlGrid},results:all,failed,passed:failed.length===0}
  writeFileSync('docs/screenshots/gripper3d-continuous-audit.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({checks,comparisons:report.comparisons,missing,failed},null,2))
  if(failed.length){console.error('FAIL: strict acceptance requires every item; see docs/screenshots/gripper3d-continuous-audit.json');process.exitCode=1}else console.log('PASS')
}
const index=process.argv.indexOf('--case')
if(index>=0)run(process.argv[index+1]);else if(process.argv.includes('--combine'))combine();else{console.log(`Use --case NAME or --combine. Cases: ${names.join(', ')}`);process.exitCode=2}
