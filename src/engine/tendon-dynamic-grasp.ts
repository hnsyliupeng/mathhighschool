/**
 * Two-way reduced-coordinate tendon-hand / deformable-object experiment.
 * The finger surface and tendon centreline are interpolated between equilibria
 * from ContinuousGripper3D (136 Q1 hexes, finite-radius tendon/bore contact).
 * Contact forces do virtual work on one generalized pull coordinate per finger;
 * the opposing force is distributed to the actual deformable object triangles.
 * This is NOT a fully coupled full-DOF Q1 solve; the nonlinear finger response
 * is restricted to the free-finger manifold. See docs/TENDON_DYNAMIC_GRASP.md.
 */
import type {Vec3,Mesh3D} from './gripper3d'
import {FINGERS,worldPoint,interFingerMotion,initialFingerVolumeOverlap,type FingerSpec} from './bionic-hand3d'
import {makeMaterialObject,defaultMaterialGraspParams,projectCoulombTangent,type MaterialObjectId,type ObjectMesh,type Spring} from './material-grasp3d'
import {closestPointTriangle,closestSegments} from './segment-triangle'
import {movingTriangles} from './continuous-collision'

type Tri=[Vec3,Vec3,Vec3]
export interface ManifoldContact {point:Vec3;wallPoint:Vec3;force:Vec3;gap:number;penetration:number;triangle:[number,number,number];segment:number;feature:string}
export interface ManifoldFrame {pull:number;positions:Vec3[];tendon:Vec3[];tip:Vec3;tipAngleDeg:number;tipDeflection:number;tension:number;energy:number;residual:number;minJ:number;minPathJ:number;maxPenetration:number;contactCount:number;contacts:ManifoldContact[];interpolationSafe:boolean;interpolationMinPathJ:number}
export interface FingerManifold {sourceFiles:string[];sourceHash:string;scope:string;params:{radius:number;[key:string]:number};mesh:Mesh3D;frames:ManifoldFrame[];error:string}
export interface TendonDynamicParams {id:MaterialObjectId;scale:number;stiffnessScale:number;offsetX:number;driveStiffness:number;friction:number;pull:number;dt:number;iterations:number;duration:number;lift:number;verifyCCD:boolean}
export interface FingerGeometry {positions:Vec3[];tendon:Vec3[];tip:Vec3;pull:number;target:number;angle:number;referenceTension:number}
export interface TendonObjectContact {finger:number;fingerFace:number;objectFace:number;point:Vec3;normal:Vec3;fingerBary:Vec3;objectBary:Vec3;normalForce:number;tangentialForce:number;modalForce:number;penetration:number}
export interface TendonDynamicFrame {time:number;phase:'closing'|'holding'|'lifting'|'finished';objectPositions:Vec3[];fingers:FingerGeometry[];contacts:TendonObjectContact[];centre:Vec3;rise:number;wristRise:number;normalForces:number[];contactFingers:number;thumbContact:boolean;maxPenetration:number;maxContactResidual:number;maxStructuralStrain:number;minFaceAreaRatio:number;fixtureActive:boolean;ccdChecks:number;interFingerChecks:number;verifiedCCD:boolean;substeps:number;finite:boolean;message?:string;attempted?:{time:number;maxPenetration?:number;maxContactResidual?:number;maxStructuralStrain?:number;reason:string}}
export interface TendonDynamicSummary {retained:boolean;reason:string;minFinalRise:number;minFinalContacts:number;thumbStayed:boolean;maxPenetration:number;maxStrain:number;lastRelativeRise:number;tailRelativeDrift:number;verifiedCCD:boolean}

const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const mul=(a:Vec3,k:number):Vec3=>[a[0]*k,a[1]*k,a[2]*k]
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const norm=(a:Vec3)=>Math.hypot(...a)
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
const faceArea=(a:Vec3,b:Vec3,c:Vec3)=>{const u=sub(b,a),v=sub(c,a);return .5*Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])}
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t)}
const baryPoint=(points:Tri,b:Vec3):Vec3=>[0,1,2].map(d=>points[0][d]*b[0]+points[1][d]*b[1]+points[2][d]*b[2]) as Vec3
const vec=(q:Float64Array,i:number):Vec3=>[q[3*i],q[3*i+1],q[3*i+2]]
const finiteVec=(v:readonly number[])=>v.every(Number.isFinite)

export function defaultTendonDynamicParams(id:MaterialObjectId='egg'):TendonDynamicParams{
  return {id,scale:1,stiffnessScale:1,offsetX:id==='cloth'?0:-.013,driveStiffness:150,friction:1.5,pull:.013,dt:1/240,iterations:40,duration:2.15,lift:.05,verifyCCD:true}
}
export const TENDON_SKIN=.0005
export const TENDON_MAX_PENETRATION=.00025

/** Exact triangle/triangle unsigned distance. The complete nonintersecting
 * feature set is six vertex/face and nine edge/edge distances. Explicit
 * segment/face piercing tests also catch intersecting triangles. */
