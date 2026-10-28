import type {GripperFrame} from '../engine/gripper'
export type GripperChartMetric='tip'|'tension'|'contact'|'stress'|'energy'
const metric={
  tip:{label:'指端横向位移',unit:'mm',value:(f:GripperFrame)=>f.tipDeflection*1000,color:'#477c73'},
  tension:{label:'腱张力',unit:'N',value:(f:GripperFrame)=>f.tension,color:'#dc6755'},
  contact:{label:'最大孔壁法向力',unit:'N',value:(f:GripperFrame)=>Math.max(0,...f.contacts.map(c=>c.magnitude)),color:'#dc9a4f'},
  stress:{label:'最大 von Mises 应力',unit:'kPa',value:(f:GripperFrame)=>f.maxStress/1000,color:'#598d83'},
  energy:{label:'总势能',unit:'mJ',value:(f:GripperFrame)=>f.energy*1000,color:'#628ba7'},
} satisfies Record<GripperChartMetric,{label:string;unit:string;value:(f:GripperFrame)=>number;color:string}>
export function GripperChart({history,cursor,mode,target}:{history:GripperFrame[];cursor:number;mode:GripperChartMetric;target:number}){
  const w=650,h=190,left=54,right=18,top=16,bottom=32,config=metric[mode],values=history.map(config.value)
  const max=Math.max(1e-4,...values)*1.15,xmax=Math.max(.001,target*1000)
  const x=(v:number)=>left+(w-left-right)*v/xmax,y=(v:number)=>top+(h-top-bottom)*(1-v/max)
  const path=history.map((f,i)=>`${i?'L':'M'}${x(f.pull*1000).toFixed(2)} ${y(config.value(f)).toFixed(2)}`).join(' '),current=history[cursor]
  return <div className="gripper-chart" aria-label={`${config.label}随牵引位移的变化`}>
    <div className="gripper-chart-caption"><span>{config.label} <small>({config.unit})</small></span><strong>{current?config.value(current).toFixed(mode==='tension'||mode==='contact'?3:2):'—'} <small>{config.unit}</small></strong></div>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${config.label}曲线；横轴牵引位移，单位毫米`} preserveAspectRatio="none">
      {[0,.5,1].map((f,i)=><g key={i}><line x1={left} x2={w-right} y1={y(f*max)} y2={y(f*max)} stroke="#e5ece8"/><text x={left-9} y={y(f*max)+4} textAnchor="end" fill="#91a49a" fontSize="10">{(f*max).toFixed(mode==='tension'||mode==='contact'?2:1)}</text></g>)}
      {history.length>1&&<path d={`${path} L${x(history.at(-1)!.pull*1000)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={config.color} opacity=".08"/>}
      <path d={path} fill="none" stroke={config.color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>
      {current&&<><circle cx={x(current.pull*1000)} cy={y(config.value(current))} r="6" fill="white" stroke={config.color}/><circle cx={x(current.pull*1000)} cy={y(config.value(current))} r="3" fill={config.color}/></>}
      {[0,.5,1].map((v,i)=><text key={i} x={x(xmax*v)} y={h-8} textAnchor={i===0?'start':i===2?'end':'middle'} fill="#91a49a" fontSize="10">{(xmax*v).toFixed(1)} mm</text>)}
    </svg>
  </div>
}
