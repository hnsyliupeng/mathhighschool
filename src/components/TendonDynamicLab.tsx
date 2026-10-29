import {useEffect,useMemo,useRef,useState} from 'react'
import {Activity,ArrowDownToLine,ArrowRight,Camera,Eye,Film,Pause,Play,RotateCcw,Settings2,TriangleAlert} from 'lucide-react'
import {MATERIAL_PRESETS,type MaterialObjectId,type ObjectMesh} from '../engine/material-grasp3d'
import {defaultTendonDynamicParams,type TendonDynamicFrame,type TendonDynamicParams,type TendonDynamicSummary} from '../engine/tendon-dynamic-grasp'
import {summarizeCompleteTendonDynamic} from '../engine/tendon-dynamic-certification'
import type {Mesh3D} from '../engine/gripper3d'
import {FINGERS} from '../engine/bionic-hand3d'
import {MathBlock} from './MathBlock'
import {TendonDynamicViewport,type TendonDynamicViewportHandle} from './TendonDynamicViewport'
import eggRecordingUrl from '../data/tendon-egg-recording.json?url'
import screwdriverRecordingUrl from '../data/tendon-screwdriver-recording.json?url'
import capRecordingUrl from '../data/tendon-cap-recording.json?url'
import './gripper.css'
import './gripper3d.css'
import './bionic-hand.css'
import './multi-object.css'
import './material-grasp.css'
import './tendon-dynamic.css'

