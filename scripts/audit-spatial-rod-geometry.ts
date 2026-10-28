// Compare three prescribed local rod frames and angle gradients with Octave.
// Does not test a full spatial rod trajectory, history or translational forces.
import {writeFileSync} from 'node:fs'
import fixture from '../src/data/references/spatial-rod-geometry-reference.json'
import {spatialRodGeometry,spatialRodAngleGradient,type SpatialRodInput} from '../src/engine/spatial-rod-geometry'
const reports=fixture.fixtures.map(({input,expected})=>{
  const spec=input as unknown as SpatialRodInput,actual=spatialRodGeometry(spec),gradient=spatialRodAngleGradient(spec)
  let maxFrameError=0,maxScalarError=0,maxAngleGradientError=0,maxFiniteDifferenceError=0
  for(const key of ['te','tf','d1e','d2e','d1f','d2f','m1e','m2e','m1f','m2f','kb','kappa'] as const)for(let i=0;i<actual[key].length;i++)maxFrameError=Math.max(maxFrameError,Math.abs(actual[key][i]-expected[key][i]))
  for(const key of ['twist','bendingEnergy','twistingEnergy'] as const)maxScalarError=Math.max(maxScalarError,Math.abs(actual[key]-expected[key]))
  for(const key of ['bending','twisting'] as const){const reference=key==='bending'?expected.bendingGradient:expected.twistingGradient;for(let i=0;i<2;i++)maxAngleGradientError=Math.max(maxAngleGradientError,Math.abs(gradient[key][i]-reference[i]))}
  const h=1e-6
  for(let i=0;i<2;i++){
    const a:[number,number]=[...spec.theta],b:[number,number]=[...spec.theta];a[i]+=h;b[i]-=h
    const plus=spatialRodGeometry({...spec,theta:a}),minus=spatialRodGeometry({...spec,theta:b})
    maxFiniteDifferenceError=Math.max(maxFiniteDifferenceError,Math.abs((plus.bendingEnergy-minus.bendingEnergy)/(2*h)-gradient.bending[i]),Math.abs((plus.twistingEnergy-minus.twistingEnergy)/(2*h)-gradient.twisting[i]))
  }
  const passed=maxFrameError<2e-12&&maxScalarError<2e-12&&maxAngleGradientError<2e-12&&maxFiniteDifferenceError<1e-8
  return {name:input.name,maxFrameError,maxScalarError,maxAngleGradientError,maxFiniteDifferenceError,passed}
})
const report={date:new Date().toISOString().slice(0,10),referenceCommit:fixture.metadata.reference_commit,runner:fixture.metadata.runner,reports,scope:'Three prescribed local geometries: upstream initialization, material rotations and two angle components of bending/twist energy gradient. No trajectory, translational forces, complete Hessian, evolving reference twist, or spatial-rod case validation.'}
writeFileSync('docs/screenshots/spatial-rod-geometry-audit.json',JSON.stringify(report,null,2)+'\n')
for(const row of reports)console.log(`${row.passed?'PASS':'FAIL'} ${JSON.stringify(row)}`)
if(reports.some(row=>!row.passed))process.exitCode=1
