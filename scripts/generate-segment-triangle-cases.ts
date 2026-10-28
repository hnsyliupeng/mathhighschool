/* Deterministic random segment/triangle pairs for an independent SciPy QP audit. */
import {writeFileSync} from 'node:fs'
import {segmentTriangleClosest} from '../src/engine/segment-triangle'
import type {Vec3} from '../src/engine/gripper3d'
let seed=0x4b1d2026
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const point=():Vec3=>[(rand()-.5)*2,(rand()-.5)*2,(rand()-.5)*2]
const cases=[]
for(let i=0;i<500;i++){
  const p=point(),q=point(),a=point(),b=point(),c=point(),hit=segmentTriangleClosest(p,q,a,b,c)
  cases.push({p,q,a,b,c,distance:hit.distance,t:hit.segmentT,bary:hit.bary})
}
const path=process.argv[2]||'/tmp/gripper3d-segment-cases.json';writeFileSync(path,JSON.stringify(cases));console.log(`Generated ${cases.length} cases at ${path}`)
