import reference from '../data/references/octave-reference.json'
import planarReference from '../data/references/planar-reference.json'
import hyperReference from '../data/references/hyper-reference.json'
import membraneReference from '../data/references/membrane-reference.json'
import softSwimReference from '../data/references/soft-2-reference.json'
import softMagneticReference from '../data/references/soft-1-reference.json'
import axisShellInflationReference from '../data/references/axis-shell-1-reference.json'
import axisShellEversionReference from '../data/references/axis-shell-2-reference.json'
import axisShellConditionalReference from '../data/references/axis-shell-cap-conditional.json'
import netGravityReference from '../data/references/net-gravity-reference.json'
import {compareShellConditionalWindow,type ShellConditionalCheck} from './axis-shell-window'
import { cases } from '../data/cases'
import { Simulation, defaultsFor } from './simulation'
import { chainStep, oscillatorStep } from './linear'
import { PlanarBeam } from './planar'
import { PrescribedBeam, type PrescribedBeamKind } from './planar-cases'
import { SoftRobot, type SoftRobotKind } from './soft-robot'
import { AxisymmetricMembrane } from './axisymmetric-membrane'
import { AxisymmetricShell, type AxisShellKind } from './axisymmetric-shell'
import { GravityNet } from './net-gravity'

export interface ReferenceCheck { id:string; name:string; pass:boolean; maxError:number; threshold:number; detail:string
  compatibility?:{pass:boolean;maxError:number;threshold:number;reachedLimit:number;unconverged:number}
  conditional?:ShellConditionalCheck }
/**
 * Replays reference force times for the linear cases. The UI intentionally uses
 * t=n*dt instead; original main.m uses linspace(0,10,1000) with dt=0.01.
 * The beam comparison covers the first 50 steps, not its full trajectory.
 */
export function compareReferences():ReferenceCheck[] {return [...referenceChecks()]}
/** Iterate separately so callers can yield between expensive full-path checks. */
export function* referenceChecks():Generator<ReferenceCheck> {
  const single=new Map(reference.single.map(s=>[s.step,s])),multi=new Map(reference.multiple.map(s=>[s.step,s]))
  let x=1,v=0,q=[0,0,0],velocity=[0,0,0],singleError=0,multiError=0
  for(let i=1;i<=999;i++){
    const driveTime=i*10/999-.01
    ;[x,v]=oscillatorStep(x,v,driveTime,.01)
    const next=chainStep(q,velocity,driveTime,.01);q=next.q;velocity=next.v
    const a=single.get(i),b=multi.get(i)
    if(a)singleError=Math.max(singleError,Math.abs(x-a.positions[0]))
    if(b)for(let j=0;j<3;j++)multiError=Math.max(multiError,Math.abs(q[j]+j+1-b.positions[j]))
  }
  const beam=new PlanarBeam({nodes:40,length:1,young:1e8,radius:.01,density:1000,gravity:10,damping:.1})
  let beamError=0,beamConverged=true
  for(const sample of reference.beam){beamConverged=beam.step(.01).converged&&beamConverged;beamError=Math.max(beamError,Math.abs(beam.q.at(-1)!-sample.tip_y))}
  yield {id:'mass-single',name:'单自由度弹簧振子',pass:singleError<1e-8,maxError:singleError,threshold:1e-8,detail:`对齐原脚本驱动时刻，101 个采样点的最大位置误差 ${singleError.toExponential(2)} m（阈值 1e-8 m）。`}
  yield {id:'mass-multi',name:'多自由度弹簧系统',pass:multiError<1e-8,maxError:multiError,threshold:1e-8,detail:`对齐原脚本驱动时刻，三个质量点、101 个采样点的最大位置误差 ${multiError.toExponential(2)} m（阈值 1e-8 m）。`}
  yield {id:'beam-gravity',name:'重力下的悬臂梁',pass:beamConverged&&beamError<1e-4,maxError:beamError,threshold:1e-4,detail:`前 0.5 s 的 50 个末端位移样本，最大误差 ${beamError.toExponential(2)} m（阈值 1e-4 m）。`}
  for(const kind of ['buckling','snap'] as const)yield comparePrescribedReference(kind)
  yield compareShellReference('inflation',axisShellInflationReference)
  yield compareShellReference('eversion',axisShellEversionReference)
  yield compareGravityNetReference()
  yield compareHyperReference()
  yield compareAxisymmetricReference()
  yield compareSoftReference('magnetic',softMagneticReference)
  yield compareSoftReference('swimmer',softSwimReference)
}

