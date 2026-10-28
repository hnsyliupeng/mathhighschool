/** Complete-boundary static and conservative linearly swept collision audit. */
import type {Mesh3D,Vec3,Tet3D} from './gripper3d'
import type {Hex3D} from './hexahedron'
import {segmentTriangleClosest} from './segment-triangle'
import {movingSegmentTriangle,movingTriangles,movingSegments} from './continuous-collision'

type Box=[number,number,number,number,number,number]
type Tri=[Vec3,Vec3,Vec3]
type Seg=[Vec3,Vec3]
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const length=(a:Vec3)=>Math.hypot(a[0],a[1],a[2])
function bound(a:Vec3[],b:Vec3[]):Box {const r:Box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const p of [...a,...b])for(let k=0;k<3;k++){r[k]=Math.min(r[k],p[k]);r[k+3]=Math.max(r[k+3],p[k])}return r}
function boxesNear(a:Box,b:Box,margin:number){let s=0;for(let k=0;k<3;k++){const x=Math.max(0,a[k]-b[k+3],b[k]-a[k+3]);s+=x*x}return s<=margin*margin}
function triangles(mesh:Mesh3D,p:Vec3[]):Tri[]{return mesh.surface.map(f=>f.nodes.map(i=>p[i]) as Tri)}
type Nodes=[number,number,number]
/** Incident triangles are allowed to share their topological vertex/edge, but
 * must not overlap anywhere else. Opposite edges/apices and cross-edges test
 * the remaining features without treating the shared feature as a collision. */
function trianglePairMotion(a:Nodes,b:Nodes,p0:Vec3[],p1:Vec3[]){
  const common=a.filter(id=>b.includes(id)),tri=(ids:Nodes,p:Vec3[])=>ids.map(i=>p[i]) as Tri,seg=(ids:number[],p:Vec3[])=>ids.map(i=>p[i]) as Seg
  const A0=tri(a,p0),A1=tri(a,p1),B0=tri(b,p0),B1=tri(b,p1)
  let checks=0,reason='certified'
  const check=(r:ReturnType<typeof movingTriangles>)=>{checks++;if(!r.safe)reason=r.reason;return r.safe}
  if(common.length===0)return {safe:check(movingTriangles(A0,A1,B0,B1)),checks,reason}
  if(common.length===1){
    const ea=a.filter(id=>id!==common[0]),eb=b.filter(id=>id!==common[0])
    if(!check(movingSegmentTriangle(seg(ea,p0),seg(ea,p1),B0,B1,0)))return {safe:false,checks,reason}
    if(!check(movingSegmentTriangle(seg(eb,p0),seg(eb,p1),A0,A1,0)))return {safe:false,checks,reason}
  }else if(common.length===2){
    const ua=a.find(id=>!common.includes(id))!,ub=b.find(id=>!common.includes(id))!
    if(!check(movingSegmentTriangle(seg([ua,ua],p0),seg([ua,ua],p1),B0,B1,0)))return {safe:false,checks,reason}
    if(!check(movingSegmentTriangle(seg([ub,ub],p0),seg([ub,ub],p1),A0,A1,0)))return {safe:false,checks,reason}
    for(const [x,y] of [[common[0],common[1]],[common[1],common[0]]]){
      if(!check(movingSegments(seg([x,ua],p0),seg([x,ua],p1),seg([y,ub],p0),seg([y,ub],p1))))return {safe:false,checks,reason}
    }
  }else return {safe:false,checks,reason:'duplicate surface triangles'}
  return {safe:true,checks,reason}
}

/** Min J along a linear path. det(F(t)) is cubic; examine both endpoints
 * and every real stationary point in (0,1). */