type Status='loading'|'idle'|'running'|'paused'|'failed'|'complete'
interface Ready {mesh:ObjectMesh;fingerMesh:Mesh3D;fixtureNodes:number[];reference:{sourceHash:string;frames:number;maxPull:number;lastAngle:number;maxTendonPenetration:number;minInterpolationJ:number}}
function presetParams(id:MaterialObjectId):TendonDynamicParams{
  const p=defaultTendonDynamicParams(id)
  if(id==='screwdriver')return {...p,scale:.8,offsetX:-.022}
  if(id==='bottle-cap')return {...p,scale:1.3,offsetX:-.022,driveStiffness:200,pull:.01475}
  return p
}
function Slider({label,value,min,max,step,unit,onChange,testId}:{label:string;value:number;min:number;max:number;step:number;unit:string;onChange:(x:number)=>void;testId?:string}){
  return <div className="parameter"><div className="parameter-heading"><label>{label}</label><strong>{value.toFixed(step<.1?2:step<1?1:0)} <small>{unit}</small></strong></div><input data-testid={testId} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{'--fill':`${100*(value-min)/(max-min)}%`} as React.CSSProperties}/><div className="parameter-range"><span>{min}</span><span>{max} {unit}</span></div></div>
}
function saveCsv(history:TendonDynamicFrame[],params:TendonDynamicParams){
  const rows=['time_s,fixture_active,rise_m,wrist_rise_m,thumb_contact,contact_fingers,max_penetration_m,max_contact_residual_m,max_strain,ccd_verified,substeps,pull_thumb_m,pull_index_m,pull_middle_m,pull_ring_m,pull_little_m,normal_thumb_N,normal_index_N,normal_middle_N,normal_ring_N,normal_little_N']
  for(const f of history)rows.push([f.time,Number(f.fixtureActive),f.rise,f.wristRise,Number(f.thumbContact),f.contactFingers,f.maxPenetration,f.maxContactResidual,f.maxStructuralStrain,Number(f.verifiedCCD),f.substeps,...f.fingers.map(x=>x.pull),...f.normalForces].join(','))
  const url=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download=`tendon-dynamic-${params.id}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function Experiment({params,onApply}:{params:TendonDynamicParams;onApply:(p:TendonDynamicParams)=>void}){
  const [draft,setDraft]=useState(params),[ready,setReady]=useState<Ready|null>(null),[history,setHistory]=useState<TendonDynamicFrame[]>([]),[cursor,setCursor]=useState(0),[status,setStatus]=useState<Status>('loading'),[error,setError]=useState(''),[summary,setSummary]=useState<TendonDynamicSummary|null>(null),[wire,setWire]=useState(false),[xray,setXray]=useState(true),[contacts,setContacts]=useState(true),[exporting,setExporting]=useState(false),[replay,setReplay]=useState(false),[recorded,setRecorded]=useState<{steps:number;hash:string}|null>(null)
  const worker=useRef<Worker|null>(null),viewport=useRef<TendonDynamicViewportHandle>(null)
  useEffect(()=>{
    const w=new Worker(new URL('../engine/tendon-dynamic.worker.ts',import.meta.url),{type:'module'});worker.current=w
    w.onmessage=e=>{
      const d=e.data
      if(d.type==='ready'){setReady({mesh:d.mesh,fingerMesh:d.fingerMesh,fixtureNodes:d.fixtureNodes,reference:d.reference});setHistory([d.frame]);setCursor(0);setStatus('idle')}
      else if(d.type==='frames'){setHistory(old=>{const all=[...old,...d.frames];setCursor(all.length-1);return all})}
      else if(d.type==='failed'){setStatus('failed');setError(d.message||'数值步失败');if(d.summary)setSummary(d.summary)}
      else if(d.type==='complete'){setStatus('complete');setSummary(d.summary)}
    }
    w.onerror=e=>{setStatus('failed');setError(e.message||'工作线程失败')}
    w.postMessage({type:'initialize',params})
    return()=>{worker.current=null;w.terminate()}
  },[params])
  useEffect(()=>{if(!replay||history.length<2)return;const timer=setInterval(()=>setCursor(i=>i>=history.length-1?0:i+1),100);return()=>clearInterval(timer)},[replay,history.length])
  const frame=history[cursor],preset=MATERIAL_PRESETS.find(p=>p.id===params.id)!,localSummary=useMemo(()=>summary||summarizeCompleteTendonDynamic(history,params),[summary,history,params])
  const start=()=>{setReplay(false);worker.current?.postMessage({type:'start'});setStatus('running')}
  const pause=()=>{worker.current?.postMessage({type:'pause'});setStatus('paused')}
  const canLoadRecording=params.id!=='cloth'&&JSON.stringify(params)===JSON.stringify(presetParams(params.id))
  const loadRecording=async()=>{try{
    const url=params.id==='egg'?eggRecordingUrl:params.id==='screwdriver'?screwdriverRecordingUrl:capRecordingUrl
    const response=await fetch(url);if(!response.ok)throw Error('无法加载预计算轨迹')
    const r=await response.json() as {kind:string;params:TendonDynamicParams;sourceHash:string;referenceHash:string;steps:number;certifiedEveryAcceptedStep:boolean;summary:TendonDynamicSummary;frames:TendonDynamicFrame[]}
    if(!ready||r.kind!=='sampled-recording'||JSON.stringify(r.params)!==JSON.stringify(params)||r.referenceHash!==ready.reference.sourceHash||!r.certifiedEveryAcceptedStep||r.steps<1||r.frames.length<2||r.frames[0].time!==0||Math.abs(r.frames.at(-1)!.time-params.duration)>1e-9||r.frames.some((f,i)=>!f.finite||(i>0&&(!f.verifiedCCD||f.time<=r.frames[i-1].time))))throw Error('预计算轨迹与当前工况或参考数据不匹配')
    setHistory(r.frames);setCursor(r.frames.length-1);setSummary(r.summary);setRecorded({steps:r.steps,hash:r.sourceHash});setStatus('complete');setReplay(false);setError('')
  }catch(e){setError(e instanceof Error?e.message:String(e))}}
  const gif=async()=>{try{setExporting(true);await viewport.current?.exportGif(history)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setExporting(false)}}
  return <>
    <div className="tendon-layout"><section className="grip-stage card"><div className="grip-stage-top"><div><span className="eyebrow">TENDON MANIFOLD × DEFORMABLE OBJECT</span><h2>五指与自由物体</h2></div><div className="tendon-view-buttons"><button onClick={()=>setWire(!wire)} aria-pressed={wire}>网格</button><button onClick={()=>setXray(!xray)} aria-pressed={xray}><Eye size={13}/> 透视腱</button><button onClick={()=>setContacts(!contacts)} aria-pressed={contacts}>接触点</button><button aria-label="重置视角" onClick={()=>viewport.current?.reset()}><RotateCcw size={14}/></button><button aria-label="保存截图" onClick={()=>viewport.current?.save()}><Camera size={14}/></button></div></div>
      {ready&&frame?<div className="tendon-stage-wrap"><TendonDynamicViewport ref={viewport} mesh={ready.fingerMesh} objectMesh={ready.mesh} fixtureNodes={ready.fixtureNodes} frame={frame} id={params.id} wire={wire} xray={xray} contacts={contacts}/><div className="tendon-overlay"><span><i className="tendon-dot"/> 腱驱 Q1 参考指形</span><span><i className="object-dot"/> 物体真实弹簧网格</span><span><i className="contact-dot"/> 表面接触</span><span data-testid="tendon-fixture">{frame.fixtureActive?'临时夹具：启用':'临时夹具：已释放'}</span></div></div>:<div className="tendon-loading">{status==='failed'?'初始化失败':'正在加载并检查 Q1 腱驱参考轨迹…'}</div>}
      {error&&<div role="alert" className="grip-error"><TriangleAlert size={16}/><span>{error}。{status==='failed'&&'失败步不进入轨迹，已恢复至上一个接受状态。'}</span></div>}
      {canLoadRecording&&status==='idle'&&<div className="tendon-recording"><button data-testid="tendon-load-recording" onClick={loadRecording}><Play size={13} fill="currentColor"/> 查看{preset.name}预计算轨迹</button><span>516 步已计算；载入 12 个采样帧，无需等待重新求解</span></div>}
      {recorded&&<div className="tendon-recording-note" data-testid="tendon-recording-note">预计算采样回放：{recorded.steps} 个实际积分请求步、当前显示 {history.length} 帧；源码哈希 {recorded.hash.slice(0,12)}。CSV 和 GIF 仅含采样帧，结果摘要来自完整逐步记录。</div>}
      <div className="material-playback"><div className="material-play-buttons">{status==='idle'||status==='paused'?<button className="grip-play" data-testid="tendon-run" aria-label={status==='idle'?'开始仿真':'继续仿真'} onClick={start}><Play size={16} fill="currentColor"/></button>:status==='running'?<button className="grip-play" aria-label="暂停仿真" onClick={pause}><Pause size={16} fill="currentColor"/></button>:<button className="grip-play" disabled={history.length<2} data-testid="tendon-replay" aria-label={replay?'暂停回放':'回放轨迹'} onClick={()=>setReplay(!replay)}>{replay?<Pause size={16}/>:<Play size={16} fill="currentColor"/>}</button>}<button aria-label="重置仿真" onClick={()=>onApply(params)}><RotateCcw size={15}/></button><span data-testid="tendon-time">{(frame?.time||0).toFixed(3)} <small>/ {params.duration.toFixed(2)} s</small></span></div><input type="range" aria-label="仿真历史" data-testid="tendon-seek" min={0} max={Math.max(0,history.length-1)} value={cursor} disabled={history.length<2||status==='running'} onChange={e=>{setReplay(false);setCursor(Number(e.target.value))}}/><small data-testid="tendon-status">{status==='loading'?'加载中':status==='idle'?'点击开始':status==='running'?'Worker 计算中':status==='paused'?'已暂停':status==='failed'?'失败并回滚':'计算完成'}</small></div>
    </section><aside className="grip-parameters card"><div className="grip-panel-head"><div><span className="eyebrow">OBJECT · TENDON · CONTACT</span><h2>抓取参数</h2></div><span><Settings2 size={18}/></span></div><p>尺寸改变物体几何、质量和弹簧原长；刚度改变物体弹簧，不是视觉缩放。</p>
      <Slider label="物体尺寸" value={draft.scale*100} min={70} max={130} step={5} unit="%" testId="tendon-scale" onChange={v=>setDraft({...draft,scale:v/100})}/>
      <Slider label="物体弹簧刚度" value={draft.stiffnessScale} min={.25} max={4} step={.05} unit="×" testId="tendon-stiffness" onChange={v=>setDraft({...draft,stiffnessScale:v})}/>
      <Slider label="物体相对掌心横移" value={draft.offsetX*1000} min={-30} max={30} step={1} unit="mm" testId="tendon-offset" onChange={v=>setDraft({...draft,offsetX:v/1000})}/>
      <Slider label="腱目标位移" value={draft.pull*1000} min={1} max={17} step={.25} unit="mm" testId="tendon-pull" onChange={v=>setDraft({...draft,pull:v/1000})}/>
      <Slider label="驱动器刚度" value={draft.driveStiffness} min={100} max={2000} step={50} unit="N/m" onChange={v=>setDraft({...draft,driveStiffness:v})}/>
      <Slider label="指面—物体摩擦" value={draft.friction} min={0} max={2} step={.05} unit="μ" testId="tendon-friction" onChange={v=>setDraft({...draft,friction:v})}/>
      <div className="material-advanced"><label>时间步<select aria-label="时间步" value={draft.dt} onChange={e=>setDraft({...draft,dt:Number(e.target.value)})}><option value={1/120}>1/120 s</option><option value={1/240}>1/240 s</option><option value={1/480}>1/480 s</option></select></label><label>每步迭代<select aria-label="每步迭代" value={draft.iterations} onChange={e=>setDraft({...draft,iterations:Number(e.target.value)})}>{[12,24,40,80].map(n=><option key={n}>{n}</option>)}</select></label></div>
      <label className="tendon-check"><input type="checkbox" checked={draft.verifyCCD} onChange={e=>setDraft({...draft,verifyCCD:e.target.checked})}/> 检查指间与指—物体连续碰撞</label><p className="material-inline-note">关闭 CCD 仅用于研究性试算，不可作为安全验证。目标允许超过参考轨迹末端作为弹性驱动预紧；实际腱位移受参考轨迹上限约束。</p><button className="button button-dark grip-apply" data-testid="tendon-apply" onClick={()=>onApply(draft)}>应用参数并重置 <ArrowRight size={15}/></button>
    </aside></div>
    {frame&&<><div className="grip-metrics tendon-metrics"><div><span>质心抬升</span><strong data-testid="tendon-rise">{(frame.rise*1000).toFixed(1)} <small>mm</small></strong><p>手腕位移 {(frame.wristRise*1000).toFixed(1)} mm</p></div><div><span>物体接触手指</span><strong data-testid="tendon-contacts">{frame.contactFingers} <small>/ 5</small></strong><p>拇指{frame.thumbContact?'有':'无'}接触</p></div><div><span>接触穿透 / 残差</span><strong>{(frame.maxPenetration*1000).toFixed(3)} <small>mm</small></strong><p>互补残差 {(frame.maxContactResidual*1000).toFixed(3)} mm</p></div><div><span>物体最大弹簧应变</span><strong>{(frame.maxStructuralStrain*100).toFixed(1)} <small>%</small></strong><p>数值保护，不是材料安全阈值</p></div><div><span>连续碰撞检查</span><strong>{frame.time===0?'—':frame.verifiedCCD?'已检查':'未检查'}</strong><p>本步 {frame.ccdChecks+frame.interFingerChecks} 对</p></div></div>
      {(status==='failed'||status==='complete')&&<div className="material-result warn" data-testid="tendon-result"><TriangleAlert size={19}/><div><strong>{status==='failed'?'数值步失败，当前工况未通过':localSummary.retained?'达到降阶短时保持条件（力未收敛）':'未满足保持条件'}</strong><p>{localSummary.reason}。接触残差及时间步敏感性仍须检查；这不等价于全自由度 Q1 耦合、网格收敛或真实手的抓取认证。</p></div></div>}
      <div className="grip-analysis-grid"><section className="grip-chart-card card"><div className="grip-section-head"><div><span className="eyebrow">CONTACT & ACTUATION</span><h2>五根腱的状态</h2></div><div className="grip3-exports"><button className="grip-export" disabled={history.length<2} data-testid="tendon-csv" onClick={()=>saveCsv(history,params)}><ArrowDownToLine size={14}/> CSV</button><button className="grip-export grip3-gif" disabled={history.length<2||status==='running'||exporting} data-testid="tendon-gif" onClick={gif}><Film size={14}/>{exporting?'编码中…':'GIF'}</button></div></div><div className="tendon-finger-table"><div><span>手指</span><span>实际腱位移</span><span>末段弯曲角</span><span>物体法向力</span></div>{FINGERS.map((f,i)=><div key={f.id}><strong>{f.name}</strong><span>{(frame.fingers[i].pull*f.scale*1000).toFixed(2)} mm</span><span>{frame.fingers[i].angle.toFixed(1)}°</span><span>{frame.normalForces[i].toFixed(3)} N</span></div>)}</div><p className="grip3-caption">实际腱位移是参考拉程乘指长比例；接触力是三角面乘子求和，未经过实验标定。失败前的已接受轨迹可导出。</p></section>
      <section className="grip-contact-card card"><div className="grip-section-head"><div><span className="eyebrow">REFERENCE & OBJECT</span><h2>{preset.name} · {Math.round(params.scale*100)}%</h2></div></div><p className="tendon-reference">{ready?.mesh.description}<br/>尺寸约 {ready?.mesh.dimensionsMm.map(x=>x.toFixed(1)).join(' × ')} mm，质量 {((ready?.mesh.mass||0)*1000).toFixed(1)} g。<br/><br/>参考指形：{ready?.reference.frames} 帧，最大弯曲角 {ready?.reference.lastAngle.toFixed(1)}°；相邻参考帧腱—孔壁路径允许压缩最多 2 μm。<br/>物体底部节点（布片上沿节点）被临时夹具固定；0.95 s 完全释放，1.08 s 开始抬升。</p></section></div></>}
  </>
}

export function TendonDynamicLab({openFullHand,openPadBench}:{openFullHand:()=>void;openPadBench:()=>void}){
  const [params,setParams]=useState(defaultTendonDynamicParams('egg')),[revision,setRevision]=useState(0)
  const apply=(p:TendonDynamicParams)=>{setParams({...p});setRevision(x=>x+1)}
  return <div className="page-inner gripper-page grip3-page hand-page material-page tendon-page"><div className="grip-intro"><div><div className="grip-kicker"><span/> FIVE TENDONS · DEFORMABLE OBJECTS</div><h1>腱驱五指 <span>动态抓取</span></h1><p>真实腱驱实体指的 Q1 参考轨迹，与不同尺寸、形状和刚度的可运动物体双向接触。<button className="grip3-inline" onClick={openFullHand}>查看完整自由度固定物体求解 <ArrowRight size={11}/></button></p></div><div className="grip-intro-tag"><div className="grip-intro-icon"><Activity size={20}/></div><div><strong>指面直接接触</strong><small>无球形指垫替代</small></div></div></div>
    <div className="grip3-mesh-warning material-warning"><TriangleAlert size={16}/><span><strong>这是单坐标/指的双向降阶模型，不是完整自由度 Q1 动态耦合。</strong>指面与腱形取自孔壁接触 Q1 平衡轨迹，物体反力经形状导数影响腱位移；载荷下手指只能沿该轨迹变形。鸡蛋时间步对比中接触力最大差达峰值的 97.5%，尚未收敛；参数未标定，物体自碰撞和网格收敛也未证实。<button className="grip3-inline" onClick={openPadBench}>旧球指垫实验（独立模型）</button></span></div>
    <div className="material-presets" aria-label="选择抓取物体">{MATERIAL_PRESETS.map(p=><button key={p.id} className={params.id===p.id?'active':''} data-testid={`tendon-preset-${p.id}`} onClick={()=>apply(presetParams(p.id as MaterialObjectId))}><span className={`material-preset-icon material-${p.id}`} aria-hidden="true"/><span><strong>{p.name}</strong><small>{p.english}</small></span>{params.id===p.id&&<i/>}</button>)}</div>
    <Experiment key={revision} params={params} onApply={apply}/>
    <section className="grip-method card"><div className="grip-method-head"><div><span className="eyebrow">MODEL, EQUATIONS & LIMITS</span><h2>从腱驱实体指到动态接触</h2></div></div><div className="grip-equations"><div><span>01</span><article><strong>实体指参考轨迹</strong><p>每一参考帧由有限半径腱与三维孔壁接触的 Q1 非线性平衡得到；五指采用成人手尺寸相似变换。两帧之间线性插值并检查腱与孔壁的连续安全。物体加载时不重新求解全部指节点。</p><MathBlock formula={'\\mathbf{x}_i(p)=(1-\\theta)\\mathbf{x}_{i,k}+\\theta\\mathbf{x}_{i,k+1},\\qquad 0\\leq\\theta\\leq1'}/></article></div><div><span>02</span><article><strong>双向虚功与柔顺驱动</strong><p>真实手指三角面与物体三角面求最近点；接触反力投影到每根腱的唯一形状坐标，反方向按物体面重心坐标分配。驱动器与参考腱力共同决定该坐标；参考自由指力用首腱段拉力近似，不是精确的驱动端能量梯度。</p><MathBlock formula={'Q_i=\\left(\\frac{\\partial\\mathbf{x}_{c,i}}{\\partial p_i}\\right)^T\\mathbf{f}_c,\\qquad \\mathbf{f}_{a}=-b_a\\mathbf{f}_c'}/></article></div><div><span>03</span><article><strong>变形物体、摩擦与释放</strong><p>物体为自由三角网格与弹簧网络，施加重力；单侧法向 XPBD 接触和库仑圆限制切向乘子。临时夹具完全释放后才抬升，失败步及其子步回滚。</p><MathBlock formula={'\\Delta\\lambda=\\frac{-C-\\alpha\\lambda}{\\sum w_i\\lVert\\nabla_i C\\rVert^2+\\alpha},\\quad\\alpha=(k\\Delta t^2)^{-1},\\quad\\lVert\\boldsymbol{\\lambda}_t\\rVert\\leq\\mu\\lambda_n'}/></article></div><div><span>04</span><article><strong>不能替代完整验证</strong><p>实际手指只允许一条预计算形变路径，不能求出受物体压迫时其他 Q1 节点的形变。摩擦为每步重置的位移级近似；物体自碰撞、掌面接触、材料破坏、实测参数标定、完整网格及时间收敛尚未完成。连续检测只覆盖两已接受状态间的分段线性轨迹。</p></article></div></div><p className="material-doc-link"><a href="https://github.com/hnsyliupeng/mathhighschool/blob/arena/7bf8ff28-mathhighschool/docs/TENDON_DYNAMIC_GRASP.md" target="_blank" rel="noreferrer">查看推导、数值工况与失败记录 ↗</a></p></section>
  </div>
}
