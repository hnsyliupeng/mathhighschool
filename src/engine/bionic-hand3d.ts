/** Five independently actuated scaled copies of the research solid finger.
 * All five interact with one immobile rigid sphere; the sphere is supported by
 * an external fixture. Inter-finger contact is NOT solved: intersecting or
 * indeterminate accepted-frame paths fail closed and roll back the whole hand.
 */
import {defaultContinuousGripper3DParams} from './continuous-gripper3d'
import {SphereFinger3D,type SphereFingerFrame} from './sphere-finger3d'
import {movingTriangles} from './continuous-collision'
import {positiveTetOverlap} from './gripper3d-safety'
import type {Vec3,Mesh3D} from './gripper3d'
import type {FixedSphere} from './hand-object-contact'

export type FingerId='thumb'|'index'|'middle'|'ring'|'little'
export interface FingerSpec {id:FingerId;name:string;scale:number;base:Vec3;ex:Vec3;ey:Vec3;ez:Vec3}
const unitX:Vec3=[0,1,0],unitY:Vec3=[0,0,1],unitZ:Vec3=[1,0,0]
const tx=0,ty=Math.sqrt(1-tx*tx),bend=.5
const thumbX:Vec3=[tx,ty,0],thumbY:Vec3=[bend*ty,-bend*tx,Math.sqrt(1-bend*bend)]
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
export const FINGERS:readonly FingerSpec[]=[
  {id:'thumb',name:'拇指',scale:.78,base:[-.052,-.005,.010],ex:thumbX,ey:thumbY,ez:cross(thumbX,thumbY)},
  {id:'index',name:'食指',scale:.90,base:[-.027,-.003,0],ex:unitX,ey:unitY,ez:unitZ},
  {id:'middle',name:'中指',scale:1,base:[-.009,0,0],ex:unitX,ey:unitY,ez:unitZ},
  {id:'ring',name:'无名指',scale:.92,base:[.009,-.002,0],ex:unitX,ey:unitY,ez:unitZ},
  {id:'little',name:'小指',scale:.78,base:[.027,-.007,0],ex:unitX,ey:unitY,ez:unitZ},
]
/** 90 mm supported sphere; a hypothetical size, not a validated object. */
export const HAND_SPHERE:FixedSphere={center:[0,.045,.063],radius:.045,stiffnessPerArea:2e8}
export const HAND_MAX_NORMALIZED_PULL=.01475
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
export function worldPoint(spec:FingerSpec,p:Vec3):Vec3{
  const u=[p[0],p[1],p[2]-.004]
  return [0,1,2].map(i=>spec.base[i]+spec.scale*(spec.ex[i]*u[0]+spec.ey[i]*u[1]+spec.ez[i]*u[2])) as Vec3
}
export function worldVector(spec:FingerSpec,v:Vec3,factor=1):Vec3{
  return [0,1,2].map(i=>factor*(spec.ex[i]*v[0]+spec.ey[i]*v[1]+spec.ez[i]*v[2])) as Vec3
}
export function localPoint(spec:FingerSpec,p:Vec3):Vec3{
  const d=p.map((v,i)=>(v-spec.base[i])/spec.scale) as Vec3
  return [dot(d,spec.ex),dot(d,spec.ey),dot(d,spec.ez)+.004]
}
export interface HandFingerFrame {id:FingerId;name:string;scale:number;local:SphereFingerFrame;positions:Vec3[];tendon:Vec3[];tip:Vec3;sphereForce:Vec3}
export interface HandFrame {fingers:HandFingerFrame[];converged:boolean;message?:string;interFingerChecks:number;groupSubsteps:number;sphereReaction:Vec3;sphereContactFingers:number;maxTendonPenetration:number;maxSpherePenetration:number;minPathJ:number}

type Box=[number,number,number,number,number,number]
type Tri=[Vec3,Vec3,Vec3]
const box=(points:Vec3[]):Box=>[0,1,2].map(d=>Math.min(...points.map(p=>p[d]))).concat([0,1,2].map(d=>Math.max(...points.map(p=>p[d])))) as Box
const near=(a:Box,b:Box)=>a[0]<=b[3]+1e-12&&b[0]<=a[3]+1e-12&&a[1]<=b[4]+1e-12&&b[1]<=a[4]+1e-12&&a[2]<=b[5]+1e-12&&b[2]<=a[5]+1e-12

/** Conservative CCD on the straight interpolation between two ACCEPTED
 * hand frames, not a certificate for all possible physical loading paths.
 * Swept AABBs skip pairs that provably cannot meet. */
