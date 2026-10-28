/** Exact closest pair between a closed line segment and a closed triangle.
 * No sampling along the segment. Distances are in the current configuration.
 * A segment/face intersection returns zero, including contact at a mouth edge.
 */
import type {Vec3} from './gripper3d'

type V=Vec3
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const scale=(a:V,k:number):V=>[a[0]*k,a[1]*k,a[2]*k]
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const clamp=(a:number)=>Math.min(1,Math.max(0,a))
const length=(a:V)=>Math.hypot(a[0],a[1],a[2])

export interface SegmentTriangleClosest {distance:number;segmentT:number;bary:[number,number,number];point:V;surface:V;normal:V;intersects:boolean}

/** Closest points of two segments; handles degenerate and parallel segments. */
export function closestSegments(p0:V,p1:V,q0:V,q1:V){
  const u=sub(p1,p0),v=sub(q1,q0),w=sub(p0,q0),a=dot(u,u),b=dot(u,v),c=dot(v,v),d=dot(u,w),e=dot(v,w),eps=1e-30
  let s=0,t=0
  if(a<=eps&&c<=eps){/* points */}
  else if(a<=eps)t=clamp(e/c)
  else if(c<=eps)s=clamp(-d/a)
  else{
    const denom=a*c-b*b
    s=denom>eps*a*c?clamp((b*e-c*d)/denom):0
    t=(b*s+e)/c
    if(t<0){t=0;s=clamp(-d/a)}else if(t>1){t=1;s=clamp((b-d)/a)}
  }
  const x=add(p0,scale(u,s)),y=add(q0,scale(v,t))
  return {s,t,point:x,other:y,distance:length(sub(x,y))}
}

/** Independent point-triangle region algorithm (Ericson). */
export function closestPointTriangle(p:V,a:V,b:V,c:V){
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap)
  let bary:[number,number,number]
  if(d1<=0&&d2<=0)bary=[1,0,0]
  else{const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp)
    if(d3>=0&&d4<=d3)bary=[0,1,0]
    else{const vc=d1*d4-d3*d2
      if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);bary=[1-v,v,0]}
      else{const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp)
        if(d6>=0&&d5<=d6)bary=[0,0,1]
        else{const vb=d5*d2-d1*d6
          if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);bary=[1-w,0,w]}
          else{const va=d3*d6-d5*d4
            if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));bary=[0,1-w,w]}
            else{const denominator=va+vb+vc;if(Math.abs(denominator)<1e-40)throw Error('Degenerate contact triangle');const v=vb/denominator,w=vc/denominator;bary=[1-v-w,v,w]}
          }
        }
      }
    }
  }
  const point=add(add(scale(a,bary[0]),scale(b,bary[1])),scale(c,bary[2]))
  return {point,bary,distance:length(sub(p,point))}
}

/** The complete non-crossing segment–triangle distance is the minimum of
 * these five closed features: each endpoint against the face, and the entire
 * segment against each of the three edges. The extra crossing test in
 * segmentTriangleClosest is essential: an interior piercing has zero distance
 * even when all five features are separated. Feature distances may coincide
 * (e.g. at a triangle vertex); they are redundant constraints, not additional
 * physical surfaces. */
export type SegmentTriangleFeatureKind='start-face'|'end-face'|'edge-ab'|'edge-bc'|'edge-ca'
export interface SegmentTriangleFeature {
  kind:SegmentTriangleFeatureKind;distance:number;segmentT:number;bary:[number,number,number];point:V;surface:V
}
export function segmentTriangleFeatures(p0:V,p1:V,a:V,b:V,c:V):SegmentTriangleFeature[]{
  const features:SegmentTriangleFeature[]=[]
  for(const [p,t,kind] of [[p0,0,'start-face'],[p1,1,'end-face']] as [V,number,SegmentTriangleFeatureKind][]){
    const hit=closestPointTriangle(p,a,b,c)
    features.push({kind,distance:hit.distance,segmentT:t,bary:hit.bary,point:p,surface:hit.point})
  }
  for(const [u,v,edge,kind] of [[a,b,0,'edge-ab'],[b,c,1,'edge-bc'],[c,a,2,'edge-ca']] as [V,V,number,SegmentTriangleFeatureKind][]){
    const hit=closestSegments(p0,p1,u,v)
    const bary:[number,number,number]=edge===0?[1-hit.t,hit.t,0]:edge===1?[0,1-hit.t,hit.t]:[hit.t,0,1-hit.t]
    features.push({kind,distance:hit.distance,segmentT:hit.s,bary,point:hit.point,surface:hit.other})
  }
  return features
}

export function segmentTriangleClosest(p0:V,p1:V,a:V,b:V,c:V):SegmentTriangleClosest{
  if(![...p0,...p1,...a,...b,...c].every(Number.isFinite))throw Error('Non-finite collision geometry')
  const dir=sub(p1,p0),ab=sub(b,a),ac=sub(c,a),face=cross(ab,ac),area=length(face)
  if(area<1e-16)throw Error('Degenerate contact triangle')
  const faceNormal=scale(face,1/area),rayCross=cross(dir,ac),det=dot(ab,rayCross),scaleDet=length(dir)*area
  if(Math.abs(det)>1e-12*scaleDet){
    const inv=1/det,s=sub(p0,a),u=dot(s,rayCross)*inv,q=cross(s,ab),v=dot(dir,q)*inv,t=dot(ac,q)*inv
    if(u>=-1e-12&&v>=-1e-12&&u+v<=1+1e-12&&t>=-1e-12&&t<=1+1e-12){
      const tt=clamp(t),point=add(p0,scale(dir,tt));return {distance:0,segmentT:tt,bary:[1-u-v,u,v],point,surface:point,normal:faceNormal,intersects:true}
    }
  }
  let best:SegmentTriangleClosest|null=null
  const record=(t:number,bary:[number,number,number],point:V,surface:V)=>{
    const delta=sub(point,surface),distance=length(delta)
    if(!best||distance<best.distance){const normal=distance>1e-14?scale(delta,1/distance):faceNormal;best={distance,segmentT:t,bary,point,surface,normal,intersects:distance<=1e-14}}
  }
  for(const hit of segmentTriangleFeatures(p0,p1,a,b,c))record(hit.segmentT,hit.bary,hit.point,hit.surface)
  return best!
}

/** Euclidean AABB lower bound; works for arbitrary rotations and positions. */
export function boxDistance(a:readonly V[],b:readonly V[]){
  let sum=0
  for(let k=0;k<3;k++){let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const p of a){amin=Math.min(amin,p[k]);amax=Math.max(amax,p[k])}for(const p of b){bmin=Math.min(bmin,p[k]);bmax=Math.max(bmax,p[k])}const d=Math.max(0,amin-bmax,bmin-amax);sum+=d*d}
  return Math.sqrt(sum)
}
