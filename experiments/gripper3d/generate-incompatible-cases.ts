/* Deterministic element-local states for the research candidate's independent
 * SciPy/NumPy reassembly. This does not test the coupled contact trajectory. */
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {makeGripper3DMesh,type Vec3} from '../../src/engine/gripper3d'
import {hexesFromStructuredTets} from '../../src/engine/hexahedron'
import {neoHookeanHexEnhanced} from './incompatible-hex'
const mesh=makeGripper3DMesh(),original=hexesFromStructuredTets(mesh)[0],reference=original.nodes.map(i=>mesh.reference[i]),hex={...original,nodes:[0,1,2,3,4,5,6,7]},size=[0,1,2].map(k=>reference[1<<k][k]-reference[0][k]);let seed=0x73d1ca21
const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296-.5)
const cases=[]
for(let n=0;n<20;n++){
  const positions=reference.map(([x,y,z]):Vec3=>[1.04*x+.02*y,-.015*x+.98*y,.025*x+1.01*z]).map(p=>p.map((v,i)=>v+rand()*size[i]*.10) as Vec3)
  const r=neoHookeanHexEnhanced(positions,hex,250000,.35)
  cases.push({positions,alpha:Array.from(r.alpha),energy:r.energy,gradient:Array.from(r.gradient),localResidual:r.localResidual,minJ:r.minJ})
}
const inputs=['src/engine/gripper3d.ts','src/engine/hexahedron.ts','experiments/gripper3d/incompatible-hex.ts'],hash=createHash('sha256');for(const p of inputs)hash.update(p).update(readFileSync(p))
const path=process.argv[2]||'/tmp/incompatible-hex-cases.json';writeFileSync(path,JSON.stringify({codeHash:hash.digest('hex'),reference,size,weight:hex.weight,young:250000,poisson:.35,cases})+'\n');console.log(`Generated ${cases.length} local element states: ${path}`)