function minCubicDet(u:Vec3,v:Vec3,w:Vec3,du:Vec3,dv:Vec3,dw:Vec3,den:number):number {
  const c0=dot(u,cross(v,w))/den,c1=(dot(du,cross(v,w))+dot(u,cross(dv,w))+dot(u,cross(v,dw)))/den,c2=(dot(du,cross(dv,w))+dot(du,cross(v,dw))+dot(u,cross(dv,dw)))/den,c3=dot(du,cross(dv,dw))/den
  const value=(t:number)=>((c3*t+c2)*t+c1)*t+c0
  let min=Math.min(value(0),value(1));const a=3*c3,b=2*c2,c=c1,eps=1e-14
  if(Math.abs(a)<eps){if(Math.abs(b)>eps){const r=-c/b;if(r>0&&r<1)min=Math.min(min,value(r))}}
  else{const d=b*b-4*a*c;if(d>=0){const s=Math.sqrt(d);for(const r of [(-b+s)/(2*a),(-b-s)/(2*a)])if(r>0&&r<1)min=Math.min(min,value(r))}}
  return min
}
export function sweptMinTetJ(tet:Tet3D,from:Vec3[],to:Vec3[]):number {
  const p=tet.nodes.map(i=>from[i]),q=tet.nodes.map(i=>to[i]),u=sub(p[1],p[0]),v=sub(p[2],p[0]),w=sub(p[3],p[0])
  return minCubicDet(u,v,w,sub(sub(q[1],q[0]),u),sub(sub(q[2],q[0]),v),sub(sub(q[3],q[0]),w),6*tet.volume)
}
export function sweptMinHexJ(hex:Hex3D,from:Vec3[],to:Vec3[]):number {
  let result=Infinity
  for(const gradients of hex.gradients){
    const a:Tri=[[0,0,0],[0,0,0],[0,0,0]],b:Tri=[[0,0,0],[0,0,0],[0,0,0]]
    for(let n=0;n<8;n++){const p=from[hex.nodes[n]],q=to[hex.nodes[n]],g=gradients[n];for(let j=0;j<3;j++)for(let i=0;i<3;i++){a[j][i]+=p[i]*g[j];b[j][i]+=q[i]*g[j]}}
    result=Math.min(result,minCubicDet(a[0],a[1],a[2],sub(b[0],a[0]),sub(b[1],a[1]),sub(b[2],a[2]),1))
  }
  return result
}
type TetPoints=[Vec3,Vec3,Vec3,Vec3]
/** Separating-axis test for positive-volume intersection of two tetrahedra.
 * Shared faces, edges and vertices are permitted. `epsilon` is a length
 * tolerance, so an overlap below it is not classified as positive volume. */