export function trianglePairClosest(finger:Tri,object:Tri){
  const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  if(!finger.every(finiteVec)||!object.every(finiteVec)||norm(cross(sub(finger[1],finger[0]),sub(finger[2],finger[0])))<1e-16||norm(cross(sub(object[1],object[0]),sub(object[2],object[0])))<1e-16)throw Error('接触三角面退化')
  type Hit={distance:number;fingerPoint:Vec3;objectPoint:Vec3;fingerBary:Vec3;objectBary:Vec3}
  let best:Hit|null=null
  const record=(h:Hit)=>{if(!best||h.distance<best.distance)best=h}
  for(let i=0;i<3;i++){
    const f=closestPointTriangle(finger[i],...object),fb:Vec3=[0,0,0];fb[i]=1;record({distance:f.distance,fingerPoint:finger[i],objectPoint:f.point,fingerBary:fb,objectBary:f.bary})
    const o=closestPointTriangle(object[i],...finger),ob:Vec3=[0,0,0];ob[i]=1;record({distance:o.distance,fingerPoint:o.point,objectPoint:object[i],fingerBary:o.bary,objectBary:ob})
  }
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const k=(i+1)%3,l=(j+1)%3,h=closestSegments(finger[i],finger[k],object[j],object[l]),fb:Vec3=[0,0,0],ob:Vec3=[0,0,0];fb[i]=1-h.s;fb[k]=h.s;ob[j]=1-h.t;ob[l]=h.t
    record({distance:h.distance,fingerPoint:h.point,objectPoint:h.other,fingerBary:fb,objectBary:ob})
  }
  // Möller–Trumbore with the same scaled determinant tolerance as the
  // segment/triangle routine. Coplanar intersections are captured above.
  const piercing=(seg:Tri,tri:Tri,i:number)=>{
    const j=(i+1)%3,dir=sub(seg[j],seg[i]),ab=sub(tri[1],tri[0]),ac=sub(tri[2],tri[0]),area=norm(cross(ab,ac)),h=cross(dir,ac),det=dot(ab,h)
    if(Math.abs(det)<=1e-12*norm(dir)*area)return null
    const inv=1/det,s=sub(seg[i],tri[0]),u=dot(s,h)*inv,q=cross(s,ab),v=dot(dir,q)*inv,t=dot(ac,q)*inv
    if(u< -1e-12||v< -1e-12||u+v>1+1e-12||t< -1e-12||t>1+1e-12)return null
    const tt=clamp(t,0,1),point=add(seg[i],mul(dir,tt)),edgeBary:Vec3=[0,0,0];edgeBary[i]=1-tt;edgeBary[j]=tt
    return {point,edgeBary,triBary:[1-u-v,u,v] as Vec3}
  }
  for(let i=0;i<3;i++){
    const a=piercing(finger,object,i);if(a)return {distance:0,fingerPoint:a.point,objectPoint:a.point,fingerBary:a.edgeBary,objectBary:a.triBary}
    const b=piercing(object,finger,i);if(b)return {distance:0,fingerPoint:b.point,objectPoint:b.point,fingerBary:b.triBary,objectBary:b.edgeBary}
  }
  if(!best||!Number.isFinite((best as Hit).distance))throw Error('接触三角面退化')
  return best as Hit
}

