// Full UI-duration smoke/rewind audit, not a physical or reference-accuracy test.
import {writeFileSync} from 'node:fs'
import {cases} from '../src/data/cases'
import {defaultsFor,Simulation,type Frame,type Snapshot} from '../src/engine/simulation'

function difference(a:unknown,b:unknown):number {
  if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)?Math.abs(a-b):a===b?0:Infinity
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length?a.reduce((m,x,i)=>Math.max(m,difference(x,b[i])),0):Infinity
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=new Set([...Object.keys(x),...Object.keys(y)])
    let max=0;for(const k of keys)max=Math.max(max,difference(x[k],y[k]));return max
  }
  return a===b?0:Infinity
}
function requireFinite(value:unknown,label:string):void {
  if(typeof value==='number'&&!Number.isFinite(value))throw Error(`Non-finite ${label}: ${value}`)
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)requireFinite(value[i],`${label}[${i}]`)}
  else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))requireFinite(v,`${label}.${key}`)
}
const reports=[]
for(const item of cases){
  const sim=new Simulation(item,defaultsFor(item)),initial=sim.frame(),duration=item.duration??10,steps=Math.round(duration/.01)
  // Copy connectivity: frame.edges/faces reference mutable simulation arrays.
  const edgeEnds=initial.edges.map(e=>[e.a,e.b]),faces=initial.faces.map(f=>[...f]),fixed=[...initial.fixed]
  const result:{id:string;name:string;method:string;targetTime:number;targetSteps:number;completedTime:number;completedSteps:number;replayedStepsChecked:number;nodes:number;edges:number;faces:number;maxAbsPosition:number;maxAbsDisplacement:number;maxResidual:number|null;rewindError:number|null;passed:boolean;error?:string}={
    id:item.id,name:item.title,method:item.method,targetTime:duration,targetSteps:steps,completedTime:0,completedSteps:0,replayedStepsChecked:0,nodes:initial.positions.length,edges:initial.edges.length,faces:initial.faces.length,maxAbsPosition:0,maxAbsDisplacement:0,maxResidual:null,rewindError:null,passed:false}
  try{
    const validIndex=(i:number)=>Number.isInteger(i)&&i>=0&&i<result.nodes
    if(edgeEnds.some(e=>e.some(i=>!validIndex(i)))||faces.some(f=>f.some(i=>!validIndex(i)))||fixed.some(i=>!validIndex(i)))throw Error('Invalid mesh connectivity')
    const checkFrame=(frame:Frame,state:Snapshot)=>{
      if(!frame.converged)throw Error(`Nonconvergence at ${frame.time.toFixed(3)} s; residual ${frame.residual}`)
      if(frame.positions.length!==result.nodes||frame.edges.length!==result.edges||frame.faces.length!==result.faces||frame.fixed.length!==fixed.length)throw Error('Topology changed during playback')
      if(frame.edges.some((e,i)=>e.a!==edgeEnds[i][0]||e.b!==edgeEnds[i][1])||frame.faces.some((f,i)=>f.some((v,j)=>v!==faces[i][j]))||frame.fixed.some((v,i)=>v!==fixed[i]))throw Error('Connectivity changed during playback')
      requireFinite(frame.displacement,'displacement');requireFinite(frame.energy,'energy');requireFinite(frame.residual,'residual')
      requireFinite(frame.meridionalStrain,'meridional strain');requireFinite(frame.netStrain,'network strain');requireFinite(frame.loadCurve,'load curve')
      // Check numerical q/v and branch state, not only the displayed positions.
      requireFinite(state,'snapshot')
      for(const p of frame.positions)for(const x of p){if(!Number.isFinite(x)||Math.abs(x)>1000)throw Error(`Non-finite or runaway display coordinate ${x}`);result.maxAbsPosition=Math.max(result.maxAbsPosition,Math.abs(x))}
      result.maxAbsDisplacement=Math.max(result.maxAbsDisplacement,Math.abs(frame.displacement))
      if(frame.residual!==null)result.maxResidual=Math.max(result.maxResidual??0,frame.residual)
    }
    checkFrame(initial,sim.snapshot())
    const checkedStep=(forward:boolean):Snapshot=>{
      const prev=sim.time,dt=Math.min(.01,duration-prev);sim.step(dt)
      const frame=sim.frame(),state=sim.snapshot()
      if(!(frame.time>prev)||Math.abs(frame.time-Math.min(duration,prev+.01))>1e-8)throw Error(`Incorrect time advancement: ${prev} -> ${frame.time}`)
      checkFrame(frame,state)
      if(forward){result.completedTime=frame.time;result.completedSteps++}else result.replayedStepsChecked++
      return state
    }
    let rewindDone=false
    while(sim.time<duration-1e-9){
      checkedStep(true)
      if(!rewindDone&&sim.time>=duration/2-1e-9&&sim.time+5*.01<duration){
        const saved=sim.snapshot(),expected:Snapshot[]=[]
        for(let i=0;i<5;i++)expected.push(checkedStep(true))
        sim.restore(saved)
        result.rewindError=0
        for(let i=0;i<5;i++)result.rewindError=Math.max(result.rewindError,difference(expected[i],checkedStep(false)))
        rewindDone=true
        if(!(result.rewindError<1e-9))throw Error(`Rewind/resume mismatch ${result.rewindError}`)
      }
    }
    result.passed=Math.abs(sim.time-duration)<1e-8&&result.completedSteps===steps&&result.replayedStepsChecked===5&&result.rewindError!==null
    if(!result.passed)result.error='Did not reach the duration or complete rewind check'
  }catch(error){result.error=error instanceof Error?error.message:String(error);result.completedTime=sim.time}
  reports.push(result);console.log(`${result.passed?'PASS':'FAIL'} ${JSON.stringify(result)}`)
}
writeFileSync('docs/screenshots/full-duration-audit.json',JSON.stringify({date:new Date().toISOString().slice(0,10),nodeVersion:process.version,scope:'Default parameters and UI time steps. Every forward and five replayed steps are checked for convergence flags, time, finite scalar/display/numerical snapshot values, unchanged connectivity and fixed-index lists. Each of the five replay snapshots is compared. A true convergence flag is not an independent residual check for proxy models or linear systems. This is not a reference comparison, proof of physical validity, or a parameter/mesh/time-step convergence study.',reports},null,2)+'\n')
if(reports.some(r=>!r.passed))process.exitCode=1
