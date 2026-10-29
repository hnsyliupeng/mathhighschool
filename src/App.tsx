import { Component, Suspense, lazy, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Code2, Compass, Download, ExternalLink, Eye, EyeOff, FileText, FlaskConical, Github, Grid2X2, Info, Layers3, Menu, MousePointer2, Pause, Play, RotateCcw, Search, Settings2, ShieldCheck, SkipForward, Sparkles, X } from 'lucide-react'
import { getCase, type CaseDefinition } from './data/cases'
import { loadRustKernels } from './engine/kernels'
import {appLocationUrl,parseAppLocation,type Page} from './navigation'
import './styles.css'

// Heavy Three.js laboratories and theory/reference data are loaded only when
// opened, rather than forcing every visitor to download every experiment.
const Workspace=lazy(()=>import('./components/Workspace').then(m=>({default:m.Workspace})))
const LibraryPage=lazy(()=>import('./components/LibraryPage').then(m=>({default:m.LibraryPage})))
const TheoryPage=lazy(()=>import('./components/TheoryPage').then(m=>({default:m.TheoryPage})))
const ValidationPage=lazy(()=>import('./components/ValidationPage').then(m=>({default:m.ValidationPage})))
const GripperLab=lazy(()=>import('./components/GripperLab').then(m=>({default:m.GripperLab})))
const Gripper3DLab=lazy(()=>import('./components/Gripper3DLab').then(m=>({default:m.Gripper3DLab})))
const BionicHandLab=lazy(()=>import('./components/BionicHandLab').then(m=>({default:m.BionicHandLab})))
const MultiObjectLab=lazy(()=>import('./components/MultiObjectLab').then(m=>({default:m.MultiObjectLab})))
const MaterialGraspLab=lazy(()=>import('./components/MaterialGraspLab').then(m=>({default:m.MaterialGraspLab})))
const TendonDynamicLab=lazy(()=>import('./components/TendonDynamicLab').then(m=>({default:m.TendonDynamicLab})))

const pageNames:Record<Page,string>={workspace:'算例工作台',tendon3d:'腱驱五指动态抓取',materials3d:'独立指垫材质实验',objects3d:'多物体接触验证',hand3d:'三维五指仿生手',gripper3d:'三维实体孔抓手',gripper:'二维等效抓手',library:'算例库',theory:'公式推导',validation:'验证中心'}

