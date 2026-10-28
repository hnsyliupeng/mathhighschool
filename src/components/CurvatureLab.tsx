import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'

/** Integrated signed turning curvature of two equal unit edges. */
export function curvatureFromDegrees(degrees:number) {
  const phi=degrees*Math.PI/180
  return 2*Math.tan(phi/2)
}

export function CurvatureLab(){
  const [degrees,setDegrees]=useState(35),[playing,setPlaying]=useState(false)
  const phi=degrees*Math.PI/180,beta=curvatureFromDegrees(degrees),x=200+118*Math.cos(phi),y=128-118*Math.sin(phi)
  useEffect(()=>{
    if(!playing)return
    let raf=0,start=performance.now()
    const animate=(time:number)=>{setDegrees(55*Math.sin((time-start)/1100));raf=requestAnimationFrame(animate)}
    raf=requestAnimationFrame(animate);return ()=>cancelAnimationFrame(raf)
  },[playing])
  const arcEndX=200+36*Math.cos(phi),arcEndY=128-36*Math.sin(phi)
  return <div className="curvature-lab">
    <div className="curvature-heading"><div><span className="eyebrow">GEOMETRY IN MOTION</span><h3>动手调整转角，观察离散曲率</h3><p>两条单位长度边共享一个节点。拖动滑块，或播放转角变化。</p></div><button className="small-outline" onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={13}/>:<Play size={13}/>} {playing?'暂停演示':'播放演示'}</button></div>
    <div className="curvature-body"><svg viewBox="0 0 390 220" role="img" aria-label="两条离散边的夹角和曲率示意">
      <defs><pattern id="curvature-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#e0e9dc" strokeWidth=".7"/></pattern></defs><rect x="0" y="0" width="390" height="220" rx="6" fill="url(#curvature-grid)"/>
      <path d="M40 128H350" stroke="#becdbb" strokeWidth="1" strokeDasharray="4 5"/>
      <path d={`M82 128 L200 128 L${x} ${y}`} fill="none" stroke="#c88b50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {Math.abs(degrees)>1&&<path d={`M236 128 A36 36 0 0 ${degrees>0?0:1} ${arcEndX} ${arcEndY}`} fill="none" stroke="#769b7b" strokeWidth="1.6"/>}
      <circle cx="82" cy="128" r="5" fill="#fff" stroke="#ca8d50" strokeWidth="2"/><circle cx="200" cy="128" r="6" fill="#466b50" stroke="#fff" strokeWidth="2"/><circle cx={x} cy={y} r="5" fill="#fff" stroke="#ca8d50" strokeWidth="2"/>
      <text x="69" y="151" fill="#7d9581" fontSize="12">x₀</text><text x="193" y="151" fill="#597b60" fontSize="12">x₁</text><text x={x+8} y={y-6} fill="#7d9581" fontSize="12">x₂</text><text x="240" y={degrees>=0?115:146} fill="#6a8f70" fontSize="14">φ</text>
      <text x="125" y="116" fill="#b58a61" fontSize="11">e₁</text><text x={(200+x)/2+4} y={(128+y)/2-10} fill="#b58a61" fontSize="11">e₂</text>
    </svg><div className="curvature-controls"><div className="parameter-heading"><label>有向转角 <em>φ</em></label><strong data-testid="curvature-angle">{degrees.toFixed(0)}°</strong></div><input type="range" min="-80" max="80" step="1" value={Math.round(degrees)} onChange={e=>{setPlaying(false);setDegrees(Number(e.target.value))}} aria-label="离散转角" style={{'--fill':`${(degrees+80)/160*100}%`} as React.CSSProperties}/><div className="parameter-range"><span>−80°</span><span>+80°</span></div><div className="curvature-metric"><span>积分曲率 · β = 2 tan(φ/2)</span><strong data-testid="curvature-value">{beta.toFixed(3)}</strong></div><div className="curvature-metric"><span>单位 EI 与参考长度下的弯曲能</span><strong>{(.5*beta*beta).toFixed(3)}</strong></div><p>φ → 0 时，β ≈ φ（弧度）；转角接近 180° 时公式趋于奇异。</p></div></div>
  </div>
}
