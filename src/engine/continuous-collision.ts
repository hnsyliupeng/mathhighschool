/** Conservative continuous collision checks for linearly moving primitives.
 *
 * Bounds use the maximum relative vertex speed. Distance between two moving
 * convex primitives is Lipschitz continuous with that bound. Advancing by
 * less than (distance - clearance) / speed cannot skip a collision. A failure
 * to finish is reported as INDETERMINATE, never as safe.
 */
import type {Vec3} from './gripper3d'
import {segmentTriangleClosest,closestSegments} from './segment-triangle'

type Tri=[Vec3,Vec3,Vec3]
type Seg=[Vec3,Vec3]
export type CCDResult={safe:boolean;reason:'separated'|'collision'|'indeterminate';iterations:number;time:number;distance:number}
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const norm=(a:Vec3)=>Math.hypot(a[0],a[1],a[2])
const lerp=(a:Vec3,b:Vec3,t:number):Vec3=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]
const velocity=(a:Vec3[],b:Vec3[])=>a.map((v,i)=>sub(b[i],v))
function relativeSpeed(a:Vec3[],b:Vec3[]){let v=0;for(const x of a)for(const y of b)v=Math.max(v,norm(sub(x,y)));return v}
export function triangleTriangleDistance(a:Tri,b:Tri):number {
  let d=Infinity
  for(let i=0;i<3;i++){
    d=Math.min(d,segmentTriangleClosest(a[i],a[(i+1)%3],...b).distance)
    if(d===0)return 0
    d=Math.min(d,segmentTriangleClosest(b[i],b[(i+1)%3],...a).distance)
    if(d===0)return 0
  }
  return d
}
function advance(distance:(time:number)=>number,speed:number,clearance:number,maxIterations:number):CCDResult {
  // Invalid tolerances must not turn an intersecting pair into a 'safe' one.
  if(!Number.isFinite(speed)||speed<0||!Number.isFinite(clearance)||clearance<0||!Number.isInteger(maxIterations)||maxIterations<1)return {safe:false,reason:'indeterminate',iterations:0,time:0,distance:NaN}
  let t=0,d=distance(0)
  for(let iteration=0;iteration<maxIterations;iteration++){
    if(!Number.isFinite(d))return {safe:false,reason:'indeterminate',iterations:iteration+1,time:t,distance:d}
    // A 1 pm guard covers roundoff at meter-scale coordinates; this is a
    // conservative guard, not an extra allowed penetration.
    const margin=d-clearance-1e-12
    if(margin<=0)return {safe:false,reason:'collision',iterations:iteration+1,time:t,distance:d}
    if(speed===0||margin>speed*(1-t))return {safe:true,reason:'separated',iterations:iteration+1,time:1,distance:d}
    const delta=.8*margin/speed
    if(!(delta>1e-12))return {safe:false,reason:'indeterminate',iterations:iteration+1,time:t,distance:d}
    t=Math.min(1,t+delta);d=distance(t)
    if(t>=1)return {safe:d>clearance+1e-12,reason:d>clearance+1e-12?'separated':'collision',iterations:iteration+1,time:1,distance:d}
  }
  return {safe:false,reason:'indeterminate',iterations:maxIterations,time:t,distance:d}
}
export function movingSegmentTriangle(p0:Seg,p1:Seg,t0:Tri,t1:Tri,clearance:number,maxIterations=500):CCDResult {
  const v=relativeSpeed(velocity(p0,p1),velocity(t0,t1))
  return advance(t=>segmentTriangleClosest(lerp(p0[0],p1[0],t),lerp(p0[1],p1[1],t),lerp(t0[0],t1[0],t),lerp(t0[1],t1[1],t),lerp(t0[2],t1[2],t)).distance,v,clearance,maxIterations)
}
export function movingSegments(a0:Seg,a1:Seg,b0:Seg,b1:Seg,clearance=0,maxIterations=500):CCDResult {
  const v=relativeSpeed(velocity(a0,a1),velocity(b0,b1))
  return advance(t=>closestSegments(lerp(a0[0],a1[0],t),lerp(a0[1],a1[1],t),lerp(b0[0],b1[0],t),lerp(b0[1],b1[1],t)).distance,v,clearance,maxIterations)
}
export function movingTriangles(a0:Tri,a1:Tri,b0:Tri,b1:Tri,clearance=0,maxIterations=500):CCDResult {
  const v=relativeSpeed(velocity(a0,a1),velocity(b0,b1))
  return advance(t=>triangleTriangleDistance(a0.map((v,i)=>lerp(v,a1[i],t)) as Tri,b0.map((v,i)=>lerp(v,b1[i],t)) as Tri),v,clearance,maxIterations)
}