function comparePrescribedReference(kind:PrescribedBeamKind):ReferenceCheck {
  const data=planarReference[kind],parameters={nodes:40,stiffness:10,load:1,damping:.1}
  // The teaching simulation uses the exact Hessian and a tighter residual.
  // A separate replay reproduces the upstream Jacobian, update order and its
  // acceptance of the last iterate even when it reaches the iteration limit.
  const sim=new PrescribedBeam(kind,parameters),replay=new PrescribedBeam(kind,parameters,true)
  const frames=new Map(data.frames.map(f=>[f.step,f.positions]))
  let probeError=0,shapeError=0,replayError=0,converged=true,replayValid=true,reachedLimit=0,unconverged=0
  for(let i=0;i<data.steps;i++) {
    const step=sim.step(data.dt),original=replay.step(data.dt)
    if(!step.converged){converged=false;break}
    if(!original.accepted){replayValid=false;break}
    if(original.reachedLimit)reachedLimit++
    if(!original.converged)unconverged++
    probeError=Math.max(probeError,Math.abs(sim.beam.q[2*data.probeNode+1]-data.trajectory[i]))
    replayError=Math.max(replayError,Math.abs(replay.beam.q[2*data.probeNode+1]-data.trajectory[i]))
    const ref=frames.get(i+1)
    if(ref)for(let j=0;j<sim.beam.q.length;j++){
      shapeError=Math.max(shapeError,Math.abs(sim.beam.q[j]-ref[j]))
      replayError=Math.max(replayError,Math.abs(replay.beam.q[j]-ref[j]))
    }
  }
  const maxError=Math.max(probeError,shapeError),probeThreshold=kind==='buckling'?1e-6:2e-6,threshold=kind==='buckling'?2e-5:2e-6,duration=data.steps*data.dt
  const warnings=planarReference.metadata.warnings[kind],sourceCount=Array.isArray(warnings)?warnings.length:null
  const compatibility={pass:replayValid&&replayError<1e-8&&(sourceCount===null||reachedLimit===sourceCount),maxError:replayError,threshold:1e-8,reachedLimit,unconverged}
  const strict=converged&&Number.isFinite(maxError)&&probeError<probeThreshold&&shapeError<threshold
  const warningNote=sourceCount===null?'原脚本最大迭代退出未记录。':`原脚本记录 ${sourceCount} 次达到最大迭代次数（残差在最后一次更新前评估）。`
  return {
    id:kind==='buckling'?'beam-buckling':'beam-snap',name:kind==='buckling'?'受压梁的屈曲':'预屈曲梁的跃迁',
    pass:strict&&compatibility.pass,maxError,threshold,compatibility,
    detail:`解析 Hessian 仿真前 ${duration.toFixed(2)} s：${data.steps} 个中点样本最大误差 ${probeError.toExponential(2)} m；${data.frames.length} 帧全部 40 节点坐标最大误差 ${shapeError.toExponential(2)} m（中点阈值 ${probeThreshold.toExponential(0)} m；构型阈值 ${threshold.toExponential(0)} m）。${strict?'严格阈值通过。':'严格阈值未通过。'}原脚本兼容迭代回放最大误差 ${replayError.toExponential(2)} m（阈值 1e-8 m，${compatibility.pass?'兼容回放通过':'兼容回放未通过'}），回放 ${reachedLimit} 次达到迭代上限、其中 ${unconverged} 次上限前残差仍高于原容差。${warningNote}${kind==='snap'?(duration<16?'此区间尚未覆盖跃迁。':'该区间覆盖跃迁；两种迭代器不同不等于对全部参数或分支的验证。'):'采样构型不是全节点逐步验证。'}`
  }
}

