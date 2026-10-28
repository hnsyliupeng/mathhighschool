import type { Sample } from '../engine/useSimulation'

/** Time history or a physical load/displacement path from recorded solver states. */
export function ResponseChart({history,cursor,unit,duration=10,mode='time'}:{history:Sample[];cursor:number;unit:string;duration?:number;mode?:'time'|'load'}){
  const w=720,h=150,left=52,right=16,top=14,bottom=28
  const load=mode==='load'&&history.some(s=>s.loadCurve)
  const samples=load?history.filter(s=>s.loadCurve):history
  const axis=samples[0]?.loadCurve
  const xValue=(s:Sample)=>load?s.loadCurve!.x:s.time
  const yValue=(s:Sample)=>load?s.loadCurve!.y:s.displacement
  const values=samples.map(yValue),xvalues=samples.map(xValue)
  const maxAbs=Math.max(load?1e-6:.02,...values.map(Math.abs))*1.25
  const min=Math.min(-maxAbs*.15,...values)-maxAbs*.08,max=Math.max(maxAbs*.15,...values)+maxAbs*.08
  const xmin=load?Math.min(0,...xvalues):0
  const xmax=load?Math.max(1e-6,...xvalues):Math.max(Math.min(2,duration),history.at(-1)?.time??0)
  const px=(x:number)=>left+(w-left-right)*(x-xmin)/(xmax-xmin||1)
  const py=(v:number)=>top+(h-top-bottom)*(max-v)/(max-min||1)
  const line=samples.map((s,i)=>`${i?'L':'M'} ${px(xValue(s)).toFixed(2)} ${py(yValue(s)).toFixed(2)}`).join(' ')
  const zero=py(0),area=samples.length>1?`${line} L ${px(xValue(samples.at(-1)!))} ${zero} L ${px(xValue(samples[0]))} ${zero} Z`:''
  const current=history[Math.max(0,Math.min(cursor,history.length-1))]
  const format=(value:number)=>Math.abs(value)>=1000?`${(value/1000).toFixed(1)}k`:Math.abs(value)>0&&Math.abs(value)<.01?value.toExponential(1):value.toFixed(2)
  const description=load?`${axis?.yLabel}随${axis?.xLabel}变化的记录曲线`:'位移随时间变化的记录曲线'
  return <div className="chart-wrap" aria-label={description}>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={load?`${axis?.yLabel}曲线，纵轴单位 ${axis?.yUnit}`:`位移曲线，单位 ${unit}`} preserveAspectRatio="none">
      <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#799b86" stopOpacity=".24"/><stop offset="1" stopColor="#799b86" stopOpacity="0"/></linearGradient></defs>
      {[0,.5,1].map((v,i)=>{const y=top+(h-top-bottom)*v;return <g key={i}><line x1={left} x2={w-right} y1={y} y2={y} stroke="#e9ede7" strokeWidth="1"/><text x={left-10} y={y+4} textAnchor="end" fill="#a2ada3" fontSize="10">{format(max-(max-min)*v)}</text></g>})}
      <line x1={left} x2={w-right} y1={zero} y2={zero} stroke="#d3dcd1" strokeWidth="1" strokeDasharray="3 4" />
      {area&&<path d={area} fill="url(#chartFill)"/>}
      <path d={line} fill="none" stroke="#537b65" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>
      {current&&(!load||current.loadCurve)&&<><circle cx={px(xValue(current))} cy={py(yValue(current))} r="7" fill="#fff" stroke="#8dac98" strokeWidth="1"/><circle cx={px(xValue(current))} cy={py(yValue(current))} r="3.5" fill="#547b65"/></>}
      {[0,.5,1].map((v,i)=><text key={i} x={left+(w-left-right)*v} y={h-5} textAnchor={i===0?'start':i===2?'end':'middle'} fill="#a2ada3" fontSize="10">{load?`${format(xmin+(xmax-xmin)*v)} ${axis?.xUnit}`:`${(xmax*v).toFixed(1)} s`}</text>)}
    </svg>
  </div>
}
