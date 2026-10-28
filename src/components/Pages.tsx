import { useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, Circle, ClipboardCheck, ExternalLink, FlaskConical, Info, LoaderCircle, Search, ShieldCheck } from 'lucide-react'
import { cases, groups, type CaseDefinition, type CaseGroup } from '../data/cases'
import { theory } from '../data/theory'
import { runVerification, type VerificationResult } from '../engine/verification'
import { CaseArt } from './CaseArt'
import { MathBlock } from './MathBlock'
import { CurvatureLab } from './CurvatureLab'
import { SpatialRodLab } from './SpatialRodLab'

type PageProps={onSelect:(item:CaseDefinition)=>void}
export function LibraryPage({onSelect,initialSearch=''}:PageProps & {initialSearch?:string}){
  const [group,setGroup]=useState<CaseGroup|'全部'>('全部'),[query,setQuery]=useState(initialSearch)
  const filtered=cases.filter(c=>(group==='全部'||c.group===group)&&`${c.title} ${c.english} ${c.section} ${c.tag}`.toLowerCase().includes(query.toLowerCase().trim()))
  return <div className="page-inner library-page">
    <div className="page-kicker"><span className="kicker-dot"/> THE CASE LIBRARY <span className="kicker-line"/> 01 — 21</div>
    <div className="page-heading-row"><div><h1>每一种变形，都有迹可循。</h1><p>从简单振子到柔性机器人，沿着论文的章节探索 21 个交互算例。</p></div><div className="page-count"><strong>21</strong><span>个算例<br/>等待探索</span></div></div>
    <div className="library-toolbar"><div className="filter-scroll"><button className={group==='全部'?'filter active':'filter'} onClick={()=>setGroup('全部')}>全部 <span>21</span></button>{groups.map(g=><button className={group===g?'filter active':'filter'} key={g} onClick={()=>setGroup(g)}>{g}</button>)}</div><label className="library-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索算例、章节..." aria-label="搜索算例"/></label></div>
    <div className="results-label"><span>EXPLORING {group==='全部'?'ALL CASES':group}</span><span>共 {filtered.length.toString().padStart(2,'0')} 个结果</span></div>
    {filtered.length?<div className="case-grid">{filtered.map((item,index)=><button className="case-card" key={item.id} onClick={()=>onSelect(item)} data-case-id={item.id}>
      <div className="case-art-wrap"><CaseArt item={item}/><span className="case-card-number">{String(cases.indexOf(item)+1).padStart(2,'0')}</span><span className="case-open"><ArrowUpRight size={16}/></span></div>
      <div className="case-card-body"><div className="case-card-meta"><span>{item.group}</span><span>§ {item.section}</span></div><h3>{item.title}</h3><p>{item.english}</p><div className="case-card-bottom"><span className="tiny-tag">{item.tag}</span><span>{item.method!=='proxy'?'数值求解':'约束示意'} <ArrowRight size={14}/></span></div></div>
    </button>)}</div>:<div className="empty-state"><Search size={25}/><strong>没有找到相关算例</strong><span>试试其他关键词或分类。</span></div>}
    <div className="scope-note"><Info size={17}/><span>算例库完整对应参考仓库的 21 个目录。标记为「约束示意」的模型仅用于教学，不等同原文 MATLAB 的定量复现。</span></div>
  </div>
}

