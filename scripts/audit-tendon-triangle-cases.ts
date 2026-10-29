import {writeFileSync} from 'node:fs'
import {trianglePairClosest} from '../src/engine/tendon-dynamic-grasp'
import type {Vec3} from '../src/engine/gripper3d'
let state=947331
function random(){state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}
function point():Vec3{return [(random()-.5)*.1,(random()-.5)*.1,(random()-.5)*.1]}
const cases=[]
for(let i=0;i<240;i++){
  const a=[point(),point(),point()] as [Vec3,Vec3,Vec3];let b:[Vec3,Vec3,Vec3]
  if(i%4===0){const shift:Vec3=[(random()-.5)*.001,(random()-.5)*.001,(random()-.5)*.001];b=a.map(p=>p.map((x,k)=>x+shift[k]) as Vec3) as [Vec3,Vec3,Vec3]}
  else if(i%4===1){const mid=a[0].map((x,k)=>(x+a[1][k]+a[2][k])/3) as Vec3;b=[mid.map((x,k)=>x+(k===0?-.01:0)) as Vec3,mid.map((x,k)=>x+(k===0?.01:0)) as Vec3,point()]}
  else b=[point(),point(),point()]
  cases.push({a,b,result:trianglePairClosest(a,b)})
}
writeFileSync('/tmp/tendon-triangle-cases.json',JSON.stringify(cases)+'\n')
console.log('wrote',cases.length,'triangle pairs')
