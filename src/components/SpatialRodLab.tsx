import {useEffect,useState} from 'react'
import {Pause,Play} from 'lucide-react'
import {spatialRodGeometry,type Vector3} from '../engine/spatial-rod-geometry'

const rad=(x:number)=>x*Math.PI/180
const sum=(a:Vector3,b:Vector3):Vector3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const scale=(a:Vector3,s:number):Vector3=>[a[0]*s,a[1]*s,a[2]*s]
// Fixed isometric projection, for instruction only; no hidden simulation state.
const project=([x,y,z]:Vector3):[number,number]=>[194+85*(x+.45*z),118-85*(y-.32*z)]

export function SpatialRodLab(){
  const [bend,setBend]=useState(55),[azimuth,setAzimuth]=useState(25),[thetaE,setThetaE]=useState(0),[thetaF,setThetaF]=useState(25),[playing,setPlaying]=useState(false)
  useEffect(()=>{
    if(!playing)return
    let raf=0,start=performance.now()
    const animate=(time:number)=>{setThetaF(65*Math.sin((time-start)/1400));raf=requestAnimationFrame(animate)}
    raf=requestAnimationFrame(animate);return()=>cancelAnimationFrame(raf)
  },[playing])
  const direction:Vector3=[Math.cos(rad(bend)),Math.sin(rad(bend))*Math.cos(rad(azimuth)),Math.sin(rad(bend))*Math.sin(rad(azimuth))]
  const p0:Vector3=[-1.15,0,0],p1:Vector3=[0,0,0],p2=scale(direction,1.15)
  const geometry=spatialRodGeometry({points:[p0,p1,p2],theta:[rad(thetaE),rad(thetaF)]})
  const a=project(p0),b=project(p1),c=project(p2),midE=scale(p0,.5),midF=scale(p2,.5)
  const arrow=(origin:Vector3,dir:Vector3,color:string,label:string)=>{
    const start=project(origin),end=project(sum(origin,scale(dir,.58)))
    return <g key={label}><line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} stroke={color} strokeWidth="2" markerEnd={`url(#rod-${color==='green'?'green':'blue'}-arrow)`}/><text x={end[0]+4} y={end[1]-4} fontSize="10" fill={color==='green'?'#547a5c':'#687fa0'}>{label}</text></g>
  }
  const slider=(label:string,value:number,min:number,max:number,set:(x:number)=>void)=>
    <div className="rod-control" key={label}><div className="parameter-heading"><label>{label}</label><strong>{value.toFixed(0)}°</strong></div><input type="range" aria-label={label} min={min} max={max} step="1" value={Math.round(value)} onChange={event=>{setPlaying(false);set(Number(event.target.value))}} style={{'--fill':`${(value-min)/(max-min)*100}%`} as React.CSSProperties}/></div>
  return <div className="curvature-lab rod-lab" data-testid="spatial-rod-lab">
    <div className="curvature-heading"><div><span className="eyebrow">MATERIAL FRAMES IN MOTION</span><h3>空间杆：旋转截面，观察曲率与扭转</h3><p>两条边、两组材料标架；调整转角或播放后边截面旋转。</p></div><button className="small-outline" onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={13}/>:<Play size={13}/>} {playing?'暂停演示':'播放扭转'}</button></div>
    <div className="curvature-body"><svg viewBox="0 0 390 220" role="img" aria-label="空间杆相邻边及材料标架的几何示意">
      <defs><pattern id="rod-lab-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#e0e9dc" strokeWidth=".7"/></pattern><marker id="rod-green-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#547a5c"/></marker><marker id="rod-blue-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#687fa0"/></marker></defs>
      <rect width="390" height="220" rx="6" fill="url(#rod-lab-grid)"/>
      <path d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}`} fill="none" stroke="#c88b50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {[a,b,c].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===1?5.5:4} fill={i===1?'#466b50':'#fff'} stroke="#c88b50" strokeWidth="2"/>)}
      {arrow(midE,geometry.m1e,'green','m₁ᵉ')}{arrow(midE,geometry.m2e,'blue','m₂ᵉ')}{arrow(midF,geometry.m1f,'green','m₁ᶠ')}{arrow(midF,geometry.m2f,'blue','m₂ᶠ')}
      <text x="15" y="203" fontSize="10" fill="#819787">绿：材料轴 m₁　蓝：材料轴 m₂　橙：中心线</text>
    </svg><div className="curvature-controls rod-controls">
      {slider('弯曲转角',bend,0,150,setBend)}{slider('空间方位角',azimuth,-80,80,setAzimuth)}{slider('前边材料转角',thetaE,-90,90,setThetaE)}{slider('后边材料转角',thetaF,-90,90,setThetaF)}
      <div className="curvature-metric"><span>积分曲率 (κ₁, κ₂)</span><strong data-testid="rod-kappa">({geometry.kappa[0].toFixed(3)}, {geometry.kappa[1].toFixed(3)})</strong></div>
      <div className="curvature-metric"><span>积分扭转 · θᶠ − θᵉ</span><strong data-testid="rod-twist">{geometry.twist.toFixed(3)} rad</strong></div>
      <p>局部几何示意：参考扭转固定为 0，不计算历史标架运输、力、Hessian 或整杆动力学。</p>
    </div></div>
  </div>
}