export function interFingerMotion(mesh:Mesh3D,from:Vec3[][],to:Vec3[][]){
  if(from.length!==to.length||from.some((points,i)=>points.length!==mesh.reference.length||to[i].length!==points.length||!points.every(p=>p.length===3&&p.every(Number.isFinite))||!to[i].every(p=>p.length===3&&p.every(Number.isFinite))))return {safe:false,checks:0,reason:'invalid inter-finger geometry'}
  let checks=0
  try{
    const faces=from.map((p,i)=>mesh.surface.map((face,faceIndex)=>{
      const a=face.nodes.map(n=>p[n]) as Tri,b=face.nodes.map(n=>to[i][n]) as Tri
      return {a,b,faceIndex,box:box([...a,...b])}
    }))
    for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
      const right=faces[j].slice().sort((a,b)=>a.box[0]-b.box[0])
      for(const a of faces[i])for(const b of right){
        if(b.box[0]>a.box[3]+1e-12)break
        if(!near(a.box,b.box))continue
        checks++;const r=movingTriangles(a.a,a.b,b.a,b.b)
        if(!r.safe)return {safe:false,checks,reason:`${FINGERS[i]?.name||i}—${FINGERS[j]?.name||j} 表面 CCD ${r.reason}（面 ${a.faceIndex}/${b.faceIndex}，t=${r.time.toFixed(4)}，距离 ${(r.distance*1e6).toFixed(3)} μm）`}
      }
    }
    return {safe:true,checks,reason:'separated'}
  }catch(error){return {safe:false,checks,reason:`指间碰撞检测不确定：${error instanceof Error?error.message:String(error)}`}}
}
/** Initial containment is not excluded by surface intersection alone. */
export function initialFingerVolumeOverlap(mesh:Mesh3D,positions:Vec3[][]){
  let checks=0
  try{
    const groups=positions.map(p=>mesh.tets.map(t=>{const vertices=t.nodes.map(i=>p[i]) as [Vec3,Vec3,Vec3,Vec3];return {vertices,box:box(vertices)}}))
    for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const right=groups[j].slice().sort((a,b)=>a.box[0]-b.box[0])
      for(const a of groups[i])for(const b of right){
        if(b.box[0]>a.box[3])break
        if(!near(a.box,b.box))continue
        checks++;if(positiveTetOverlap(a.vertices,b.vertices))return {overlap:true,checks}
      }
    }
    return {overlap:false,checks}
  }catch{return {overlap:true,checks}}
}

