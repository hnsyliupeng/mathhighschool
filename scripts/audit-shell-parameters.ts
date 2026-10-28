// Solver robustness/rollback audit, NOT a reference comparison or parameter convergence study.
import {writeFileSync} from 'node:fs'
import {AxisymmetricShell,type AxisShellKind} from '../src/engine/axisymmetric-shell'
const variants:{kind:AxisShellKind;nodes:number;stiffness:number;load:number}[]=[
  {kind:'inflation',nodes:40,stiffness:1,load:1},
  {kind:'inflation',nodes:24,stiffness:.2,load:0},
  {kind:'inflation',nodes:24,stiffness:.2,load:2},
  {kind:'inflation',nodes:60,stiffness:3,load:2},
  {kind:'eversion',nodes:24,stiffness:200,load:2},
  {kind:'eversion',nodes:60,stiffness:1800,load:2},
  {kind:'eversion',nodes:60,stiffness:1000,load:0},
]
const checks=[]
for(const variant of variants){
  const sim=new AxisymmetricShell(variant.kind,{...variant,damping:.1}),dt=variant.kind==='inflation'?.01:.005,steps=variant.kind==='inflation'?200:1200
  let failure:{step:number;residual:number|null;rolledBack:boolean}|undefined,maxResidual=0,valid=true
  for(let step=1;step<=steps;step++){
    const q=[...sim.q],v=[...sim.v],time=sim.time,branch=sim.branchSwitches,result=sim.step(dt)
    if(!result.converged){
      const rolledBack=sim.time===time&&sim.branchSwitches===branch&&sim.q.every((x,i)=>x===q[i])&&sim.v.every((x,i)=>x===v[i])
      failure={step,residual:Number.isFinite(result.residual)?result.residual:null,rolledBack};valid&&=rolledBack;break
    }
    maxResidual=Math.max(maxResidual,result.residual)
    valid&&=sim.q.every(Number.isFinite)&&sim.v.every(Number.isFinite)
    if(variant.kind==='inflation')valid&&=Math.abs(sim.q[0]-sim.initial[0])<1e-11&&sim.q.at(-2)===sim.initial.at(-2)&&sim.q.at(-1)===sim.initial.at(-1)
    else valid&&=sim.q[0]===sim.initial[0]&&sim.q[2]===sim.initial[2]&&sim.q.at(-1)===sim.initial.at(-1)&&Math.abs(sim.q[1]-(sim.initial[1]-.1*variant.load*sim.time))<1e-9&&Math.abs(sim.q[3]-(sim.initial[3]-.1*variant.load*sim.time))<1e-9
    if(!valid)throw Error(`Non-finite value or constraint violation in ${JSON.stringify(variant)} at step ${step}`)
  }
  // A converged algebraic residual is not a material-validity or stability test.
  const maxMeridionalStrain=sim.maxMeridionalStrain()
  const maxAbsAxialPosition=Math.max(...sim.q.filter((_,i)=>i%2===1).map(Math.abs))
  const report={...variant,dt,targetSteps:steps,completedSteps:Math.round(sim.time/dt),completed:!failure,maxResidual,maxMeridionalStrain,maxAbsAxialPosition,branchSwitches:sim.branchSwitches,constraintsAndRollbackValid:valid,...(failure?{failure}:{})}
  checks.push(report);console.log(JSON.stringify(report))
}
const report={date:new Date().toISOString().slice(0,10),nodeVersion:process.version,scope:'Selected slider extremes test finite values, prescribed DOFs and failure rollback only; large strain is reported, not accepted as physical validity. No original-reference comparison or parameter/mesh convergence claim.',checks}
writeFileSync('docs/screenshots/shell-parameter-audit.json',JSON.stringify(report,null,2)+'\n')
if(checks.some(c=>!c.constraintsAndRollbackValid))process.exitCode=1