interface ShellReference {steps:number;offsetSteps?:number;checkpoint?:unknown;dt:number;probeNode:number;probe:number[][];frames:{step:number;positions:number[]}[];reactions?:number[];metadata:{warnings:string[]}}
/** The reference window is explicitly reported; a short window cannot validate snap-through. */
function compareShellReference(kind:AxisShellKind,data:ShellReference):ReferenceCheck {
  if(data.checkpoint||(data.offsetSteps??0)!==0)throw new Error('A conditional checkpoint window cannot be used as an independent trajectory reference.')
  const inflation=kind==='inflation',parameters={nodes:40,stiffness:inflation?1:1000,load:1,damping:.1}
  const sim=new AxisymmetricShell(kind,parameters),replay=new AxisymmetricShell(kind,parameters,true)
  const frames=new Map(data.frames.map(f=>[f.step,f.positions]))
  let probeError=0,shapeError=0,replayError=0,reactionError=0,converged=true,replayValid=true,reachedLimit=0,unconverged=0,maxPostResidual=0
  for(let i=0;i<data.steps;i++){
    const current=sim.step(data.dt),original=replay.step(data.dt)
    if(!current.converged){converged=false;break}
    if(!original.accepted){replayValid=false;break}
    if(original.reachedLimit)reachedLimit++
    if(!original.converged)unconverged++
    maxPostResidual=Math.max(maxPostResidual,original.residual)
    for(let d=0;d<2;d++){
      const j=2*data.probeNode+d
      probeError=Math.max(probeError,Math.abs(sim.q[j]-data.probe[i][d]));replayError=Math.max(replayError,Math.abs(replay.q[j]-data.probe[i][d]))
    }
    const ref=frames.get(i+1)
    if(ref)for(let j=0;j<sim.q.length;j++){
      shapeError=Math.max(shapeError,Math.abs(sim.q[j]-ref[j]));replayError=Math.max(replayError,Math.abs(replay.q[j]-ref[j]))
    }
    if(data.reactions)reactionError=Math.max(reactionError,Math.abs(sim.reaction-data.reactions[i]))
  }
  const maxError=Math.max(probeError,shapeError),threshold=1e-6,reactionThreshold=.05,duration=data.steps*data.dt,sourceCount=data.metadata.warnings.length
  const compatibility={pass:replayValid&&replayError<1e-8&&reachedLimit===sourceCount,maxError:replayError,threshold:1e-8,reachedLimit,unconverged}
  const pass=converged&&maxError<threshold&&(!data.reactions||reactionError<reactionThreshold)
  const reactionNote=data.reactions?`约束反力最大差异 ${reactionError.toExponential(2)} N（阈值 ${reactionThreshold} N）。原脚本反力取最后一次更新前，工作台在收敛后计算。`:''
  const coverage=inflation?(duration<2?'尚未覆盖全部充气路径。':'覆盖默认充气路径。'):(duration<4.1?'尚未覆盖约 4 s 的翻转；不能以此验证临界力或分支切换。':'已覆盖翻转区域；分支跳转及迭代残差需单独解释。')
  return {id:inflation?'axis-inflate':'axis-snap',name:inflation?'轴对称平板充气':'轴对称球冠翻转',pass,maxError,threshold,compatibility,
    ...(!inflation?{conditional:compareShellConditionalWindow(axisShellConditionalReference)}:{}),
    detail:`前 ${duration.toFixed(2)} s：每步测量点坐标最大差异 ${probeError.toExponential(2)} m；${data.frames.length} 帧全部 40 母线节点最大差异 ${shapeError.toExponential(2)} m（位置阈值 1e-6 m，${pass?'局部通过':'未通过'}）。${reactionNote}原次序回放最大差异 ${replayError.toExponential(2)} m（${compatibility.pass?'通过':'未通过'}），原脚本记录 ${sourceCount} 次达到迭代上限；回放更新后最大残差 ${maxPostResidual.toExponential(2)}。${coverage}`}
}
export const axisShellReferenceWindows={inflation:axisShellInflationReference.steps*axisShellInflationReference.dt,eversion:axisShellEversionReference.steps*axisShellEversionReference.dt}

