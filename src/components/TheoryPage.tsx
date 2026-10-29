import {useState} from 'react'
import {ArrowRight,BookOpen,Info} from 'lucide-react'
import {theory} from '../data/theory'
import {MathBlock} from './MathBlock'
import {CurvatureLab} from './CurvatureLab'
import {SpatialRodLab} from './SpatialRodLab'
export function TheoryPage({initialChapter='framework',onChapterChange,onCase}:{initialChapter?:string;onChapterChange?:(id:string)=>void;onCase:()=>void}){
  const [active,setActive]=useState(theory.some(c=>c.id===initialChapter)?initialChapter:'framework')
  const chapter=theory.find(c=>c.id===active)!
  return <div className="page-inner theory-page">
    <div className="page-kicker"><span className="kicker-dot"/> THE THEORY <span className="kicker-line"/> FROM GEOMETRY TO MOTION</div>
    <div className="page-heading-row"><div><h1>从几何，走向方程。</h1><p>沿着「离散几何 → 能量 → 力 → 求解」的路径，一步步理解 DDG。</p></div><div className="page-count"><strong>08</strong><span>个理论模块<br/>循序渐进</span></div></div>
    <div className="theory-layout"><aside className="theory-nav"><div className="side-overline">推导目录 <span>CHAPTERS</span></div>{theory.map(ch=><button key={ch.id} className={active===ch.id?'theory-nav-item active':'theory-nav-item'} aria-current={active===ch.id?'true':undefined} onClick={()=>{setActive(ch.id);onChapterChange?.(ch.id)}}><span>{ch.number}</span><div><strong>{ch.title}</strong><small>{ch.english}</small></div><ArrowRight size={15}/></button>)}</aside>
      <article className="derivation"><div className="derivation-head"><div><span className="section-number">CHAPTER {chapter.number}</span><h2>{chapter.title}</h2><p>{chapter.intro}</p></div><span className="paper-pill"><BookOpen size={14}/> {chapter.pages}</span></div>
        {chapter.id==='planar'&&<CurvatureLab/>}
        {chapter.id==='rod'&&<SpatialRodLab/>}
        {chapter.steps.map((step,i)=><section className="derivation-step" key={step.title}><div className="step-index">{String(i+1).padStart(2,'0')}</div><div className="step-body"><h3>{step.title.replace(/^\d+\. /,'')}</h3><p>{step.text}</p>{step.formula&&<MathBlock formula={step.formula}/>}</div></section>)}
        {chapter.caveat&&<div className="theory-caveat"><Info size={16}/><span>{chapter.caveat}</span></div>}
        <div className="derivation-footer"><div><strong>把公式带进实验</strong><p>在交互视图中观察这些几何量如何变化。</p></div><button className="button button-dark" onClick={onCase}>返回实验台 <ArrowRight size={16}/></button></div>
      </article></div>
  </div>
}
