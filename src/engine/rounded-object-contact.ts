/** Exact contact against a fixed union of rounded convex cores. A segment core
 * dilated by a ball is a capsule (a zero-length segment is a sphere). A
 * rectangular planar core dilated by a ball is a rounded cuboid of thickness
 * 2r. Multiple primitives describe a union, not an arbitrary mesh or material.
 * Forces are frictionless and are assembled on the deforming triangle. */
import type {Vec3} from './gripper3d'
import {boxDistance,segmentTriangleClosest} from './segment-triangle'
import {movingSegmentTriangle,movingTriangles} from './continuous-collision'

type Tri=[Vec3,Vec3,Vec3]
export type RoundedPrimitive=
  |{kind:'segment';a:Vec3;b:Vec3;radius:number}
  |{kind:'rectangle';corners:[Vec3,Vec3,Vec3,Vec3];radius:number}
export interface FixedRoundedObject {primitives:RoundedPrimitive[];stiffnessPerArea:number}
export interface ObjectContact {primitive:number;triangle:[number,number,number];point:Vec3;corePoint:Vec3;force:Vec3;gap:number;lambda:number}
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const mul=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s]
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const length=(v:Vec3)=>Math.hypot(...v)
export function coreVertices(p:RoundedPrimitive):Vec3[]{return p.kind==='segment'?[p.a,p.b]:p.corners}
export function validateRoundedObject(obj:FixedRoundedObject):void{
  if(!obj||!Array.isArray(obj.primitives)||obj.primitives.length<1||obj.primitives.length>12||!Number.isFinite(obj.stiffnessPerArea)||obj.stiffnessPerArea<=0)throw Error('Invalid rounded object')
  for(const p of obj.primitives){
    if(!p||!Number.isFinite(p.radius)||p.radius<=0||p.radius<2e-6||(p.kind!=='segment'&&p.kind!=='rectangle'))throw Error('Invalid rounded primitive')
    const points=coreVertices(p)
    if(points.length!==(p.kind==='segment'?2:4)||!points.every(q=>Array.isArray(q)&&q.length===3&&q.every(Number.isFinite)))throw Error('Invalid primitive coordinates')
    if(p.kind==='rectangle'){
      const [a,b,c,d]=p.corners,u=sub(b,a),v=sub(d,a),lu=length(u),lv=length(v)
      const closure=length(sub(add(a,c),add(b,d)))
      if(lu<1e-8||lv<1e-8||length(cross(u,v))<1e-16||Math.abs(dot(u,v))>1e-9*lu*lv||closure>1e-9*Math.max(lu,lv))throw Error('Invalid rectangular core')
    }
  }
}
/** Unsigned exact closest pair between a convex core and one deforming
 * triangle. The radius gives signed gap d(core,T)-r. Degenerate intersections
 * fail closed: the normal is not defined at zero distance. */
export function roundedCoreTriangleClosest(primitive:RoundedPrimitive,tri:Tri){
  if(primitive.kind==='segment'){
    const h=segmentTriangleClosest(primitive.a,primitive.b,...tri)
    return {distance:h.distance,point:h.surface,corePoint:h.point,bary:h.bary}
  }
  const [a,b,c,d]=primitive.corners,cores:Tri[]=[[a,b,c],[a,c,d]]
  let best:{distance:number;point:Vec3;corePoint:Vec3;bary:[number,number,number]}|null=null
  const record=(distance:number,point:Vec3,corePoint:Vec3,bary:[number,number,number])=>{if(!best||distance<best.distance)best={distance,point,corePoint,bary}}
  for(const core of cores)for(let i=0;i<3;i++){
    const j=(i+1)%3,h=segmentTriangleClosest(core[i],core[j],...tri)
    record(h.distance,h.surface,h.point,h.bary)
    const k=segmentTriangleClosest(tri[i],tri[j],...core),bary:[number,number,number]=[0,0,0]
    bary[i]=1-k.segmentT;bary[j]=k.segmentT;record(k.distance,k.point,k.surface,bary)
  }
  if(!best)throw Error('No rectangular closest pair')
  return best as {distance:number;point:Vec3;corePoint:Vec3;bary:[number,number,number]}
}
export function roundedTriangleContact(primitive:RoundedPrimitive,tri:Tri,stiffness:number,multiplier:number){
  if(!Number.isFinite(stiffness)||stiffness<=0||!Number.isFinite(multiplier)||multiplier<0)throw Error('Invalid object contact parameters')
  const h=roundedCoreTriangleClosest(primitive,tri),gap=h.distance-primitive.radius,lambda=Math.max(0,multiplier-stiffness*gap)
  if(!Number.isFinite(h.distance)||h.distance<1e-12)throw Error('Object core touches or crosses the finger triangle')
  const normal=mul(sub(h.point,h.corePoint),1/h.distance)
  return {...h,gap,lambda,normal,energy:lambda*lambda/(2*stiffness)}
}
/** Conservative CCD for every fixed primitive against every linearly moving
 * finger surface triangle. The lower AABB distance is safe for the entire
 * linear trajectory; any collision or indeterminate result is rejected. */
export function roundedObjectMotion(obj:FixedRoundedObject,faces:readonly {nodes:[number,number,number]}[],from:Vec3[],to:Vec3[],allowance:number){
  if(!Number.isFinite(allowance)||allowance<0||from.length!==to.length||!from.every(p=>p.length===3&&p.every(Number.isFinite))||!to.every(p=>p.length===3&&p.every(Number.isFinite)))return {safe:false,checks:0,reason:'invalid object motion'}
  let checks=0
  try{
    validateRoundedObject(obj)
    for(const primitive of obj.primitives){
      if(allowance>=primitive.radius)return {safe:false,checks,reason:'invalid object clearance'}
      const core=coreVertices(primitive),clearance=primitive.radius-allowance
      for(const face of faces){
        const a=face.nodes.map(i=>from[i]) as Tri,b=face.nodes.map(i=>to[i]) as Tri
        if(a.some(p=>!p)||b.some(p=>!p))return {safe:false,checks,reason:'missing surface vertex'}
        if(boxDistance(core,[...a,...b])>clearance+1e-12)continue
        if(primitive.kind==='segment'){
          checks++;const coreSeg:[Vec3,Vec3]=[primitive.a,primitive.b],r=movingSegmentTriangle(coreSeg,coreSeg,a,b,clearance)
          if(!r.safe)return {safe:false,checks,reason:`capsule–triangle CCD ${r.reason}`}
        }else{
          const [u,v,w,z]=primitive.corners,triangles:Tri[]=[[u,v,w],[u,w,z]]
          for(const coreTri of triangles){checks++;const r=movingTriangles(coreTri,coreTri,a,b,clearance);if(!r.safe)return {safe:false,checks,reason:`rounded-box–triangle CCD ${r.reason}`}}
        }
      }
    }
    return {safe:true,checks,reason:'separated'}
  }catch(error){return {safe:false,checks,reason:`indeterminate object motion: ${error instanceof Error?error.message:String(error)}`}}
}
