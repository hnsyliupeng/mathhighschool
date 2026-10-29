import {MAX_DISCRETE_PENETRATION,type DynamicFrame,type GraspParams} from './material-grasp3d'

/** These are deliberately narrow *numerical demonstration* criteria, not a
 * certificate of real-world grasping or of the uncoupled tendon-driven hand. */
export const NUMERICAL_HOLD={window:0.2,minRise:0.030,minClearance:0.001,minOpposingNormalForce:1e-5} as const
export interface MaterialRunSummary {
  completed:boolean;retained:boolean;reason:string;steps:number
  finalRise:number;minimumHoldRise:number;minimumHoldClearance:number;minimumHoldFingers:number
  maxPenetration:number;maxLinkStrain:number;maxStructuralStrain:number;minFaceAreaRatio:number;maxFingerForce:number
  clipsReleased:boolean
}
export function summarizeMaterialRun(frames:DynamicFrame[],params:GraspParams,error=''):MaterialRunSummary{
  if(!frames.length)throw Error('Cannot summarize an empty trajectory')
  const last=frames.at(-1)!,hold=frames.filter(f=>f.time>=params.duration-NUMERICAL_HOLD.window-1e-10)
  const completed=!error&&last.finite&&last.time>=params.duration-1e-9
  const max=(f:(x:DynamicFrame)=>number)=>Math.max(...frames.map(f)),min=(f:(x:DynamicFrame)=>number)=>Math.min(...frames.map(f))
  const minimumHoldRise=hold.length?Math.min(...hold.map(f=>f.centreRise)):0,minimumHoldClearance=hold.length?Math.min(...hold.map(f=>f.minGroundGap)):0,minimumHoldFingers=hold.length?Math.min(...hold.map(f=>f.contactFingers)):0
  const opposing=hold.length>=5&&hold.every(f=>f.normalForces[0]>NUMERICAL_HOLD.minOpposingNormalForce&&f.normalForces.slice(1).some(v=>v>NUMERICAL_HOLD.minOpposingNormalForce))
  const clipsReleased=!last.clipsActive
  const retained=completed&&hold.length>=5&&minimumHoldRise>=NUMERICAL_HOLD.minRise&&minimumHoldClearance>=NUMERICAL_HOLD.minClearance&&opposing&&clipsReleased&&max(f=>f.maxPenetration)<=MAX_DISCRETE_PENETRATION
  const reason=error||(!completed?'未完成全部时程':!clipsReleased?'布片夹具未释放':hold.length<5?'保持窗口采样不足':minimumHoldRise<NUMERICAL_HOLD.minRise?'保持阶段抬升不足 30 mm':minimumHoldClearance<NUMERICAL_HOLD.minClearance?'保持阶段物体未完全离桌 1 mm':!opposing?'保持阶段缺少相对侧接触':max(f=>f.maxPenetration)>MAX_DISCRETE_PENETRATION?'离散接触穿透超限':'满足此降阶模型的短时数值保持条件')
  return {completed,retained,reason,steps:Math.max(0,frames.length-1),finalRise:last.centreRise,minimumHoldRise,minimumHoldClearance,minimumHoldFingers,maxPenetration:max(f=>f.maxPenetration),maxLinkStrain:max(f=>f.maxLinkStrain),maxStructuralStrain:max(f=>f.maxStructuralStrain),minFaceAreaRatio:min(f=>f.minFaceAreaRatio),maxFingerForce:max(f=>f.maxNormalForce),clipsReleased}
}
