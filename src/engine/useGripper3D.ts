import {useCallback,useEffect,useRef,useState} from 'react'
import type {Gripper3DParams,Mesh3D} from './gripper3d'
import {ContinuousGripper3D,type ContinuousFrame} from './continuous-gripper3d'

type Reply={type:'ready';mesh:Mesh3D;frame:ContinuousFrame}|{type:'step';frame:ContinuousFrame}|{type:'error';message:string}
/** The worker retains only the latest converged state. Recorded frames are
 * replayed without re-solving; failed trials are never appended. */
export function useGripper3D(params:Gripper3DParams,revision:number,cycle:boolean){
  const [mesh,setMesh]=useState<Mesh3D|null>(null),[history,setHistory]=useState<ContinuousFrame[]>([]),[cursor,setCursor]=useState(0)
  const [playing,setPlaying]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[complete,setComplete]=useState(false),[backend,setBackend]=useState<'worker'|'main'|'loading'>('loading')
  const historyRef=useRef<ContinuousFrame[]>([]),cursorRef=useRef(0),playingRef=useRef(true),busyRef=useRef(false),errorRef=useRef(''),completeRef=useRef(false),phaseRef=useRef<'loading'|'unloading'>('loading')
  const sendRef=useRef<((target:number)=>void)|null>(null)
  const show=(index:number)=>{cursorRef.current=index;setCursor(index)}
  const requestNext=useCallback(()=>{
    if(busyRef.current||errorRef.current)return
    const h=historyRef.current;if(!h.length)return
    if(cursorRef.current<h.length-1){show(cursorRef.current+1);return}
    const current=h[h.length-1]
    if(completeRef.current){playingRef.current=false;setPlaying(false);return}
    const target=phaseRef.current==='loading'?Math.min(params.pull,current.pull+params.step):Math.max(0,current.pull-params.step)
    busyRef.current=true;setBusy(true);sendRef.current?.(target)
  },[params.pull,params.step,revision])
  useEffect(()=>{
    let closed=false,worker:Worker|null=null,fallback:ContinuousGripper3D|null=null
    historyRef.current=[];cursorRef.current=0;busyRef.current=true;playingRef.current=true;errorRef.current='';completeRef.current=false;phaseRef.current='loading'
    setHistory([]);setCursor(0);setMesh(null);setPlaying(true);setBusy(true);setError('');setComplete(false);setBackend('loading')
    const receive=(reply:Reply)=>{
      if(closed)return
      busyRef.current=false;setBusy(false)
      if(reply.type==='error'){
        errorRef.current=reply.message;setError(reply.message);playingRef.current=false;setPlaying(false);return
      }
      if(reply.type==='ready'){
        setMesh(reply.mesh);historyRef.current=[reply.frame];cursorRef.current=0;setHistory([reply.frame]);setCursor(0);return
      }
      if(!reply.frame.converged){
        errorRef.current=reply.frame.message||'三维求解未收敛，已回滚。';setError(errorRef.current);playingRef.current=false;setPlaying(false);return
      }
      const next=[...historyRef.current,reply.frame];historyRef.current=next;cursorRef.current=next.length-1;setHistory(next);setCursor(next.length-1)
      if(phaseRef.current==='loading'&&reply.frame.pull>=params.pull-1e-12){
        if(cycle)phaseRef.current='unloading'
        else{completeRef.current=true;setComplete(true);playingRef.current=false;setPlaying(false)}
      }else if(phaseRef.current==='unloading'&&reply.frame.pull<=1e-12){completeRef.current=true;setComplete(true);playingRef.current=false;setPlaying(false)}
    }
    const setupFallback=()=>{
      worker?.terminate();worker=null
      try{
        fallback=new ContinuousGripper3D(params);setBackend('main');receive({type:'ready',mesh:fallback.mesh,frame:fallback.last})
        sendRef.current=target=>{setTimeout(()=>{if(!closed&&fallback){try{receive({type:'step',frame:fallback.step(target)})}catch(e){receive({type:'error',message:String(e)})}}},0)}
      }catch(e){receive({type:'error',message:String(e)})}
    }
    try{
      if(typeof Worker==='undefined')throw Error('Worker unavailable')
      worker=new Worker(new URL('./gripper3d.worker.ts',import.meta.url),{type:'module'})
      worker.onmessage=e=>receive(e.data as Reply)
      worker.onerror=e=>{if(!historyRef.current.length)setupFallback();else receive({type:'error',message:`工作线程失败：${e.message}`})}
      sendRef.current=target=>worker?.postMessage({type:'step',target})
      setBackend('worker');worker.postMessage({type:'init',params})
    }catch{setupFallback()}
    const timer=window.setInterval(()=>{if(playingRef.current)requestNext()},160)
    return ()=>{closed=true;clearInterval(timer);worker?.terminate();sendRef.current=null}
  },[revision])
  const toggle=useCallback(()=>{
    if(errorRef.current||!historyRef.current.length)return
    if(!playingRef.current&&cursorRef.current===historyRef.current.length-1&&completeRef.current)show(0)
    playingRef.current=!playingRef.current;setPlaying(playingRef.current)
  },[])
  const step=useCallback(()=>{playingRef.current=false;setPlaying(false);requestNext()},[requestNext])
  const seek=useCallback((index:number)=>{const n=historyRef.current.length;if(!n)return;playingRef.current=false;setPlaying(false);show(Math.max(0,Math.min(n-1,index)))},[])
  return {mesh,history,cursor,frame:history[cursor]??null,playing,busy,error,complete,backend,toggle,step,seek}
}