export function positiveTetOverlap(a:TetPoints,b:TetPoints,epsilon=1e-12):boolean {
  const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],faces=[[0,1,2],[0,1,3],[0,2,3],[1,2,3]],axes:Vec3[]=[]
  for(const p of [a,b])for(const [i,j,k] of faces)axes.push(cross(sub(p[j],p[i]),sub(p[k],p[i])))
  for(const [i,j] of edges)for(const [k,l] of edges)axes.push(cross(sub(a[j],a[i]),sub(b[l],b[k])))
  for(const axis of axes){
    const n=length(axis);if(n<1e-22)continue
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity
    for(const x of a){const d=dot(x,axis)/n;amin=Math.min(amin,d);amax=Math.max(amax,d)}
    for(const x of b){const d=dot(x,axis)/n;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d)}
    if(Math.min(amax,bmax)-Math.max(amin,bmin)<=epsilon)return false
  }
  return true
}
export interface SafetyReport {safe:boolean;reason:string;checks:number;selfIntersections:number;minimumPathJ:number;pair?:[number,number]}
export class Gripper3DSafety {
  constructor(readonly mesh:Mesh3D,readonly hexes:readonly Hex3D[]=[]){}
  /** Counts surface intersections apart from each pair's shared topology. */
  staticSelf(p:Vec3[]):{intersections:number;checks:number}{
    const T=triangles(this.mesh,p),boxes=T.map(t=>bound(t,t));let checks=0,intersections=0
    const order=boxes.map((_,i)=>i).sort((i,j)=>boxes[i][0]-boxes[j][0])
    for(let ii=0;ii<order.length;ii++){const i=order[ii];for(let jj=ii+1;jj<order.length;jj++){const j=order[jj];if(boxes[j][0]>boxes[i][3]+1e-12)break
      if(boxesNear(boxes[i],boxes[j],1e-12)){const result=trianglePairMotion(this.mesh.surface[i].nodes,this.mesh.surface[j].nodes,p,p);checks+=result.checks;if(!result.safe)intersections++}
    }}
    return {intersections,checks}
  }
  /** Independent static test of all tetrahedron pairs, including adjacent
   * tetrahedra. This checks the piecewise-linear geometric decomposition. */
  staticSolidOverlap(p:Vec3[]):{overlaps:number;checks:number}{
    const T=this.mesh.tets.map(t=>t.nodes.map(i=>p[i]) as TetPoints),boxes=T.map(t=>bound(t,t));let checks=0,overlaps=0
    const order=boxes.map((_,i)=>i).sort((i,j)=>boxes[i][0]-boxes[j][0])
    for(let ii=0;ii<order.length;ii++){const i=order[ii];for(let jj=ii+1;jj<order.length;jj++){const j=order[jj];if(boxes[j][0]>boxes[i][3])break
      if(boxesNear(boxes[i],boxes[j],0)){checks++;if(positiveTetOverlap(T[i],T[j]))overlaps++}
    }}
    return {overlaps,checks}
  }
  /** Check the actual line segment between two numerical configurations.
   * Allowed compression is explicitly supplied. All unknown CCD results fail
   * closed. Adjacent surface triangles are excluded from self collision. */
  motion(p0:Vec3[],p1:Vec3[],t0:Vec3[],t1:Vec3[],clearance:number):SafetyReport {
    let minJ=Infinity
    for(const tet of this.mesh.tets){minJ=Math.min(minJ,sweptMinTetJ(tet,p0,p1));if(minJ<=1e-8)return {safe:false,reason:'swept tetrahedron inversion',checks:0,selfIntersections:0,minimumPathJ:minJ}}
    for(const hex of this.hexes){minJ=Math.min(minJ,sweptMinHexJ(hex,p0,p1));if(minJ<=1e-8)return {safe:false,reason:'swept hexahedron Gauss-point inversion',checks:0,selfIntersections:0,minimumPathJ:minJ}}
    const A=triangles(this.mesh,p0),B=triangles(this.mesh,p1),boxes=A.map((a,i)=>bound(a,B[i]));let checks=0
    for(let i=0;i<t0.length-1;i++){
      const a:Seg=[t0[i],t0[i+1]],b:Seg=[t1[i],t1[i+1]],box=bound(a,b)
      for(let j=0;j<A.length;j++)if(boxesNear(box,boxes[j],clearance)){
        checks++;const result=movingSegmentTriangle(a,b,A[j],B[j],clearance)
        if(!result.safe)return {safe:false,reason:`tendon–surface CCD ${result.reason}`,checks,selfIntersections:0,minimumPathJ:minJ,pair:[i,j]}
      }
    }
    // Every candidate pair is tested. For incident triangles, the common
    // topological feature is excluded but overlap elsewhere is still tested.
    const order=boxes.map((_,i)=>i).sort((i,j)=>boxes[i][0]-boxes[j][0])
    for(let ii=0;ii<order.length;ii++){const i=order[ii];for(let jj=ii+1;jj<order.length;jj++){const j=order[jj];if(boxes[j][0]>boxes[i][3]+1e-12)break
      if(boxesNear(boxes[i],boxes[j],1e-12)){
        const result=trianglePairMotion(this.mesh.surface[i].nodes,this.mesh.surface[j].nodes,p0,p1);checks+=result.checks
        if(!result.safe)return {safe:false,reason:`surface self-CCD ${result.reason}`,checks,selfIntersections:1,minimumPathJ:minJ,pair:[i,j]}
      }
    }}
    return {safe:true,reason:'certified',checks,selfIntersections:0,minimumPathJ:minJ}
  }
}