interface WorldFrame {positions:Vec3[];tendon:Vec3[];tip:Vec3}
export class CompiledTendonManifold {
  readonly data:FingerManifold;readonly frames:WorldFrame[][];readonly maxPull:number
  constructor(data:FingerManifold){
    if(!data||data.error||!data.mesh||!Array.isArray(data.mesh.reference)||!Array.isArray(data.mesh.surface)||!Array.isArray(data.frames)||data.frames.length<2||!Number.isFinite(data.params?.radius)||data.params.radius<=0||data.mesh.surface.some(face=>face.nodes.length!==3||face.nodes.some(n=>!Number.isInteger(n)||n<0||n>=data.mesh.reference.length))||data.frames.some((f,i)=>!f.interpolationSafe||!Number.isFinite(f.interpolationMinPathJ)||f.interpolationMinPathJ<=0||!Number.isFinite(f.pull)||(i>0&&f.pull<=data.frames[i-1].pull)||f.positions.length!==data.mesh.reference.length||f.tendon.length!==data.frames[0].tendon.length||f.tendon.length<2||!f.positions.every(finiteVec)||!f.tendon.every(finiteVec)||!finiteVec(f.tip)||![f.tension,f.energy,f.residual,f.tipAngleDeg,f.maxPenetration].every(Number.isFinite)||f.maxPenetration>Math.min(2e-8,data.params.radius*.00005)+1e-12||f.residual>=2e-5+1e-12))throw Error('腱驱参考轨迹无效或未通过相邻帧插值检查')
    this.data=data;this.maxPull=data.frames.at(-1)!.pull
    this.frames=FINGERS.map(spec=>data.frames.map(f=>({positions:f.positions.map(p=>worldPoint(spec,p)),tendon:f.tendon.map(p=>worldPoint(spec,p)),tip:worldPoint(spec,f.tip)})))
  }
  bracket(p:number){
    if(!Number.isFinite(p)||p< -1e-10||p>this.maxPull+1e-10)throw Error('腱位移超出已验证的参考轨迹')
    const frames=this.data.frames,pp=clamp(p,0,this.maxPull);let lo=0,hi=frames.length-1
    while(hi-lo>1){const mid=(hi+lo)>>1;if(frames[mid].pull<=pp)lo=mid;else hi=mid}
    const d=frames[lo+1].pull-frames[lo].pull
    return {index:lo,t:(pp-frames[lo].pull)/d,dp:d}
  }
  vertex(f:number,p:number,node:number,wrist:number):{position:Vec3;derivative:Vec3}{
    const b=this.bracket(p),a=this.frames[f][b.index].positions[node],c=this.frames[f][b.index+1].positions[node]
    return {position:[a[0]+b.t*(c[0]-a[0]),a[1]+b.t*(c[1]-a[1]),a[2]+b.t*(c[2]-a[2])+wrist],derivative:[(c[0]-a[0])/b.dp,(c[1]-a[1])/b.dp,(c[2]-a[2])/b.dp]}
  }
  geometry(f:number,p:number,target:number,wrist:number):FingerGeometry{
    const b=this.bracket(p),a=this.frames[f][b.index],c=this.frames[f][b.index+1],localA=this.data.frames[b.index],localB=this.data.frames[b.index+1]
    const interpolate=(x:Vec3,y:Vec3):Vec3=>[x[0]+b.t*(y[0]-x[0]),x[1]+b.t*(y[1]-x[1]),x[2]+b.t*(y[2]-x[2])+wrist]
    return {positions:a.positions.map((x,i)=>interpolate(x,c.positions[i])),tendon:a.tendon.map((x,i)=>interpolate(x,c.tendon[i])),tip:interpolate(a.tip,c.tip),pull:p,target,angle:localA.tipAngleDeg+b.t*(localB.tipAngleDeg-localA.tipAngleDeg),referenceTension:FINGERS[f].scale**2*(localA.tension+b.t*(localB.tension-localA.tension))}
  }
  referenceTension(p:number){const b=this.bracket(p),a=this.data.frames[b.index],c=this.data.frames[b.index+1];return a.tension+b.t*(c.tension-a.tension)}
}

interface PairMultiplier {lambda:number;tangent:Vec3;finger:number;fingerFace:number;objectFace:number}
type Box=[number,number,number,number,number,number]
function box(points:readonly Vec3[],padding=0):Box{return [0,1,2].map(d=>Math.min(...points.map(p=>p[d]))-padding).concat([0,1,2].map(d=>Math.max(...points.map(p=>p[d]))+padding)) as Box}
function overlap(a:Box,b:Box){return a[0]<=b[3]&&a[1]<=b[4]&&a[2]<=b[5]&&a[3]>=b[0]&&a[4]>=b[1]&&a[5]>=b[2]}
const CELL=.012
function visitCells(b:Box,visit:(key:string)=>void){
  for(let x=Math.floor(b[0]/CELL);x<=Math.floor(b[3]/CELL);x++)for(let y=Math.floor(b[1]/CELL);y<=Math.floor(b[4]/CELL);y++)for(let z=Math.floor(b[2]/CELL);z<=Math.floor(b[5]/CELL);z++)visit(`${x},${y},${z}`)
}
/** All returned pairs pass a conservative bounding-box test. */
function broadPairs(fingers:Vec3[][],faces:Mesh3D['surface'],object:Vec3[],objectFaces:[number,number,number][],padding:number,secondFingers?:Vec3[][],secondObject?:Vec3[]){
  const grid=new Map<string,number[]>(),fingerBoxes:Box[]=[],objectBox=box(secondObject?[...object,...secondObject]:object)
  fingers.forEach((p,f)=>faces.forEach((face,j)=>{
    const pts=face.nodes.map(i=>p[i]);if(secondFingers)pts.push(...face.nodes.map(i=>secondFingers[f][i]))
    const b=box(pts,padding),index=f*faces.length+j;if(!overlap(b,objectBox))return;fingerBoxes[index]=b
    visitCells(b,key=>{const a=grid.get(key);if(a)a.push(index);else grid.set(key,[index])})
  }))
  const out:[number,number,number][]=[],marks=new Int32Array(fingers.length*faces.length);let stamp=0
  objectFaces.forEach((nodes,j)=>{
    const points=nodes.map(i=>object[i]);if(secondObject)points.push(...nodes.map(i=>secondObject[i]))
    const b=box(points);stamp++
    visitCells(b,key=>{for(const index of grid.get(key)||[]){if(marks[index]===stamp)continue;marks[index]=stamp;if(overlap(fingerBoxes[index],b))out.push([Math.floor(index/faces.length),index%faces.length,j])}})
  })
  return out
}

