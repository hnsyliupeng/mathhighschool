// Boundary-control/rollback audit; this is not a parameter-by-parameter reference comparison.
import {writeFileSync} from 'node:fs'
import {GravityNet} from '../src/engine/net-gravity'

const scenarios=[
  {name:'default',stiffness:1,load:50,damping:.1},
  {name:'no-gravity',stiffness:1,load:0,damping:.1},
  {name:'soft-high-gravity-undamped',stiffness:.2,load:100,damping:0},
  {name:'stiff-high-gravity-high-damping',stiffness:3,load:100,damping:1},
  {name:'soft-low-gravity-high-damping',stiffness:.2,load:1,damping:1},
]
const results=[]
for(const {name,...params} of scenarios){
  const sim=new GravityNet(params);let attempted=0,maxResidual=0,minresFallbacks=0,converged=true,rollback:boolean|null=null
  for(let i=0;i<200;i++){
    const q=sim.q.slice(),v=sim.v.slice(),time=sim.time;attempted++
    const step=sim.step(.01);minresFallbacks+=step.minresFallbacks
    if(!step.converged){converged=false;rollback=sim.time===time&&q.every((x,j)=>sim.q[j]===x)&&v.every((x,j)=>sim.v[j]===x);break}
    maxResidual=Math.max(maxResidual,step.residual)
  }
  const finite=sim.q.every(Number.isFinite)&&sim.v.every(Number.isFinite),fixed=[...sim.fixedNodes].every(n=>[0,1,2].every(k=>sim.q[3*n+k]===sim.initial[3*n+k]))
  const maxStrain=sim.maxEdgeStrain()
  const row={name,params,attempted,finishedTime:sim.time,converged,rollback,finite,fixed,maxResidual,minresFallbacks,finalMaxAbsEdgeStrain:maxStrain,centerDisplacement:sim.q[2]-sim.initial[2]}
  if(!finite||!fixed||rollback===false)throw Error(`State invariant failed: ${JSON.stringify(row)}`)
  results.push(row);console.log(JSON.stringify(row))
}
writeFileSync('docs/screenshots/net-parameter-audit.json',JSON.stringify({date:new Date().toISOString().slice(0,10),results,scope:'Control boundary checks and failure rollback only; not an independent source comparison, convergence study, or material-validity assessment.'},null,2)+'\n')