function compareGravityNetReference():ReferenceCheck {
  const data=netGravityReference,sim=new GravityNet({stiffness:1,load:50,damping:.1}),frames=new Map(data.frames.map(f=>[f.step,f.positions]))
  let probeError=0,shapeError=0,converged=true,maxResidual=0
  for(let i=0;i<data.steps;i++){
    const result=sim.step(data.dt);maxResidual=Math.max(maxResidual,result.residual)
    if(!result.converged){converged=false;break}
    for(let k=0;k<3;k++)probeError=Math.max(probeError,Math.abs(sim.q[3*data.probeNode+k]-data.probe[i][k]))
    const ref=frames.get(i+1)
    if(ref)for(let j=0;j<sim.q.length;j++)shapeError=Math.max(shapeError,Math.abs(sim.q[j]-ref[j]))
  }
  const threshold=1e-6,maxError=Math.max(probeError,shapeError),pass=converged&&maxError<threshold
  return {id:'net-gravity',name:'重力下的柔性网',pass,maxError,threshold,
    detail:`前 ${(data.steps*data.dt).toFixed(2)} s：${data.steps} 个中心节点三维样本最大差 ${probeError.toExponential(2)} m；${data.frames.length} 帧全部 631 节点最大差 ${shapeError.toExponential(2)} m（阈值 1e-6 m，${pass?'局部通过':'未通过'}）。参考使用 Octave 原方程、源迭代顺序及稀疏向量化装配；该装配与原循环前 5 步全节点最大差 3.64e-16 m。源 ${data.metadata.warnings.length} 次触及迭代上限；工作台最大收敛残差 ${maxResidual.toExponential(2)} N。采样构型并非每步全节点对照，其他参数及网格尚未验证。`}
}
export const netGravityReferenceWindow=netGravityReference.steps*netGravityReference.dt

function compareHyperReference():ReferenceCheck {
  const item=cases.find(c=>c.id==='hyper-cable')!,sim=new Simulation(item,defaultsFor(item))
  const frames=new Map(hyperReference.frames.map(f=>[f.step,f.positions]))
  let probeError=0,shapeError=0,converged=true
  for(let i=0;i<hyperReference.steps;i++) {
    sim.step(hyperReference.dt);if(!sim.converged){converged=false;break}
    const q=sim.snapshot().beamQ!,ref=frames.get(i+1)
    probeError=Math.max(probeError,Math.abs(q[2*hyperReference.probeNode+1]-hyperReference.trajectory[i]))
    if(ref)for(let j=0;j<q.length;j++)shapeError=Math.max(shapeError,Math.abs(q[j]-ref[j]))
  }
  const maxError=Math.max(probeError,shapeError),threshold=1e-6,duration=hyperReference.steps*hyperReference.dt
  return {id:'hyper-cable',name:'超弹性平面索',pass:converged&&maxError<threshold,maxError,threshold,
    detail:`前 ${duration.toFixed(3)} s：${hyperReference.steps} 个中点样本最大误差 ${probeError.toExponential(2)} m；${hyperReference.frames.length} 帧全部 40 节点坐标最大误差 ${shapeError.toExponential(2)} m（阈值 1e-6 m）。原脚本记录 ${hyperReference.metadata.warnings.length} 次达到最大迭代次数；采样构型不是逐步全节点验证。`}
}
export const hyperReferenceMetadata=hyperReference.metadata
export const hyperReferenceWindow=hyperReference.steps*hyperReference.dt
export const referenceMetadata=reference.metadata
export const planarReferenceMetadata=planarReference.metadata
export const planarReferenceWindows={buckling:planarReference.buckling.steps*planarReference.buckling.dt,snap:planarReference.snap.steps*planarReference.snap.dt}