function Logo(){return <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true"><rect x="1" y="1" width="36" height="36" rx="10" stroke="#91ab94"/><path d="M9 24.5 18.8 9 29 24.5 18.8 29 9 24.5Z" stroke="#d1e0c8" strokeWidth="1.3"/><path d="M9 24.5 18.8 20l10.2 4.5M18.8 9v11m0 0v9" stroke="#d1e0c8" strokeWidth="1.1"/><circle cx="18.8" cy="20" r="1.6" fill="#dcae72"/></svg>}

function Sidebar({page,setPage,onGuide,mobile,setMobile}:{page:Page;setPage:(p:Page)=>void;onGuide:()=>void;mobile:boolean;setMobile:(v:boolean)=>void}){
  const nav:[Page,typeof Compass,string,string?][]=[['workspace',Compass,'算例工作台'],['tendon3d',Activity,'腱驱五指动态抓取','NEW'],['materials3d',FlaskConical,'独立指垫材质实验'],['objects3d',Boxes,'多物体接触验证'],['hand3d',Layers3,'三维五指仿生手'],['gripper3d',Boxes,'三维实体孔抓手'],['gripper',Activity,'二维等效抓手'],['library',Grid2X2,'算例库','21'],['theory',BookOpen,'公式推导','08'],['validation',ShieldCheck,'验证中心']]
  return <><div className={mobile?'sidebar-backdrop open':'sidebar-backdrop'} onClick={()=>setMobile(false)}/><aside id="app-sidebar" className={mobile?'sidebar mobile-open':'sidebar'}>
    <div className="brand"><Logo/><div><strong>DDG <span>Lab</span></strong><small>离散几何实验室</small></div><button className="mobile-close icon-button" onClick={()=>setMobile(false)} aria-label="关闭导航"><X size={18}/></button></div>
    <div className="side-label">LEARN & EXPLORE</div><nav className="main-nav" aria-label="主导航">{nav.map(([id,Icon,label,count])=><button data-testid={`nav-${id}`} key={id} className={page===id?'nav-item active':'nav-item'} aria-current={page===id?'page':undefined} onClick={()=>{setPage(id);setMobile(false)}}><Icon size={18} strokeWidth={1.7}/><span>{label}</span>{count&&<small>{count}</small>}{page===id&&<i/>}</button>)}</nav>
    <div className="side-divider"/><div className="side-label">RESOURCES</div><div className="resource-nav"><a href="https://github.com/weicheng-huang-mechanics/DDG_Tutorial" target="_blank" rel="noreferrer"><Github size={17}/><span>原始代码仓库</span><ArrowUpRight size={14}/></a><a href="http://www.ddgflexsim.com/" target="_blank" rel="noreferrer"><FileText size={17}/><span>DDG 官方教程</span><ArrowUpRight size={14}/></a><button onClick={onGuide}><CircleHelp size={17}/><span>使用说明</span><ArrowUpRight size={14}/></button></div>
    <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><Sparkles size={15}/></span><div><strong>从几何开始</strong><p>一起来探索柔性结构的<br/>美妙力学。</p></div></div><div className="side-version"><span>DDG LEARNING LAB</span><span>V 1.0</span></div></div>
  </aside></>
}
function Topbar({page,onSearch,onGuide,onMobile,mobile,wasm}:{page:Page;onSearch:(q:string)=>void;onGuide:()=>void;onMobile:()=>void;mobile:boolean;wasm:boolean|null}){
  const [query,setQuery]=useState('')
  return <header className="topbar"><button className="mobile-menu icon-button" onClick={onMobile} aria-label="打开导航" aria-controls="app-sidebar" aria-expanded={mobile}><Menu size={20}/></button><div className="breadcrumbs"><span>DDG LAB</span><ChevronRight size={13}/><strong>{pageNames[page]}</strong></div><div className="topbar-right"><form className="top-search" onSubmit={e=>{e.preventDefault();onSearch(query)}}><Search size={16}/><input placeholder="搜索算例或章节" value={query} onChange={e=>setQuery(e.target.value)} aria-label="搜索算例或章节"/><kbd>↵</kbd></form><span className="top-divider"/><span className="backend-badge" title={page==='tendon3d'||page==='materials3d'||page==='objects3d'||page==='hand3d'||page==='gripper3d'||page==='gripper'?'抓手求解器使用 TypeScript，未调用 Rust/WASM':wasm?'Rust/WASM 数值核心已加载':'使用 JavaScript 后备数值核心'}><i/> {page==='tendon3d'||page==='materials3d'||page==='objects3d'||page==='hand3d'||page==='gripper3d'||page==='gripper'?'TS 求解':wasm===null?'加载核心':wasm?'WASM 就绪':'JS 核心'}</span><button className="top-help icon-button" onClick={onGuide} aria-label="使用帮助"><CircleHelp size={19}/></button><a className="github-button" href="https://github.com/weicheng-huang-mechanics/DDG_Tutorial" target="_blank" rel="noreferrer" aria-label="查看参考 GitHub 仓库"><Github size={18}/></a></div></header>
}
function Guide({onClose}:{onClose:()=>void}){
  const dialog=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null
    const root=dialog.current
    root?.querySelector<HTMLButtonElement>('button[aria-label="关闭使用说明"]')?.focus()
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();close.current();return}
      if(event.key!=='Tab'||!root)return
      const focusable=Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0)
      if(!focusable.length){event.preventDefault();return}
      const first=focusable[0],last=focusable[focusable.length-1]
      if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',onKey)
    return()=>{document.removeEventListener('keydown',onKey);previous?.focus()}
  },[])
  return <div className="modal-backdrop" onClick={onClose}><div ref={dialog} className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e=>e.stopPropagation()}><div className="guide-top"><span className="panel-icon"><BookOpen size={19}/></span><button className="icon-button" onClick={onClose} aria-label="关闭使用说明"><X size={19}/></button></div><span className="eyebrow">WELCOME TO DDG LAB</span><h2 id="guide-title">从这里开始探索。</h2><p>选择一个算例，调整参数并观察结构随时间变化；通过公式推导与验证中心理解结果的来源和适用范围。</p><div className="guide-steps"><div><span>01</span><p><strong>选择算例</strong><br/>算例库按参考教程整理为 8 个分类。</p></div><div><span>02</span><p><strong>交互探索</strong><br/>拖拽旋转视图，调整参数并应用；可暂停、单步、回看或导出。</p></div><div><span>03</span><p><strong>审慎验证</strong><br/>振子、平面梁、轴对称线弹性壳、超弹性索与膜及部分软体机器人使用数值求解；其他算例仍有教学近似。原文对照与未通过项请查看验证中心。</p></div></div><div className="guide-links"><a href="https://arxiv.org/abs/2504.11417" target="_blank" rel="noreferrer">阅读论文 <ExternalLink size={14}/></a><a href="https://github.com/weicheng-huang-mechanics/DDG_Tutorial" target="_blank" rel="noreferrer">原始代码 <ExternalLink size={14}/></a></div><button className="button button-dark guide-done" onClick={onClose}>开始探索 <ArrowRight size={16}/></button></div></div>}

class PageBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('页面加载失败',error,info)}
  render(){
    if(this.state.failed)return <section className="page-load-error" role="alert"><h1>页面暂时无法加载</h1><p>请检查网络或 WebGL 支持，然后重试；其他页面仍可从导航打开。</p><button className="button button-dark" onClick={()=>window.location.reload()}>重新加载应用</button></section>
    return this.props.children
  }
}

export default function App(){
  const initial=useRef(parseAppLocation(new URL(window.location.href)))
  const [page,setPageState]=useState<Page>(initial.current.page)
  const [item,setItem]=useState(()=>getCase(initial.current.caseId)),[chapter,setChapter]=useState(initial.current.chapter),[search,setSearch]=useState(initial.current.search),[guide,setGuide]=useState(false),[mobile,setMobile]=useState(false),[wasm,setWasm]=useState<boolean|null>(null)
  useEffect(()=>{loadRustKernels().then(setWasm)},[])
  useEffect(()=>{
    const onPop=()=>{const state=parseAppLocation(new URL(window.location.href));setPageState(state.page);setItem(getCase(state.caseId));setChapter(state.chapter);setSearch(state.search);setMobile(false)}
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)
  },[])
  useEffect(()=>{
    if(!mobile)return
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobile(false)}
    document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)
  },[mobile])
  const transition=(p:Page,options:{caseId?:string;chapter?:string;search?:string}={})=>{
    const next=appLocationUrl(new URL(window.location.href),p,{...options,...(p==='workspace'?{caseId:options.caseId||item.id}:{})})
    if(next.href!==window.location.href)window.history.pushState({},'',next)
    const state=parseAppLocation(next);setPageState(state.page);setItem(getCase(state.caseId));setChapter(state.chapter);setSearch(state.search)
    window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})
  }
  const navigate=(p:Page)=>transition(p)
  const select=(next:CaseDefinition)=>transition('workspace',{caseId:next.id})
  const openTheory=(id:string)=>transition('theory',{chapter:id})
  return <div className="app-shell"><a className="skip-link" href="#main-content">跳至主要内容</a><Sidebar page={page} setPage={navigate} onGuide={()=>setGuide(true)} mobile={mobile} setMobile={setMobile}/><div className="main-shell"><Topbar page={page} onSearch={q=>transition('library',{search:q})} onGuide={()=>setGuide(true)} onMobile={()=>setMobile(true)} mobile={mobile} wasm={wasm}/><main id="main-content" tabIndex={-1}><PageBoundary key={page}><Suspense fallback={<div className="page-loading" role="status" aria-live="polite">正在加载页面…</div>}>{page==='workspace'&&<Workspace key={item.id} item={item} onSelect={select} onLibrary={()=>navigate('library')} onTheory={openTheory} onValidation={()=>navigate('validation')}/>} {page==='tendon3d'&&<TendonDynamicLab openFullHand={()=>navigate('objects3d')} openPadBench={()=>navigate('materials3d')}/>} {page==='materials3d'&&<MaterialGraspLab openHand={()=>navigate('hand3d')} openObjects={()=>navigate('objects3d')}/>} {page==='objects3d'&&<MultiObjectLab openHand={()=>navigate('hand3d')}/>} {page==='hand3d'&&<BionicHandLab openFinger={()=>navigate('gripper3d')}/>} {page==='gripper3d'&&<Gripper3DLab open2D={()=>navigate('gripper')}/>} {page==='gripper'&&<GripperLab open3D={()=>navigate('gripper3d')}/>} {page==='library'&&<LibraryPage key={search} onSelect={select} initialSearch={search}/>} {page==='theory'&&<TheoryPage key={chapter} initialChapter={chapter} onChapterChange={openTheory} onCase={()=>navigate('workspace')}/>} {page==='validation'&&<ValidationPage onSelect={select}/>}</Suspense></PageBoundary></main></div>{guide&&<Guide onClose={()=>setGuide(false)}/>}</div>
}
