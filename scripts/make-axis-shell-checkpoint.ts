// Produce a *conditional* cap state for independent local source-equation checks.
// This is not a substitute for a continuous original Octave reference trajectory.
import {writeFileSync} from 'node:fs'
import {AxisymmetricShell} from '../src/engine/axisymmetric-shell'
const step=Number(process.argv[2]??780),output=process.argv[3]??'/tmp/axis-shell-checkpoint.json'
if(!Number.isInteger(step)||step<0)throw Error('Step must be non-negative')
const sim=new AxisymmetricShell('eversion',{nodes:40,stiffness:1000,load:1,damping:.1},true)
for(let i=0;i<step;i++){
  const result=sim.step(.005)
  if(!result.accepted)throw Error(`Checkpoint failed at step ${i+1}`)
}
writeFileSync(output,JSON.stringify({step,q:sim.q,v:sim.v,source:'TypeScript source-iteration replay; not an independently generated Octave trajectory.'},null,2)+'\n')
console.log(`Wrote ${output} at t=${sim.time.toFixed(3)} s; residual=${sim.last.residual.toExponential(3)}`)
