import {useState} from 'react'
import {ArrowRight,ArrowUpRight,Info,Search} from 'lucide-react'
import {cases,groups,type CaseDefinition,type CaseGroup} from '../data/cases'
import {CaseArt} from './CaseArt'
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