export function TheoryPage({initialChapter='framework',onCase}:{initialChapter?:string;onCase:()=>void}){
  const [active,setActive]=useState(theory.some(c=>c.id===initialChapter)?initialChapter:'framework')
  const chapter=theory.find(c=>c.id===active)!
  return <div className="page-inner theory-page">
    <div className="page-kicker"><span className="kicker-dot"/> THE THEORY <span className="kicker-line"/> FROM GEOMETRY TO MOTION</div>
    <div className="page-heading-row"><div><h1>从几何，走向方程。</h1><p>沿着「离散几何 → 能量 → 力 → 求解」的路径，一步步理解 DDG。</p></div><div className="page-count"><strong>08</strong><span>个理论模块<br/>循序渐进</span></div></div>
    <div className="theory-layout"><aside className="theory-nav"><div className="side-overline">推导目录 <span>CHAPTERS</span></div>{theory.map(ch=><button key={ch.id} className={active===ch.id?'theory-nav-item active':'theory-nav-item'} onClick={()=>setActive(ch.id)}><span>{ch.number}</span><div><strong>{ch.title}</strong><small>{ch.english}</small></div><ArrowRight size={15}/></button>)}</aside>
      <article className="derivation"><div className="derivation-head"><div><span className="section-number">CHAPTER {chapter.number}</span><h2>{chapter.title}</h2><p>{chapter.intro}</p></div><span className="paper-pill"><BookOpen size={14}/> {chapter.pages}</span></div>
        {chapter.id==='planar'&&<CurvatureLab/>}
        {chapter.id==='rod'&&<SpatialRodLab/>}
        {chapter.steps.map((step,i)=><section className="derivation-step" key={step.title}><div className="step-index">{String(i+1).padStart(2,'0')}</div><div className="step-body"><h3>{step.title.replace(/^\d+\. /,'')}</h3><p>{step.text}</p>{step.formula&&<MathBlock formula={step.formula}/>}</div></section>)}
        {chapter.caveat&&<div className="theory-caveat"><Info size={16}/><span>{chapter.caveat}</span></div>}
        <div className="derivation-footer"><div><strong>把公式带进实验</strong><p>在交互视图中观察这些几何量如何变化。</p></div><button className="button button-dark" onClick={onCase}>返回实验台 <ArrowRight size={16}/></button></div>
      </article></div>
  </div>
}

