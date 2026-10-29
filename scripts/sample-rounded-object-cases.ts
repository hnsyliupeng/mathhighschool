/** Generate deterministic input/output pairs for the independent Python QP audit. */
import {writeFileSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {roundedCoreTriangleClosest,roundedObjectMotion,type RoundedPrimitive} from '../src/engine/rounded-object-contact'
import {closestSegments} from '../src/engine/segment-triangle'
import type {Vec3} from '../src/engine/gripper3d'
type Tri=[Vec3,Vec3,Vec3]
let state=0x279ee1
const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/2**32},range=(a:number,b:number)=>a+(b-a)*rand()
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s]
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=(x:Vec3)=>Math.hypot(...x),unit=(a:Vec3):Vec3=>mul(a,1/norm(a))
const point=():Vec3=>[range(-.07,.07),range(-.07,.07),range(-.07,.07)]
function shape(rectangle:boolean):RoundedPrimitive{
  if(!rectangle){const a=point();return {kind:'segment',a,b:rand()<.2?a:point(),radius:range(.005,.03)}}
  const a=point(),u=unit(sub(point(),a)),trial=unit(sub(point(),a)),normal=unit(cross(u,trial)),v=unit(cross(normal,u)),b=add(a,mul(u,range(.005,.07))),d=add(a,mul(v,range(.005,.07)))
  return {kind:'rectangle',corners:[a,b,add(b,sub(d,a)),d],radius:range(.005,.03)}
}
const staticCases=[]
for(let i=0;i<360;i++){
  const primitive=shape(i%2===1);let t:Tri
  do{t=[point(),point(),point()]}while(norm(cross(sub(t[1],t[0]),sub(t[2],t[0])))<1e-6)
  staticCases.push({primitive,triangle:t,hit:roundedCoreTriangleClosest(primitive,t)})
}
const motionCases=[]
for(let i=0;i<64;i++){
  const primitive:RoundedPrimitive=i%2===0?{kind:'segment',a:[-.02,0,0],b:[.02,0,0],radius:.015}:{kind:'rectangle',corners:[[-.02,-.015,0],[.02,-.015,0],[.02,.015,0],[-.02,.015,0]],radius:.015}
  const x=range(-.025,.025),y=range(-.025,.025),z=range(.025,.08),from:Tri=[[x-.04,y-.04,z],[x+.04,y-.04,z],[x,y+.04,z]],mode=i%4
  const delta:Vec3=mode===0?[range(-.01,.01),range(-.01,.01),range(.01,.04)]:mode===1?[0,0,-2*z]:mode===2?[.16,0,0]:[0,0,.015-z-range(.0001,.01)]
  const to=from.map(p=>add(p,delta)) as Tri,result=roundedObjectMotion({primitives:[primitive],stiffnessPerArea:1},[{nodes:[0,1,2]}],from,to,0)
  motionCases.push({primitive,from,to,clearance:.015,result})
}
const segmentCases=[]
for(let i=0;i<256;i++){
  const p0=point(),p1=i%7===0?p0:point(),q0=point(),q1=i%11===0?q0:point(),hit=closestSegments(p0,p1,q0,q1)
  segmentCases.push({p0,p1,q0,q1,distance:hit.distance})
}
const files=['src/engine/rounded-object-contact.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts'],hash=createHash('sha256');for(const f of files)hash.update(f).update(readFileSync(f))
writeFileSync('/tmp/rounded-object-geometry-cases.json',JSON.stringify({seed:'0x279ee1',codeHash:hash.digest('hex'),sourceFiles:files,staticCases,motionCases,segmentCases}))
console.log(`Generated ${staticCases.length} static, ${motionCases.length} moving and ${segmentCases.length} segment cases`)
