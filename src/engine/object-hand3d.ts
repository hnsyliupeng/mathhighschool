/** Five independent tendon-driven fingers against one FIXED rounded object.
 * Shape changes affect the contact/CCD geometry, not only the visualization.
 * No friction, gravity, palm contact, object dynamics or force closure. */
import {defaultContinuousGripper3DParams} from './continuous-gripper3d'
import {ObjectFinger3D,type ObjectFingerFrame} from './object-finger3d'
import {FINGERS,HAND_MAX_NORMALIZED_PULL,worldPoint,worldVector,localPoint,interFingerMotion,initialFingerVolumeOverlap,type FingerId,type FingerSpec} from './bionic-hand3d'
import {validateRoundedObject,type FixedRoundedObject,type RoundedPrimitive} from './rounded-object-contact'
import type {GraspObject} from './object-presets3d'
import type {Vec3,Mesh3D} from './gripper3d'

export interface ObjectHandFingerFrame {id:FingerId;name:string;scale:number;local:ObjectFingerFrame;positions:Vec3[];tendon:Vec3[];tip:Vec3;objectForce:Vec3}
export interface ObjectHandFrame {fingers:ObjectHandFingerFrame[];converged:boolean;message?:string;interFingerChecks:number;groupSubsteps:number;objectReaction:Vec3;objectContactFingers:number;maxTendonPenetration:number;maxObjectPenetration:number;minPathJ:number}

/** Similarity transform preserves distances and rotations; the physical force
 * and reference contact area both scale by s². */
export function toFingerObject(spec:FingerSpec,object:FixedRoundedObject):FixedRoundedObject{
  const primitives:RoundedPrimitive[]=object.primitives.map(p=>p.kind==='segment'
    ?{kind:'segment',a:localPoint(spec,p.a),b:localPoint(spec,p.b),radius:p.radius/spec.scale}
    :{kind:'rectangle',corners:p.corners.map(x=>localPoint(spec,x)) as [Vec3,Vec3,Vec3,Vec3],radius:p.radius/spec.scale})
  return {primitives,stiffnessPerArea:object.stiffnessPerArea}
}

export class ObjectHand3D {
  readonly fingers:ObjectFinger3D[];readonly mesh:Mesh3D;readonly object:GraspObject
  last:ObjectHandFrame
  constructor(object:GraspObject){
    validateRoundedObject(object);this.object=structuredClone(object)
    this.fingers=FINGERS.map(spec=>new ObjectFinger3D({...defaultContinuousGripper3DParams,pull:HAND_MAX_NORMALIZED_PULL},toFingerObject(spec,this.object)))
    this.mesh=this.fingers[0].mesh
    const initial=this.buildFrame(0),positions=initial.fingers.map(f=>f.positions)
    const volume=initialFingerVolumeOverlap(this.mesh,positions),surface=interFingerMotion(this.mesh,positions,positions)
    if(volume.overlap||!surface.safe)throw Error(`初始五指干涉：${surface.reason}；体积检查 ${volume.overlap?'重叠':'无重叠'}`)
    this.last={...initial,interFingerChecks:surface.checks}
  }
  private buildFrame(interFingerChecks:number):ObjectHandFrame{
    const fingers=this.fingers.map((f,i)=>{
      const spec=FINGERS[i],local=f.last
      return {id:spec.id,name:spec.name,scale:spec.scale,local,positions:local.positions.map(p=>worldPoint(spec,p)),tendon:local.tendon.map(p=>worldPoint(spec,p)),tip:worldPoint(spec,local.tip),objectForce:worldVector(spec,local.objectForce,spec.scale**2)}
    })
    const objectReaction:Vec3=[0,0,0]
    for(const f of fingers)for(let d=0;d<3;d++)objectReaction[d]-=f.objectForce[d]
    return {fingers,converged:true,interFingerChecks,groupSubsteps:1,objectReaction,objectContactFingers:fingers.filter(f=>f.local.objectContacts.length>0).length,maxTendonPenetration:Math.max(...fingers.map(f=>f.local.checkPenetration*f.scale)),maxObjectPenetration:Math.max(...fingers.map(f=>f.local.objectPenetration*f.scale)),minPathJ:Math.min(...fingers.map(f=>f.local.minPathJ))}
  }
  /** One synchronized increment, in physical meters. Every actuator may have
   * its own target; all accepted positions and both multiplier sets roll back
   * if any finger or the inter-finger check fails. */
  private singleGroupStep(targets:readonly number[]):ObjectHandFrame{
    if(targets.length!==5||targets.some((v,i)=>!Number.isFinite(v)||v<0||v>HAND_MAX_NORMALIZED_PULL*FINGERS[i].scale+1e-12))return {...this.last,converged:false,message:'五根腱的目标必须在各自允许范围内。'}
    const snapshots=this.fingers.map(f=>({q:f.q.slice(),lambda:f.lambda.slice(),objectLambda:f.objectLambda.slice(),pull:f.pull,last:f.last})),before=this.last
    const rollback=(message:string)=>{
      this.fingers.forEach((f,i)=>{const old=snapshots[i];f.q=old.q;f.lambda=old.lambda;f.objectLambda=old.objectLambda;f.pull=old.pull;f.last=old.last})
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
  step(targets:readonly number[]):ObjectHandFrame{
    if(targets.length!==5||targets.some((v,i)=>!Number.isFinite(v)||v<0||v>HAND_MAX_NORMALIZED_PULL*FINGERS[i].scale+1e-12))return {...this.last,converged:false,message:'五根腱的目标必须在各自允许范围内。'}
    if(targets.some((v,i)=>Math.abs(v/FINGERS[i].scale-this.fingers[i].pull)>this.fingers[i].params.step+1e-12))return {...this.last,converged:false,message:'至少一根腱的驱动增量过大；五指全部回滚。'}
    const before=this.last,snapshots=this.fingers.map(f=>({q:f.q.slice(),lambda:f.lambda.slice(),objectLambda:f.objectLambda.slice(),pull:f.pull,last:f.last})),accepted:ObjectHandFrame[]=[]
    const advance=(to:readonly number[],depth:number):ObjectHandFrame=>{
      const from=this.fingers.map((f,i)=>f.pull*FINGERS[i].scale),result=this.singleGroupStep(to)
      if(result.converged){accepted.push(result);return result}
      if(depth>=5||Math.max(...to.map((v,i)=>Math.abs(v-from[i])/FINGERS[i].scale))<2e-6)return result
      const middle=to.map((v,i)=>(v+from[i])/2),first=advance(middle,depth+1)
      return first.converged?advance(to,depth+1):first
    }
    const result=advance(targets,0)
    if(!result.converged){
      this.fingers.forEach((f,i)=>{const old=snapshots[i];f.q=old.q;f.lambda=old.lambda;f.objectLambda=old.objectLambda;f.pull=old.pull;f.last=old.last})
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