export function ValidationPage({onSelect}:PageProps){
  const [result,setResult]=useState<VerificationResult|null>(null),[running,setRunning]=useState(false),[progress,setProgress]=useState(0)
  const run=async()=>{setRunning(true);setProgress(0);try{setResult(await runVerification(setProgress))}finally{setRunning(false)}}
  const passed=result?.checks.filter(c=>c.pass).length??0,casePassed=result?.cases.filter(c=>c.pass).length??0,refPassed=result?.comparisons.filter(c=>c.pass).length??0
  return <div className="page-inner validation-page">
    <div className="page-kicker"><span className="kicker-dot"/> VERIFICATION <span className="kicker-line"/> MEASURE, DON'T ASSUME</div>
    <div className="page-heading-row"><div><h1>每一步，都值得检验。</h1><p>将公式、求解器和每个算例的可运行性分开核查；不把教学示意当作论文复现。</p></div><button className="button button-dark validation-run" onClick={run} disabled={running}>{running?<LoaderCircle className="spin" size={16}/>:<ClipboardCheck size={16}/>} {running?`正在检查 ${progress}%`:result?'重新运行验证':'运行验证'}</button></div>
    <div className="verification-summary"><div><span>NUMERICAL CHECKS</span><strong>{result?`${passed} / ${result.checks.length}`:'— / 15'}</strong><small>已实现内核的局部检查</small></div><div><span>CASE SMOKE TESTS</span><strong>{result?`${casePassed} / 21`:'— / 21'}</strong><small>初始化与有限数值</small></div><div><span>REFERENCE COMPARISON</span><strong>{result?`${refPassed} / 21`:'— / 21'}</strong><small>独立时窗通过数；临界条件诊断另列</small></div></div>
    <div className="validation-grid"><section className="validation-card"><div className="panel-label"><div><span className="eyebrow">NUMERICAL CHECKS</span><h2>公式与求解器</h2></div><ShieldCheck size={20}/></div><p className="muted">通过中心差分、离散残差与小挠度解析解检查实现。点击运行后展示本次计算结果。</p>
      {result?result.checks.map(c=><div className="check-row" key={c.name}><span className={c.pass?'status-icon pass':'status-icon fail'}>{c.pass?<Check size={14}/>:<Info size={14}/>}</span><div><strong>{c.name}</strong><p>{c.detail}</p></div><span className={c.pass?'check-state pass':'check-state fail'}>{c.pass?'通过':c.skipped?'未验证':'未通过'}</span></div>):<div className="not-run"><FlaskConical size={24}/><strong>还没有运行本次检查</strong><span>测试将在浏览器内执行，不上传任何数据。</span></div>}
    </section><section className="validation-card"><div className="panel-label"><div><span className="eyebrow">SCOPE OF VALIDATION</span><h2>如何读懂验证结果</h2></div><Info size={20}/></div><div className="scope-item"><span>01</span><div><strong>数值内核验证</strong><p>对已实现的单元梯度、线性系统和小挠度极限进行可重复检查；这不代表全部理论公式均已数值验证。</p></div></div><div className="scope-item"><span>02</span><div><strong>算例可运行性</strong><p>每个算例检查初始化、时间推进、节点运动与有限数值。这不是物理精度验证。</p></div></div><div className="scope-item"><span>03</span><div><strong>原文对照的范围</strong><p>已有参考数据的模型按指定的时程与采样范围比较；其他算例仍未完成原文定量对照。原脚本迭代与更严格收敛解分别报告；网格、步长、全部公式和不同参数仍需继续验证。</p></div></div><a className="text-link" href="https://github.com/weicheng-huang-mechanics/DDG_Tutorial" target="_blank" rel="noreferrer">查看原始 MATLAB 仓库 <ExternalLink size={14}/></a></section></div>
    <section className="reference-results validation-card"><div className="panel-label"><div><span className="eyebrow">ORIGINAL CODE · PARTIAL BENCHMARKS</span><h2>参考代码局部数值对照</h2></div><a className="text-link" href="https://github.com/weicheng-huang-mechanics/DDG_Tutorial/tree/20d732f3fffdd5137eee720e46175de3a98016c6" target="_blank" rel="noreferrer">参考版本 20d732f <ExternalLink size={14}/></a></div><p className="muted">参考数据由 MATLAB 源方程在 GNU Octave 7.2.0 中生成；柔性网使用经前五步对照的稀疏向量化装配。振子对齐原驱动时间；悬臂梁只对照前 0.5 s；其余模型按下列时间窗比较测量节点及采样构型。跃迁的严格阈值与原脚本兼容回放分别报告；超弹性索及其他模型的时窗和参数范围见各行。球冠能否覆盖翻转须看独立时窗与单列的条件诊断，不能仅凭局部通过判断。</p>{result?result.comparisons.map(c=><div className="check-row" key={c.id}><span className={c.pass?'status-icon pass':'status-icon fail'}>{c.pass?<Check size={14}/>:<Info size={14}/>}</span><div><strong>{c.name}</strong><p>{c.detail}</p>{c.conditional&&<div className="conditional-check"><strong>翻转条件诊断：{c.conditional.pass?'通过':'未通过'}</strong><p>{c.conditional.detail}</p></div>}</div><span className={c.pass?'check-state pass':'check-state fail'}>{c.pass?'局部通过':'未通过'}</span></div>):<div className="reference-pending">运行验证后显示已有参考数据的误差、阈值和对照区间。</div>}</section>
    <div className="section-heading validation-cases-heading"><div><span className="eyebrow">CASE-BY-CASE</span><h2>逐项算例检查</h2></div><span className="subtle">数值对照状态与可运行性分列</span></div>
    <div className="case-check-list">{cases.map((item,i)=>{const check=result?.cases.find(c=>c.id===item.id),comparison=result?.comparisons.find(c=>c.id===item.id);return <button key={item.id} onClick={()=>onSelect(item)} className="case-check-row"><span className="case-check-no">{String(i+1).padStart(2,'0')}</span><span className="case-check-title"><strong>{item.title}</strong><small>§ {item.section} · {item.group}</small></span><span className={check?(check.pass?'verification-pill pass':'verification-pill fail'):'verification-pill'}>{check?(check.pass?<CheckCircle2 size={13}/>:<Info size={13}/>):<Circle size={13}/>} {check?(check.pass?'可运行':'检查失败'):'未运行'}</span><span className={comparison?.pass&&(!comparison.conditional||comparison.conditional.pass)?'comparison-pill pass':'comparison-pill'}>{comparison?(comparison.conditional&&!comparison.conditional.pass?`${comparison.pass?'局部通过':'局部未通过'} · 翻转诊断未通过`:comparison.pass?'局部对照通过':'对照未通过'):item.method!=='proxy'&&!result?'局部对照未运行':'原文对照待完成'}</span><ArrowUpRight size={15}/></button>})}</div>
  </div>
}