interface SampledReference {steps:number;dt:number;probeNode:number;probe:number[][];frames:{step:number;positions:number[]}[];metadata:{warnings:string[]}}
/** Compare both a converged workbench solution and a separately labelled source-order replay. */
function compareSampled(data:SampledReference,kind:'membrane'|SoftRobotKind):ReferenceCheck {
  const parameters=kind==='membrane'?{nodes:60,stiffness:1,load:1,damping:1}:{nodes:40,stiffness:kind==='magnetic'?100:.1,load:1,damping:kind==='magnetic'?.1:0}
  const make=(compatibility:boolean)=>kind==='membrane'?new AxisymmetricMembrane(parameters,compatibility):new SoftRobot(kind,parameters,compatibility)
  const sim=make(false),replay=make(true),frames=new Map(data.frames.map(f=>[f.step,f.positions]))
  const coordinates=(x:AxisymmetricMembrane|SoftRobot)=>x instanceof SoftRobot?x.beam.q:x.q
  let probeError=0,shapeError=0,replayError=0,converged=true,replayValid=true,reachedLimit=0,unconverged=0,maxPostResidual=0
  for(let i=0;i<data.steps;i++){
    const step=sim.step(data.dt),original=replay.step(data.dt)
    if(!step.converged){converged=false;break}
    if(!original.accepted){replayValid=false;break}
    if(original.reachedLimit)reachedLimit++
    if(!original.converged)unconverged++
    maxPostResidual=Math.max(maxPostResidual,original.residual)
    const q=coordinates(sim),qr=coordinates(replay),ref=frames.get(i+1)
    for(let d=0;d<2;d++){
      const id=2*data.probeNode+d
      probeError=Math.max(probeError,Math.abs(q[id]-data.probe[i][d]))
      replayError=Math.max(replayError,Math.abs(qr[id]-data.probe[i][d]))
    }
    if(ref)for(let j=0;j<q.length;j++){
      shapeError=Math.max(shapeError,Math.abs(q[j]-ref[j]))
      replayError=Math.max(replayError,Math.abs(qr[j]-ref[j]))
    }
  }
  const threshold=kind==='swimmer'?1e-4:kind==='magnetic'?1e-5:1e-7,maxError=Math.max(probeError,shapeError)
  const compatibility={pass:replayValid&&replayError<1e-8&&reachedLimit===data.metadata.warnings.length,maxError:replayError,threshold:1e-8,reachedLimit,unconverged}
  const strict=converged&&maxError<threshold
  const id=kind==='membrane'?'hyper-membrane':kind==='magnetic'?'robot-magnetic':'robot-swim'
  const name=kind==='membrane'?'超弹性轴对称膜':kind==='magnetic'?'磁场驱动柔性梁':'流固耦合软体游动'
  const caveat=kind==='swimmer'?'原脚本两端均使用第一端速度、磁力显式且其迭代 Jacobian 不完整；工作台保留该载荷但更严格收敛，不能称作完整流场求解。':kind==='membrane'?'原压力按上一构型计算，质量装配遵循原代码。':'原脚本磁力 Jacobian 为零；工作台采用精确磁力 Jacobian。'
  return {id,name,pass:strict&&compatibility.pass,maxError,threshold,compatibility,detail:
    `前 ${(data.steps*data.dt).toFixed(2)} s：每步测量节点两个坐标最大误差 ${probeError.toExponential(2)} m；${data.frames.length} 帧全部 ${parameters.nodes} 节点坐标最大误差 ${shapeError.toExponential(2)} m（严格阈值 ${threshold.toExponential(0)} m，${strict?'通过':'未通过'}）。原脚本兼容回放最大误差 ${replayError.toExponential(2)} m（阈值 1e-8 m，${compatibility.pass?'通过':'未通过'}）；原脚本 ${data.metadata.warnings.length} 次达到迭代上限，回放最后更新后的最大残差 ${maxPostResidual.toExponential(2)}。${caveat}采样构型不是逐步全节点验证。`}
}
function compareAxisymmetricReference():ReferenceCheck {return compareSampled(membraneReference,'membrane')}
function compareSoftReference(kind:SoftRobotKind,data:SampledReference):ReferenceCheck {return compareSampled(data,kind)}
export const membraneReferenceMetadata=membraneReference.metadata
export const softMagneticReferenceMetadata=softMagneticReference.metadata
export const softSwimReferenceMetadata=softSwimReference.metadata
