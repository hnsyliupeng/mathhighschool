import {summarizeTendonDynamic,TENDON_MAX_PENETRATION,type TendonDynamicFrame,type TendonDynamicParams,type TendonDynamicSummary} from './tendon-dynamic-grasp'

/**
 * The low-level summary assumes it receives every requested step. Reject sparse
 * playback, missing steps, nonfinite data, disabled CCD and released-fixture
 * gaps before using its finite-time indicator in the UI or Worker.
 *
 * This is an integrity check, NOT a convergence or physical grasp certificate.
 */
export function summarizeCompleteTendonDynamic(history:TendonDynamicFrame[],params:TendonDynamicParams):TendonDynamicSummary{
  const summary=summarizeTendonDynamic(history)
  const invalid=(reason:string):TendonDynamicSummary=>({...summary,retained:false,verifiedCCD:false,reason})
  if(!Number.isFinite(params.dt)||params.dt<=0||!Number.isFinite(params.duration)||params.duration<=0||!params.verifyCCD)return invalid('时间参数无效或连续碰撞检查未启用')
  const expectedSteps=Math.ceil(params.duration/params.dt-1e-10),tol=Math.max(1e-10,params.dt*1e-7)
  if(history.length!==expectedSteps+1||Math.abs(history[0].time)>tol||Math.abs(history.at(-1)!.time-params.duration)>tol)return invalid('缺少完整的逐请求步历史；抽样回放不能单独判断保持')
  for(let i=0;i<history.length;i++){
    const f=history[i],expected=Math.min(i*params.dt,params.duration)
    if(!f.finite||!Number.isFinite(f.time)||Math.abs(f.time-expected)>tol||![f.rise,f.wristRise,f.maxPenetration,f.maxContactResidual,f.maxStructuralStrain,f.minFaceAreaRatio].every(Number.isFinite))return invalid('逐步历史不完整或存在非有限数据')
    if(i>0&&(!f.verifiedCCD||!Number.isInteger(f.substeps)||f.substeps<1))return invalid('存在未执行连续碰撞检查的请求步')
    if(f.maxPenetration>TENDON_MAX_PENETRATION||f.maxContactResidual>TENDON_MAX_PENETRATION||f.maxStructuralStrain>1||f.minFaceAreaRatio<1e-5)return invalid('逐步历史超出数值保护阈值')
    if(f.time>=params.duration-.2-tol&&f.fixtureActive)return invalid('末段夹具仍然启用')
  }
  return summary
}