/** Geometry loading is a material object mesh, not a pad or visual proxy. */
function shiftedObject(params:TendonDynamicParams):{mesh:ObjectMesh;fixtureNodes:number[]}{
  const mp={...defaultMaterialGraspParams(params.id),scale:params.scale,stiffnessScale:params.stiffnessScale},mesh=makeMaterialObject(mp)
  const bottom=Math.min(...mesh.positions.map(p=>p[2])),shift:Vec3=[params.offsetX,.045,.019-bottom]
  mesh.positions=mesh.positions.map(p=>add(p,shift))
  if(params.id==='cloth')return {mesh,fixtureNodes:[...mesh.clipNodes]}
  const sorted=mesh.surfaceNodes.slice().sort((a,b)=>mesh.positions[a][2]-mesh.positions[b][2]),fixtureNodes:number[]=[]
  // A temporary fixture pins at most four spatially separated bottom surface
  // nodes during closure. It is removed completely before the lift.
  for(const i of sorted){if(mesh.positions[i][2]>.019+.004)break;if(fixtureNodes.every(j=>norm(sub(mesh.positions[i],mesh.positions[j]))>.004*params.scale))fixtureNodes.push(i);if(fixtureNodes.length===4)break}
  if(!fixtureNodes.length)fixtureNodes.push(sorted[0]);return {mesh,fixtureNodes}
}

