/* Generate deterministic trajectories for an independent NumPy audit of
 * the whole-element Bernstein Jacobian bound. Not an equilibrium solve.
 * npx vite-node scripts/generate-hex-jacobian-cases.ts /tmp/hex-jac-cases.json */
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {makeGripper3DMesh,type Vec3} from '../src/engine/gripper3d'
import {hexesFromStructuredTets} from '../src/engine/hexahedron'
import {certifyHexJacobian} from '../src/engine/hex-jacobian-bound'

const mesh=makeGripper3DMesh(1),original=hexesFromStructuredTets(mesh)[0],reference=original.nodes.map(i=>mesh.reference[i]),hex={...original,nodes:[0,1,2,3,4,5,6,7]}
const size=[0,1,2].map(k=>reference[1<<k][k]-reference[0][k]);let seed=0x9651da79
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)
const cases:{name:string;from:Vec3[];to:Vec3[];referenceVolume:number;certificate:ReturnType<typeof certifyHexJacobian>}[]=[]
function add(name:string,from:Vec3[],to:Vec3[],cell=hex){cases.push({name,from,to,referenceVolume:8*cell.weight,certificate:certifyHexJacobian(cell,from,to)})}
for(let i=0;i<200;i++){
  const from=reference.map(p=>p.map((x,k)=>x+(random()-.5)*size[k]*.9) as Vec3),to=reference.map(p=>p.map((x,k)=>x+(random()-.5)*size[k]*.9) as Vec3)
  add(`random-${i}`,from,to)
}
const lo=reference[0],positive=reference.map((_,n):Vec3=>{const u=n&1?1:0,v=n&2?1:0,w=n&4?1:0;return [lo[0]+size[0]*u,lo[1]+size[1]*((u-.5)*v+.2*w),lo[2]+size[2]*(-.2*v+(u-.5)*w)]})
add('positive-requires-subdivision',positive,positive)
const inverted:Vec3[]=[[.0011839371069024007,-.00046401190587785094,-.0006042498403787612],[.004525058459800979,-.0018535468155983833,.0012283420960605145],[-.004364521570503712,.002941483154310845,-.0016419087305665017],[.006766329817163448,.005254662910383194,.0019544124837219718],[-.0008811420146375894,-.00177202211569529,.003789353475570679],[.006857310004842778,-.0002769661973696202,.0036544515655934813],[-.00197957498456041,.003229865973140113,.0031229020467400553],[.004972780226108929,.00448481164816767,.0020712222696840765]]
add('corner-inversion-missed-by-gauss-and-tets',inverted,inverted)
// Exact integer rank-two affine maps test cancellation in determinant
// evaluation. Python can independently establish their zero determinant
// using arbitrary-precision integer arithmetic.
for(let i=0;i<20;i++){
  const a=i===0?[-85726087,-6961944,-26373100]:Array.from({length:3},()=>Math.floor((random()-.5)*2e8))
  const b=i===0?[-34790182,-82239127,17849900]:Array.from({length:3},()=>Math.floor((random()-.5)*2e8))
  const A=[a,b,a.map((v,j)=>v+b[j])],p=Array.from({length:8},(_,n)=>A.map(row=>row.reduce((sum,x,j)=>sum+x*((n>>j)&1),0)) as Vec3)
  add(`exact-singular-cancellation-${i}`,p,p,{...hex,weight:1/8})
}
const codeHash=createHash('sha256').update(readFileSync('src/engine/hex-jacobian-bound.ts')).digest('hex'),path=process.argv[2]||'/tmp/hex-jac-cases.json'
writeFileSync(path,JSON.stringify({codeHash,referenceVolume:8*hex.weight,cases})+'\n');console.log(`Generated ${cases.length} trajectories at ${path}`)