export class BionicHand3D {
  readonly fingers:SphereFinger3D[];readonly mesh:Mesh3D
  last:HandFrame
  constructor(){
    this.fingers=FINGERS.map(spec=>new SphereFinger3D({...defaultContinuousGripper3DParams,pull:HAND_MAX_NORMALIZED_PULL},
      {center:localPoint(spec,HAND_SPHERE.center),radius:HAND_SPHERE.radius/spec.scale,stiffnessPerArea:HAND_SPHERE.stiffnessPerArea}))
    this.mesh=this.fingers[0].mesh
    const initial=this.buildFrame(0),positions=initial.fingers.map(f=>f.positions)
    const volume=initialFingerVolumeOverlap(this.mesh,positions),surface=interFingerMotion(this.mesh,positions,positions)
    if(volume.overlap||!surface.safe)throw Error(`初始五指干涉：${surface.reason}；体积检查 ${volume.overlap?'重叠':'无重叠'}`)
    this.last={...initial,interFingerChecks:surface.checks}
  }
  private buildFrame(interFingerChecks:number):HandFrame{
    const fingers=this.fingers.map((f,i)=>{
      const spec=FINGERS[i],local=f.last
      return {id:spec.id,name:spec.name,scale:spec.scale,local,positions:local.positions.map(p=>worldPoint(spec,p)),tendon:local.tendon.map(p=>worldPoint(spec,p)),tip:worldPoint(spec,local.tip),sphereForce:worldVector(spec,local.sphereForce,spec.scale**2)}
    })
    const sphereReaction:Vec3=[0,0,0]
    for(const f of fingers)for(let d=0;d<3;d++)sphereReaction[d]-=f.sphereForce[d]
    return {fingers,converged:true,interFingerChecks,groupSubsteps:1,sphereReaction,sphereContactFingers:fingers.filter(f=>f.local.sphereContacts.length>0).length,maxTendonPenetration:Math.max(...fingers.map(f=>f.local.checkPenetration*f.scale)),maxSpherePenetration:Math.max(...fingers.map(f=>f.local.spherePenetration*f.scale)),minPathJ:Math.min(...fingers.map(f=>f.local.minPathJ))}
  }
  /** One synchronized increment, in physical meters. Every actuator may have
   * its own target; all accepted positions and both multiplier sets roll back
   * if any finger or the inter-finger check fails. */
  private singleGroupStep(targets:readonly number[]):HandFrame{
    if(targets.length!==5||targets.some((v,i)=>!Number.isFinite(v)||v<0||v>HAND_MAX_NORMALIZED_PULL*FINGERS[i].scale+1e-12))return {...this.last,converged:false,message:'五根腱的目标必须在各自允许范围内。'}
    const snapshots=this.fingers.map(f=>({q:f.q.slice(),lambda:f.lambda.slice(),sphereLambda:f.sphereLambda.slice(),pull:f.pull,last:f.last})),before=this.last
    const rollback=(message:string)=>{
      this.fingers.forEach((f,i)=>{const old=snapshots[i];f.q=old.q;f.lambda=old.lambda;f.sphereLambda=old.sphereLambda;f.pull=old.pull;f.last=old.last})
      return {...before,converged:false,message}
    }
    try{
      for(let i=0;i<this.fingers.length;i++){
        const f=this.fingers[i],localTarget=targets[i]/FINGERS[i].scale
        if(Math.abs(localTarget-f.pull)>f.params.step+1e-12)return rollback(`${FINGERS[i].name}驱动增量过大。`)
        const result=f.step(localTarget)
        if(!result.converged)return rollback(`${FINGERS[i].name}：${result.message||'未收敛'}；五指全部回滚。`)
      }
      const next=this.buildFrame(0),safety=interFingerMotion(this.mesh,before.fingers.map(f=>f.positions),next.fingers.map(f=>f.positions))
      if(!safety.safe)return rollback(`${safety.reason}；五指全部回滚。`)
      this.last={...next,interFingerChecks:safety.checks};return this.last
    }catch(error){return rollback(`五指求解异常，全部回滚：${error instanceof Error?error.message:String(error)}`)}
  }
  /** Adaptive synchronized substeps remain atomic as a group. In particular,
   * an indeterminate inter-finger CCD is never accepted: it may only trigger
   * smaller steps, and the entire requested increment rolls back if those
   * smaller steps cannot certify separation. */
  step(targets:readonly number[]):HandFrame{
    if(targets.length!==5||targets.some((v,i)=>!Number.isFinite(v)||v<0||v>HAND_MAX_NORMALIZED_PULL*FINGERS[i].scale+1e-12))return {...this.last,converged:false,message:'五根腱的目标必须在各自允许范围内。'}
    if(targets.some((v,i)=>Math.abs(v/FINGERS[i].scale-this.fingers[i].pull)>this.fingers[i].params.step+1e-12))return {...this.last,converged:false,message:'至少一根腱的驱动增量过大；五指全部回滚。'}
    const before=this.last,snapshots=this.fingers.map(f=>({q:f.q.slice(),lambda:f.lambda.slice(),sphereLambda:f.sphereLambda.slice(),pull:f.pull,last:f.last})),accepted:HandFrame[]=[]
    const advance=(to:readonly number[],depth:number):HandFrame=>{
      const from=this.fingers.map((f,i)=>f.pull*FINGERS[i].scale),result=this.singleGroupStep(to)
      if(result.converged){accepted.push(result);return result}
      if(depth>=5||Math.max(...to.map((v,i)=>Math.abs(v-from[i])/FINGERS[i].scale))<2e-6)return result
      const middle=to.map((v,i)=>(v+from[i])/2),first=advance(middle,depth+1)
      return first.converged?advance(to,depth+1):first
    }
    const result=advance(targets,0)
    if(!result.converged){
      this.fingers.forEach((f,i)=>{const old=snapshots[i];f.q=old.q;f.lambda=old.lambda;f.sphereLambda=old.sphereLambda;f.pull=old.pull;f.last=old.last})
      this.last=before
      return {...before,converged:false,message:`${result.message||'五指未收敛'}（同步自适应子步失败，已完整回滚）`}
    }
    const fingers=result.fingers.map((finger,i)=>({
      ...finger,local:{...finger.local,
        minPathJ:Math.min(...accepted.map(frame=>frame.fingers[i].local.minPathJ)),
        substeps:accepted.reduce((sum,frame)=>sum+frame.fingers[i].local.substeps,0),
        iterations:accepted.reduce((sum,frame)=>sum+frame.fingers[i].local.iterations,0),
        linearIterations:accepted.reduce((sum,frame)=>sum+frame.fingers[i].local.linearIterations,0),
        collisionChecks:accepted.reduce((sum,frame)=>sum+frame.fingers[i].local.collisionChecks,0),
      },
    }))
    this.last={...result,fingers,interFingerChecks:accepted.reduce((sum,f)=>sum+f.interFingerChecks,0),groupSubsteps:accepted.length,minPathJ:Math.min(...accepted.map(f=>f.minPathJ))}
    return this.last
  }
}
