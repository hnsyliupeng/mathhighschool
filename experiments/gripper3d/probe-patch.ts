/* Research-only comparison on a prescribed pure-bending displacement.
 * This is not a global equilibrium solve or a replacement for the GUI model.
 * npx vite-node experiments/gripper3d/probe-patch.ts */
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {makeGripper3DMesh,type Vec3} from '../../src/engine/gripper3d'
import {hexesFromStructuredTets,neoHookeanHex} from '../../src/engine/hexahedron'
import {neoHookeanHexEnhanced} from './incompatible-hex'

const E=250000,nu=.35,k=.002,y0=.0035,z0=.004,result=[]
for(const level of [1,2,3] as const){
  const mesh=makeGripper3DMesh(level),hexes=hexesFromStructuredTets(mesh)
  const positions=mesh.reference.map(([x,y,z]):Vec3=>{const Y=y-y0,Z=z-z0;return [x-k*x*Y,y+k*(x*x+nu*(Y*Y-Z*Z))/2,z+nu*k*Y*Z]})
  let exact=0,full=0,candidate=0,exactBridge=0,fullBridge=0,candidateBridge=0,maxLocalIterations=0,maxLocalResidualN=0
  for(const hex of hexes){
    const ref=hex.nodes.map(i=>mesh.reference[i]),x=ref.reduce((s,p)=>s+p[0],0)/8,lo=Math.min(...ref.map(v=>v[1]))-y0,hi=Math.max(...ref.map(v=>v[1]))-y0
    const linearExact=.5*E*k*k*(8*hex.weight)*(lo*lo+lo*hi+hi*hi)/3,Q=neoHookeanHex(positions,hex,E,nu,false),R=neoHookeanHexEnhanced(positions,hex,E,nu,false)
    exact+=linearExact;full+=Q.energy;candidate+=R.energy;maxLocalIterations=Math.max(maxLocalIterations,R.iterations);maxLocalResidualN=Math.max(maxLocalResidualN,R.localResidual)
    if(x>.020&&x<.08/12*5||x>.08/12*8&&x<.08/12*10){exactBridge+=linearExact;fullBridge+=Q.energy;candidateBridge+=R.energy}
  }
  result.push({level,nodes:mesh.reference.length,hexes:hexes.length,exactLinearEnergyJ:exact,q1EnergyJ:full,candidateEnergyJ:candidate,q1DifferencePercent:100*(full/exact-1),candidateDifferencePercent:100*(candidate/exact-1),betweenPads:{exactLinearEnergyJ:exactBridge,q1EnergyJ:fullBridge,candidateEnergyJ:candidateBridge,q1DifferencePercent:100*(fullBridge/exactBridge-1),candidateDifferencePercent:100*(candidateBridge/exactBridge-1)},maxLocalIterations,maxLocalResidualN})
}
const inputs=['src/engine/gripper3d.ts','src/engine/hexahedron.ts','experiments/gripper3d/incompatible-hex.ts'],hash=createHash('sha256');for(const p of inputs)hash.update(p).update(readFileSync(p))
const report={codeHash:hash.digest('hex'),parameters:{youngPa:E,poisson:nu,curvaturePerM:k,neutralAxisYM:y0,axisZM:z0},result,patchCheckPassed:result.every(x=>Math.abs(x.candidateDifferencePercent)<.5&&Math.abs(x.betweenPads.candidateDifferencePercent)<.5&&x.maxLocalResidualN<1e-8),scope:'experimental nonconforming local modes; prescribed nodal pure-bending patch only, not equilibrium, full-path safety, convergence, or production validation'}
writeFileSync('docs/screenshots/gripper3d-incompatible-patch-research.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
if(!report.patchCheckPassed)process.exitCode=1
