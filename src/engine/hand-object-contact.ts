/** Frictionless augmented-Lagrangian contact between a fixed rigid sphere and
 * one deforming, piecewise-linear triangle. Distances and forces are SI.
 * This is a surface discretization, not curved Q1-face contact. */
import type {Vec3} from './gripper3d'
import {closestPointTriangle,boxDistance} from './segment-triangle'
import {movingSegmentTriangle} from './continuous-collision'

type Tri=[Vec3,Vec3,Vec3]
export interface FixedSphere {center:Vec3;radius:number;stiffnessPerArea:number}
export interface SphereContact {
  triangle:[number,number,number];point:Vec3;force:Vec3;gap:number;lambda:number
}
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const length=(v:Vec3)=>Math.hypot(...v)

/** Differentiating the squared projected multiplier gives minus lambda times
 * grad(g); barycentric closest-point coordinates supply grad(g) at a regular
 * feature. The solver uses a positive Gauss-Newton contact tangent. */
export function sphereTriangleContact(sphere:FixedSphere,triangle:Tri,stiffness:number,multiplier:number){
  if(![...sphere.center,sphere.radius,sphere.stiffnessPerArea,stiffness,multiplier,...triangle.flat()].every(Number.isFinite)||sphere.radius<=0||sphere.stiffnessPerArea<=0||stiffness<=0||multiplier<0)throw Error('Invalid sphere contact geometry or parameter')
  if(length(cross(sub(triangle[1],triangle[0]),sub(triangle[2],triangle[0])))<1e-16)throw Error('Degenerate object-contact triangle')
  const hit=closestPointTriangle(sphere.center,...triangle),gap=hit.distance-sphere.radius,lambda=Math.max(0,multiplier-stiffness*gap)
  if(hit.distance<1e-12)throw Error('Sphere center touches or crosses a triangle')
  const normal=sub(hit.point,sphere.center).map(v=>v/hit.distance) as Vec3
  return {gap,lambda,point:hit.point,bary:hit.bary,normal,energy:lambda*lambda/(2*stiffness)}
}

/** CCD for the sphere against all linearly moving triangulated surfaces. The
 * entire swept triangle AABB is used for broad phase; unresolved results fail
 * closed. It permits at most `allowance` compression along numerical paths. */
export function sphereMotion(sphere:FixedSphere,faces:readonly {nodes:[number,number,number]}[],from:Vec3[],to:Vec3[],allowance:number){
  if(!Number.isFinite(allowance)||allowance<0||allowance>=sphere.radius||from.length!==to.length||!from.every(p=>p.length===3&&p.every(Number.isFinite))||!to.every(p=>p.length===3&&p.every(Number.isFinite))||![...sphere.center,sphere.radius].every(Number.isFinite)||sphere.radius<=0)return {safe:false,checks:0,reason:'invalid sphere motion'}
  const clearance=sphere.radius-allowance,point:[Vec3,Vec3]=[sphere.center,sphere.center]
  let checks=0
  try{
    for(const face of faces){
      const a=face.nodes.map(i=>from[i]) as Tri,b=face.nodes.map(i=>to[i]) as Tri
      if(a.some(p=>!p)||b.some(p=>!p))return {safe:false,checks,reason:'missing face vertex'}
      if(boxDistance([sphere.center],[...a,...b])>clearance+1e-12)continue
      checks++
      const r=movingSegmentTriangle(point,point,a,b,clearance)
      if(!r.safe)return {safe:false,checks,reason:`sphere–triangle CCD ${r.reason}`}
    }
    return {safe:true,checks,reason:'separated'}
  }catch(error){return {safe:false,checks,reason:`indeterminate sphere motion: ${error instanceof Error?error.message:String(error)}`}}
}

export function referenceTriangleArea(triangle:Tri){return .5*length(cross(sub(triangle[1],triangle[0]),sub(triangle[2],triangle[0])))}