export class TendonDynamicGrasp {
  readonly params:TendonDynamicParams;readonly manifold:CompiledTendonManifold;readonly mesh:ObjectMesh;readonly fixtureNodes:number[];readonly q:Float64Array;readonly v:Float64Array;readonly p:Float64Array;readonly pv:Float64Array;readonly inverseObjectMass:number;readonly inverseFingerMass:Float64Array;readonly restFaceAreas:number[];readonly initialCentre:Vec3
  readonly releaseTime=.95;readonly liftStart=1.08;readonly closeTime=.78
  time=0;last:TendonDynamicFrame
  constructor(data:FingerManifold,params:TendonDynamicParams=defaultTendonDynamicParams(),compiled?:CompiledTendonManifold){
    if(![params.scale,params.stiffnessScale,params.offsetX,params.driveStiffness,params.friction,params.pull,params.dt,params.iterations,params.duration,params.lift].every(Number.isFinite)||params.scale<.7||params.scale>1.3||params.stiffnessScale<.25||params.stiffnessScale>4||Math.abs(params.offsetX)>.035||params.driveStiffness<5||params.driveStiffness>3000||params.friction<0||params.friction>2||params.dt<1/1000||params.dt>1/60||!Number.isInteger(params.iterations)||params.iterations<2||params.iterations>100||params.duration<1.5||params.duration>4||params.lift<0||params.lift>.1)throw Error('无效的腱驱抓取参数')
    this.manifold=compiled||new CompiledTendonManifold(data)
    if(params.pull<0||params.pull>this.manifold.maxPull+.003)throw Error('目标腱位移超过参考轨迹和可控预紧范围')
    this.params={...params};const built=shiftedObject(params);this.mesh=built.mesh;this.fixtureNodes=built.fixtureNodes
    this.q=new Float64Array(3*this.mesh.positions.length);this.v=new Float64Array(this.q.length);this.mesh.positions.forEach((p,i)=>this.q.set(p,3*i));this.p=new Float64Array(5);this.pv=new Float64Array(5)
    this.inverseObjectMass=this.mesh.positions.length/this.mesh.mass
    // A single generalized pull coordinate per finger. The assumed generalized
    // inertia is positive and scales as s^5 under geometric similarity. It is
    // not an experimentally fitted dynamic mass matrix.
    this.inverseFingerMass=Float64Array.from(FINGERS.map(s=>1/(.04*s.scale**5)))
    this.restFaceAreas=this.mesh.triangles.map(t=>faceArea(this.mesh.positions[t[0]],this.mesh.positions[t[1]],this.mesh.positions[t[2]]));this.initialCentre=this.centre()
    const initialFingers=this.fingersAt(this.p,0),volume=initialFingerVolumeOverlap(data.mesh,initialFingers.map(f=>f.positions)),inter=interFingerMotion(data.mesh,initialFingers.map(f=>f.positions),initialFingers.map(f=>f.positions))
    if(volume.overlap||!inter.safe)throw Error(`初始手指干涉：${inter.reason}`)
    const candidates=broadPairs(initialFingers.map(f=>f.positions),data.mesh.surface,this.mesh.positions,this.mesh.triangles,TENDON_SKIN)
    for(const [f,fi,oi] of candidates){const ft=data.mesh.surface[fi].nodes.map(i=>initialFingers[f].positions[i]) as Tri,ot=this.mesh.triangles[oi].map(i=>this.mesh.positions[i]) as Tri,hit=trianglePairClosest(ft,ot);if(hit.distance<TENDON_SKIN-1e-10)throw Error('初始物体和腱驱手指距离不足，不能开始')}
    this.last=this.makeFrame([],0,0,inter.checks,false)
  }
  wrist(time:number){return this.params.lift*smooth((time-this.liftStart)/.6)}
  target(time:number){return this.params.pull*smooth(time/this.closeTime)}
  private centre():Vec3{const c:Vec3=[0,0,0];for(let i=0;i<this.mesh.positions.length;i++)for(let d=0;d<3;d++)c[d]+=this.q[3*i+d]/this.mesh.positions.length;return c}
  private fingersAt(p:ArrayLike<number>,time:number){return FINGERS.map((_,i)=>this.manifold.geometry(i,p[i],this.target(time),this.wrist(time)))}
  private objectPositions(){return this.mesh.positions.map((_,i)=>vec(this.q,i))}
  private makeFrame(contacts:TendonObjectContact[],penetration:number,ccdChecks:number,interFingerChecks:number,verifiedCCD:boolean):TendonDynamicFrame{
    const positions=this.objectPositions(),fingers=this.fingersAt(this.p,this.time),centre=this.centre();let maxStructuralStrain=0
    for(const e of this.mesh.springs)if(e.kind!=='bend')maxStructuralStrain=Math.max(maxStructuralStrain,Math.abs(norm(sub(positions[e.a],positions[e.b]))/e.rest-1))
    const ratios=this.mesh.triangles.map((t,i)=>faceArea(positions[t[0]],positions[t[1]],positions[t[2]])/this.restFaceAreas[i]),normalForces=FINGERS.map((_,i)=>contacts.filter(c=>c.finger===i).reduce((x,c)=>x+c.normalForce,0))
    return {time:this.time,phase:this.time>=this.params.duration-1e-10?'finished':this.time<this.closeTime?'closing':this.time<this.liftStart?'holding':'lifting',objectPositions:positions,fingers,contacts,centre,rise:centre[2]-this.initialCentre[2],wristRise:this.wrist(this.time),normalForces,contactFingers:normalForces.filter(x=>x>1e-7).length,thumbContact:normalForces[0]>1e-7,maxPenetration:penetration,maxContactResidual:0,maxStructuralStrain,minFaceAreaRatio:Math.min(...ratios),fixtureActive:this.time<=this.releaseTime+1e-12,ccdChecks,interFingerChecks,verifiedCCD,substeps:0,finite:true}
  }
  private face(f:number,face:number,p:ArrayLike<number>,time:number){const nodes=this.manifold.data.mesh.surface[face].nodes,wrist=this.wrist(time),vertices=nodes.map(i=>this.manifold.vertex(f,p[f],i,wrist));return {points:vertices.map(v=>v.position) as Tri,derivatives:vertices.map(v=>v.derivative) as Tri}}
  private oldObjectFace(nodes:[number,number,number],old:Float64Array):Tri{return nodes.map(i=>vec(old,i)) as Tri}
  private objectFace(nodes:[number,number,number]):Tri{return nodes.map(i=>vec(this.q,i)) as Tri}
  private apply(f:number,nodes:[number,number,number],bary:Vec3,jac:Vec3,change:Vec3,weight:Float64Array){
    const dp=this.inverseFingerMass[f]*dot(jac,change);this.p[f]=clamp(this.p[f]+dp,0,this.manifold.maxPull)
    for(let k=0;k<3;k++)for(let d=0;d<3;d++)this.q[3*nodes[k]+d]-=weight[nodes[k]]*bary[k]*change[d]
  }
  private contactPair(f:number,fi:number,oi:number,oldQ:Float64Array,oldP:Float64Array,oldTime:number,now:number,weight:Float64Array,state:PairMultiplier,dt:number,alpha:number){
    const nodes=this.mesh.triangles[oi],face=this.face(f,fi,this.p,now),ot=this.objectFace(nodes),hit=trianglePairClosest(face.points,ot)
    if(hit.distance>TENDON_SKIN&&state.lambda===0&&norm(state.tangent)===0)return
    // An iterative predictor may temporarily cross a triangle. Use the last
    // accepted pair's separation direction to project it back; final surface
    // intersections and failed swept CCD are still rejected, never accepted.
    let n:Vec3,gap=hit.distance-TENDON_SKIN
    if(hit.distance<1e-12){const previous=this.face(f,fi,oldP,oldTime),oldHit=trianglePairClosest(previous.points,this.oldObjectFace(nodes,oldQ));if(oldHit.distance<1e-12)throw Error('上一接受状态的接触方向退化');n=mul(sub(oldHit.fingerPoint,oldHit.objectPoint),1/oldHit.distance);gap=dot(sub(hit.fingerPoint,hit.objectPoint),n)-TENDON_SKIN}else n=mul(sub(hit.fingerPoint,hit.objectPoint),1/hit.distance)
    const jac=baryPoint(face.derivatives,hit.fingerBary),jn=dot(jac,n)
    let objectWeight=0;for(let k=0;k<3;k++)objectWeight+=weight[nodes[k]]*hit.objectBary[k]**2
    const denominator=objectWeight+this.inverseFingerMass[f]*jn*jn+alpha
    if(!(denominator>0))throw Error('接触逆质量退化')
    const old=state.lambda,next=Math.max(0,old+(-gap-alpha*old)/denominator),delta=next-old;state.lambda=next
    this.apply(f,nodes,hit.objectBary,jac,mul(n,delta),weight)
    if(next<=0){if(norm(state.tangent)>0)this.apply(f,nodes,hit.objectBary,jac,mul(state.tangent,-1),weight);state.tangent=[0,0,0];return}
    // Compute relative displacement at the same current barycentric material
    // points. The Coulomb disk is enforced in multiplier space each iteration.
    const current=this.face(f,fi,this.p,now),previous=this.face(f,fi,oldP,oldTime),nowF=baryPoint(current.points,hit.fingerBary),oldF=baryPoint(previous.points,hit.fingerBary),nowO=baryPoint(this.objectFace(nodes),hit.objectBary),oldO=baryPoint(this.oldObjectFace(nodes,oldQ),hit.objectBary),relative=sub(sub(nowF,oldF),sub(nowO,oldO))
    const tangentialDenominator=objectWeight+this.inverseFingerMass[f]*dot(jac,jac)
    if(tangentialDenominator>1e-18){const nextT=projectCoulombTangent(relative,n,state.tangent,tangentialDenominator,next,this.params.friction),change=sub(nextT,state.tangent);state.tangent=nextT;this.apply(f,nodes,hit.objectBary,jac,change,weight)}
  }
  /** The physical step is linearly interpolated in object coordinates and
   * pull. Split wherever the finger manifold changes segment; CCD then sees
   * exactly linear triangle trajectories on each segment. */
  private certifyMotion(oldQ:Float64Array,oldP:Float64Array,oldTime:number,now:number){
    const cuts=[0,1];for(let f=0;f<5;f++)if(Math.abs(this.p[f]-oldP[f])>1e-14)for(const fr of this.manifold.data.frames){const t=(fr.pull-oldP[f])/(this.p[f]-oldP[f]);if(t>1e-10&&t<1-1e-10)cuts.push(t)}
    cuts.sort((a,b)=>a-b);const unique=cuts.filter((x,i)=>!i||x-cuts[i-1]>1e-10);let checks=0,interChecks=0
    const at=(t:number)=>{const p=oldP.map((x,i)=>x+t*(this.p[i]-x)),wrist=this.wrist(oldTime)+t*(this.wrist(now)-this.wrist(oldTime)),finger=FINGERS.map((_,i)=>this.manifold.geometry(i,p[i],0,wrist).positions),object=this.mesh.positions.map((_,i)=>[0,1,2].map(d=>oldQ[3*i+d]+t*(this.q[3*i+d]-oldQ[3*i+d])) as Vec3);return {finger,object}}
    for(let i=1;i<unique.length;i++){
      const a=at(unique[i-1]),b=at(unique[i]),inter=interFingerMotion(this.manifold.data.mesh,a.finger,b.finger);interChecks+=inter.checks
      if(!inter.safe)throw Error(`指间连续碰撞未认证：${inter.reason}`)
      const candidates=broadPairs(a.finger,this.manifold.data.mesh.surface,a.object,this.mesh.triangles,TENDON_SKIN-TENDON_MAX_PENETRATION,b.finger,b.object)
      for(const [f,fi,oi] of candidates){
        const fn=this.manifold.data.mesh.surface[fi].nodes,on=this.mesh.triangles[oi],aa=fn.map(n=>a.finger[f][n]) as Tri,ab=fn.map(n=>b.finger[f][n]) as Tri,ba=on.map(n=>a.object[n]) as Tri,bb=on.map(n=>b.object[n]) as Tri
        checks++;const r=movingTriangles(aa,ab,ba,bb,TENDON_SKIN-TENDON_MAX_PENETRATION)
        if(!r.safe)throw Error(`手指—物体连续碰撞未认证：${r.reason}（指 ${f+1}，面 ${fi}/${oi}）`)
      }
    }
    return {checks,interChecks}
  }
  private singleStep(dt:number):TendonDynamicFrame{
    const oldQ=this.q.slice(),oldV=this.v.slice(),oldP=this.p.slice(),oldPV=this.pv.slice(),oldTime=this.time,now=this.time+dt,weight=new Float64Array(this.mesh.positions.length).fill(this.inverseObjectMass),fixture=now<=this.releaseTime+1e-12
    if(fixture)for(const i of this.fixtureNodes)weight[i]=0
    let attempted:TendonDynamicFrame['attempted']
    try{
      const damping=Math.exp(-1.6*dt)
      for(let i=0;i<weight.length;i++)if(weight[i]){this.v[3*i]*=damping;this.v[3*i+1]*=damping;this.v[3*i+2]=this.v[3*i+2]*damping-9.81*dt;for(let d=0;d<3;d++)this.q[3*i+d]+=dt*this.v[3*i+d]}else this.v.fill(0,3*i,3*i+3)
      for(let f=0;f<5;f++){
        const freeForce=FINGERS[f].scale**3*this.manifold.referenceTension(this.p[f]);this.pv[f]=this.pv[f]*damping-this.inverseFingerMass[f]*freeForce*dt;this.p[f]=clamp(this.p[f]+dt*this.pv[f],0,this.manifold.maxPull)
      }
      const springLambda=new Float64Array(this.mesh.springs.length),driveLambda=new Float64Array(5),pairs=new Map<string,PairMultiplier>(),target=this.target(now),alphaContact=1/(120000*dt*dt)
      for(let iter=0;iter<this.params.iterations;iter++){
        for(let e=0;e<this.mesh.springs.length;e++){
          const l:Spring=this.mesh.springs[e],ia=3*l.a,ib=3*l.b,dx=this.q[ib]-this.q[ia],dy=this.q[ib+1]-this.q[ia+1],dz=this.q[ib+2]-this.q[ia+2],length=Math.hypot(dx,dy,dz)
          if(!(length>1e-12))throw Error('物体弹簧退化')
          const alpha=1/(l.k*dt*dt),dl=(-(length-l.rest)-alpha*springLambda[e])/(weight[l.a]+weight[l.b]+alpha);springLambda[e]+=dl
          const wa=weight[l.a]*dl/length,wb=weight[l.b]*dl/length;this.q[ia]-=wa*dx;this.q[ia+1]-=wa*dy;this.q[ia+2]-=wa*dz;this.q[ib]+=wb*dx;this.q[ib+1]+=wb*dy;this.q[ib+2]+=wb*dz
        }
        for(let f=0;f<5;f++){
          const alpha=1/(this.params.driveStiffness*FINGERS[f].scale**2*dt*dt),dl=(-(this.p[f]-target)-alpha*driveLambda[f])/(this.inverseFingerMass[f]+alpha);driveLambda[f]+=dl;this.p[f]=clamp(this.p[f]+this.inverseFingerMass[f]*dl,0,this.manifold.maxPull)
        }
        const fingers=this.fingersAt(this.p,now).map(x=>x.positions),objects=this.objectPositions(),candidates=broadPairs(fingers,this.manifold.data.mesh.surface,objects,this.mesh.triangles,TENDON_SKIN+.001)
        const keys=new Set<string>()
        for(const [f,fi,oi] of candidates)keys.add(`${f}:${fi}:${oi}`)
        for(const [key,s] of pairs)if(s.lambda>0||norm(s.tangent)>0)keys.add(key)
        for(const key of keys){let s=pairs.get(key);if(!s){const [finger,fingerFace,objectFace]=key.split(':').map(Number);s={lambda:0,tangent:[0,0,0],finger,fingerFace,objectFace};pairs.set(key,s)}this.contactPair(s.finger,s.fingerFace,s.objectFace,oldQ,oldP,oldTime,now,weight,s,dt,alphaContact)}
      }
      for(let i=0;i<weight.length;i++)if(weight[i])for(let d=0;d<3;d++)this.v[3*i+d]=(this.q[3*i+d]-oldQ[3*i+d])/dt
      for(let f=0;f<5;f++)this.pv[f]=(this.p[f]-oldP[f])/dt
      if(!Array.from(this.q).every(Number.isFinite)||!Array.from(this.v).every(Number.isFinite)||!Array.from(this.p).every(Number.isFinite)||!Array.from(this.pv).every(Number.isFinite)||Array.from(this.v).some(x=>Math.abs(x)>10)||Array.from(this.pv).some(x=>Math.abs(x)>2))throw Error('状态非有限或速度超过保护阈值')
      const contacts:TendonObjectContact[]=[],fingers=this.fingersAt(this.p,now).map(x=>x.positions),objects=this.objectPositions(),candidates=broadPairs(fingers,this.manifold.data.mesh.surface,objects,this.mesh.triangles,TENDON_SKIN)
      const keys=new Set(candidates.map(([f,fi,oi])=>`${f}:${fi}:${oi}`));for(const [key,s] of pairs)if(s.lambda>0)keys.add(key)
      let penetration=0,residual=0
      for(const key of keys){const [f,fi,oi]=key.split(':').map(Number),face=this.face(f,fi,this.p,now),hit=trianglePairClosest(face.points,this.objectFace(this.mesh.triangles[oi]));if(hit.distance<1e-12)throw Error('手指与物体表面相交');const gap=hit.distance-TENDON_SKIN,pen=Math.max(0,-gap);penetration=Math.max(penetration,pen);const s=pairs.get(key),lambda=s?.lambda||0
        residual=Math.max(residual,lambda>0?Math.abs(gap+alphaContact*lambda):pen)
        if(s&&s.lambda>0&&gap<=.00002){const n=mul(sub(hit.fingerPoint,hit.objectPoint),1/hit.distance),jac=baryPoint(face.derivatives,hit.fingerBary),force=s.lambda/(dt*dt);contacts.push({finger:f,fingerFace:fi,objectFace:oi,point:mul(add(hit.fingerPoint,hit.objectPoint),.5),normal:n,fingerBary:hit.fingerBary,objectBary:hit.objectBary,normalForce:force,tangentialForce:norm(s.tangent)/(dt*dt),modalForce:force*dot(jac,n),penetration:pen})}
      }
      this.time=now;const frame=this.makeFrame(contacts,penetration,0,0,false);frame.maxContactResidual=residual;frame.substeps=1
      attempted={time:now,maxPenetration:penetration,maxContactResidual:residual,maxStructuralStrain:frame.maxStructuralStrain,reason:''}
      if(penetration>TENDON_MAX_PENETRATION)throw Error(`指—物体穿透 ${(penetration*1000).toFixed(3)} mm 超过阈值 ${(TENDON_MAX_PENETRATION*1000).toFixed(2)} mm`)
      if(residual>TENDON_MAX_PENETRATION)throw Error(`法向互补残差 ${(residual*1000).toFixed(3)} mm 超过数值阈值`)
      if(!Number.isFinite(frame.maxStructuralStrain)||frame.maxStructuralStrain>1||!Number.isFinite(frame.minFaceAreaRatio)||frame.minFaceAreaRatio<1e-5)throw Error('物体应变超限或三角面退化')
      if(this.params.verifyCCD){const cert=this.certifyMotion(oldQ,oldP,oldTime,now);frame.ccdChecks=cert.checks;frame.interFingerChecks=cert.interChecks;frame.verifiedCCD=true}
      this.last=frame;return frame
    }catch(error){this.q.set(oldQ);this.v.set(oldV);this.p.set(oldP);this.pv.set(oldPV);this.time=oldTime;const reason=error instanceof Error?error.message:String(error);return {...this.last,finite:false,attempted:{...attempted,time:now,reason},message:`动力学步失败，已回滚：${reason}`}}
  }
  /** Atomic requested step with bounded adaptive subdivisions. If any child
   * fails, every object coordinate/velocity and all five pulls are restored. */
  step():TendonDynamicFrame{
    if(this.time>=this.params.duration-1e-12)return this.last
    const saved={q:this.q.slice(),v:this.v.slice(),p:this.p.slice(),pv:this.pv.slice(),time:this.time,last:this.last},target=Math.min(this.params.duration,this.time+this.params.dt),accepted:TendonDynamicFrame[]=[]
    const advance=(to:number,depth:number):TendonDynamicFrame=>{
      const from=this.time,result=this.singleStep(to-from)
      if(result.finite){accepted.push(result);return result}
      if(depth>=4||to-from<1e-5)return result
      const first=advance((from+to)/2,depth+1);return first.finite?advance(to,depth+1):first
    }
    const result=advance(target,0)
    if(!result.finite){this.q.set(saved.q);this.v.set(saved.v);this.p.set(saved.p);this.pv.set(saved.pv);this.time=saved.time;this.last=saved.last;return {...saved.last,finite:false,attempted:result.attempted,message:`${result.message||'未收敛'}（自适应子步失败，整个请求步已回滚）`}}
    this.last={...result,substeps:accepted.length,maxPenetration:Math.max(...accepted.map(f=>f.maxPenetration)),maxContactResidual:Math.max(...accepted.map(f=>f.maxContactResidual)),maxStructuralStrain:Math.max(...accepted.map(f=>f.maxStructuralStrain)),minFaceAreaRatio:Math.min(...accepted.map(f=>f.minFaceAreaRatio)),ccdChecks:accepted.reduce((sum,f)=>sum+f.ccdChecks,0),interFingerChecks:accepted.reduce((sum,f)=>sum+f.interFingerChecks,0),verifiedCCD:this.params.verifyCCD&&accepted.every(f=>f.verifiedCCD)};return this.last
  }
}

