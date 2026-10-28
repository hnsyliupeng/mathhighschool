import {AxisymmetricShell} from './axisymmetric-shell'

/** A source-equation replay started from an external seed, not an independent trajectory. */
export interface ShellConditionalWindow {
  steps:number;offsetSteps:number;dt:number
  checkpoint:{step:number;q:number[];v:number[];source:string}
  frames:{step:number;positions:number[]}[];reactions:number[]
  metadata:{warnings:string[]}
}
export interface ShellConditionalCheck {
  pass:boolean;start:number;end:number;strictError:number;preSwitchError:number;postSwitchError:number;reactionError:number
  strictConverged:boolean;switchStep:number;replayError:number;replayAccepted:boolean;replayLimits:number;replayUnconverged:number;maxReplayResidual:number
  sourceLimits:number;sourceUnconverged:number;maxSourcePreResidual:number;detail:string
  steps:{step:number;strictError:number;replayError:number;strictResidual:number;replayResidual:number;replayLimit:boolean;referenceZ:number;strictZ:number}[]
}

/** Compare every mother-line coordinate per step. The common initial state is
 * from TS, so this diagnoses the local solver/branch disagreement only. */
export function compareShellConditionalWindow(data:ShellConditionalWindow):ShellConditionalCheck {
  const seed=data.checkpoint
  if(!seed||data.offsetSteps!==seed.step||seed.q.length!==80||seed.v.length!==80||data.frames.length!==data.steps||data.reactions.length!==data.steps||data.frames.some((f,i)=>f.step!==i+1||f.positions.length!==80))throw Error('Invalid conditional shell window')
  const params={nodes:40,stiffness:1000,load:1,damping:.1}
  const strict=new AxisymmetricShell('eversion',params),replay=new AxisymmetricShell('eversion',params,true)
  for(const sim of [strict,replay]){sim.q=[...seed.q];sim.v=[...seed.v];sim.time=data.offsetSteps*data.dt;sim.reaction=0;sim.branchSwitches=0}
  let strictError=0,preSwitchError=0,postSwitchError=0,reactionError=0,strictConverged=true,switchStep=0
  let replayError=0,replayAccepted=true,replayLimits=0,replayUnconverged=0,maxReplayResidual=0
  const steps:ShellConditionalCheck['steps']=[]
  for(const frame of data.frames){
    const a=strict.step(data.dt),b=replay.step(data.dt),step=data.offsetSteps+frame.step
    strictConverged&&=a.converged;replayAccepted&&=!!b.accepted
    if(b.reachedLimit)replayLimits++
    if(!b.converged)replayUnconverged++
    if(!switchStep&&strict.branchSwitches)switchStep=step
    maxReplayResidual=Math.max(maxReplayResidual,b.residual)
    let error=0,compat=0
    for(let i=0;i<frame.positions.length;i++){
      error=Math.max(error,Math.abs(strict.q[i]-frame.positions[i]))
      compat=Math.max(compat,Math.abs(replay.q[i]-frame.positions[i]))
    }
    strictError=Math.max(strictError,error);replayError=Math.max(replayError,compat)
    if(switchStep)postSwitchError=Math.max(postSwitchError,error);else preSwitchError=Math.max(preSwitchError,error)
    reactionError=Math.max(reactionError,Math.abs(strict.reaction-data.reactions[frame.step-1]))
    steps.push({step,strictError:error,replayError:compat,strictResidual:a.residual,replayResidual:b.residual,replayLimit:!!b.reachedLimit,referenceZ:frame.positions[39],strictZ:strict.q[39]})
  }
  const sourceNorms=data.metadata.warnings.map(w=>Number(w.match(/norm=([\d.+eE-]+)/)?.[1]))
  if(sourceNorms.some(x=>!Number.isFinite(x)))throw Error('Conditional source residual instrumentation is incomplete')
  const sourceLimits=sourceNorms.length,sourceUnconverged=sourceNorms.filter(x=>x>1e-4).length,maxSourcePreResidual=Math.max(0,...sourceNorms)
  const start=data.offsetSteps*data.dt,end=(data.offsetSteps+data.steps)*data.dt,pass=strictConverged&&strictError<1e-6&&reactionError<.05
  const detail=`从 TypeScript 产生的 ${start.toFixed(2)} s 状态启动原脚本的 ${start.toFixed(2)}–${end.toFixed(2)} s 条件窗口（不是独立全程）。工作台逐步全节点最大差 ${strictError.toExponential(2)} m、反力最大差 ${reactionError.toExponential(2)} N，${pass?'条件窗口阈值通过':'条件窗口未通过'}；原脚本 ${sourceLimits} 次触及迭代上限，其中 ${sourceUnconverged} 次更新前残差高于 1e-4 N。源次序回放最大差 ${replayError.toExponential(2)} m，本设备回放 ${replayLimits} 次触及上限、${replayUnconverged} 步未收敛；临界区回放对运行环境和数值差异敏感，不能验证翻转动力学。`
  return {pass,start,end,strictError,preSwitchError,postSwitchError,reactionError,strictConverged,switchStep,replayError,replayAccepted,replayLimits,replayUnconverged,maxReplayResidual,sourceLimits,sourceUnconverged,maxSourcePreResidual,detail,steps}
}