export function summarizeTendonDynamic(history:TendonDynamicFrame[]):TendonDynamicSummary{
  if(!history.length)return {retained:false,reason:'无已接受帧',minFinalRise:0,minFinalContacts:0,thumbStayed:false,maxPenetration:0,maxStrain:0,lastRelativeRise:0,tailRelativeDrift:0,verifiedCCD:false}
  const end=history.at(-1)!,tail=history.filter(f=>f.time>=end.time-.2),minFinalRise=Math.min(...tail.map(f=>f.rise)),minFinalContacts=Math.min(...tail.map(f=>f.contactFingers)),thumbStayed=tail.every(f=>f.thumbContact),maxPenetration=Math.max(...history.map(f=>f.maxPenetration)),maxStrain=Math.max(...history.map(f=>f.maxStructuralStrain)),lastRelativeRise=end.rise-end.wristRise,relative=tail.map(f=>f.rise-f.wristRise),tailRelativeDrift=Math.max(...relative)-Math.min(...relative),verifiedCCD=history.length>1&&history.slice(1).every(f=>f.verifiedCCD)
  const retained=end.finite&&end.phase==='finished'&&!end.fixtureActive&&minFinalRise>=.025&&minFinalContacts>=2&&thumbStayed&&tailRelativeDrift<=.01&&verifiedCCD&&maxPenetration<=TENDON_MAX_PENETRATION
  const reason=retained?'释放夹具后的末 0.2 s 内，物体上升至少 25 mm、拇指与另一手指持续接触且相对腕部漂移不超过 10 mm':'未满足持续抬升、双指接触、相对腕部漂移及逐步连续碰撞检查的全部条件'
  return {retained,reason,minFinalRise,minFinalContacts,thumbStayed,maxPenetration,maxStrain,lastRelativeRise,tailRelativeDrift,verifiedCCD}
}
