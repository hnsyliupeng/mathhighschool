import {useCallback,useEffect,useRef,useState} from 'react'
import {FINGERS} from './bionic-hand3d'
import {ObjectHand3D,type ObjectHandFrame} from './object-hand3d'
import {createGraspObject,type ObjectPresetId} from './object-presets3d'
import type {Mesh3D} from './gripper3d'
type Reply={type:'ready';mesh:Mesh3D;frame:ObjectHandFrame}|{type:'step';frame:ObjectHandFrame}|{type:'error';message:string}

/** Playback only shows accepted frames. Target edits apply on a new revision;
 * a failed group increment leaves all five bodies at the preceding frame. */
export function useObjectHand3D(targets:number[],id:ObjectPresetId,scale:number,revision:number){
  const [mesh,setMesh]=useState<Mesh3D|null>(null),[history,setHistory]=useState<ObjectHandFrame[]>([]),[cursor,setCursor]=useState(0),[readyRevision,setReadyRevision]=useState(-1)
  const [playing,setPlaying]=useState(true),[busy,setBusy]=useState(true),[error,setError]=useState(''),[complete,setComplete]=useState(false),[backend,setBackend]=useState<'worker'|'main'|'loading'>('loading')
  const historyRef=useRef<ObjectHandFrame[]>([]),cursorRef=useRef(0),playingRef=useRef(true),busyRef=useRef(true),errorRef=useRef(''),completeRef=useRef(false),sendRef=useRef<((targets:number[])=>void)|null>(null)
  const show=(i:number)=>{cursorRef.current=i;setCursor(i)}
  const requestNext=useCallback(()=>{
    if(busyRef.current)return
    const frames=historyRef.current;if(!frames.length)return
    if(cursorRef.current<frames.length-1){show(cursorRef.current+1);return}
    if(errorRef.current){playingRef.current=false;setPlaying(false);return}
    if(completeRef.current){playingRef.current=false;setPlaying(false);return}
    const current=frames[frames.length-1]
    const next=targets.map((target,i)=>{
      const pull=current.fingers[i].local.pull*FINGERS[i].scale,step=.00025*FINGERS[i].scale
      return Math.max(pull-step,Math.min(pull+step,target))
    })
    busyRef.current=true;setBusy(true);sendRef.current?.(next)
  },[revision])
  useEffect(()=>{
    let closed=false,worker:Worker|null=null,fallback:ObjectHand3D|null=null
    historyRef.current=[];cursorRef.current=0;playingRef.current=true;busyRef.current=true;errorRef.current='';completeRef.current=false
    setMesh(null);setHistory([]);setCursor(0);setPlaying(true);setBusy(true);setError('');setComplete(false);setBackend('loading')
    const receive=(reply:Reply)=>{
      if(closed)return
      busyRef.current=false;setBusy(false)
      if(reply.type==='error'){
        errorRef.current=reply.message;setError(reply.message);setReadyRevision(revision);playingRef.current=false;setPlaying(false);return
      }
      if(reply.type==='ready'){
        setMesh(reply.mesh);historyRef.current=[reply.frame];setHistory([reply.frame]);setReadyRevision(revision);show(0)
        if(targets.every(v=>v===0)){completeRef.current=true;setComplete(true);playingRef.current=false;setPlaying(false)}
        return
      }
      if(!reply.frame.converged){errorRef.current=reply.frame.message||'五指求解未收敛，已回滚。';setError(errorRef.current);playingRef.current=false;setPlaying(false);return}
      const next=[...historyRef.current,reply.frame];historyRef.current=next;setHistory(next);show(next.length-1)
      if(targets.every((v,i)=>Math.abs(reply.frame.fingers[i].local.pull*FINGERS[i].scale-v)<1e-12)){
        completeRef.current=true;setComplete(true);playingRef.current=false;setPlaying(false)
      }
    }
    const fallbackStart=()=>{
      worker?.terminate();worker=null
      try{
        fallback=new ObjectHand3D(createGraspObject(id,scale));setBackend('main');receive({type:'ready',mesh:fallback.mesh,frame:fallback.last})
        sendRef.current=next=>setTimeout(()=>{if(!closed&&fallback){try{receive({type:'step',frame:fallback.step(next)})}catch(e){receive({type:'error',message:String(e)})}}},0)
      }catch(e){receive({type:'error',message:String(e)})}
    }
    try{
      if(typeof Worker==='undefined')throw Error('Worker unavailable')
      worker=new Worker(new URL('./object-hand3d.worker.ts',import.meta.url),{type:'module'})
      worker.onmessage=e=>receive(e.data as Reply)
      worker.onerror=e=>{if(!historyRef.current.length)fallbackStart();else receive({type:'error',message:`工作线程失败：${e.message}`})}
      sendRef.current=next=>worker?.postMessage({type:'step',targets:next});setBackend('worker');worker.postMessage({type:'init',id,scale})
    }catch{fallbackStart()}
    const timer=window.setInterval(()=>{if(playingRef.current)requestNext()},180)
    return ()=>{closed=true;clearInterval(timer);worker?.terminate();sendRef.current=null}
  },[revision])
  const toggle=useCallback(()=>{
    if(!historyRef.current.length||(errorRef.current&&historyRef.current.length<2))return
    if(!playingRef.current&&cursorRef.current===historyRef.current.length-1&&(completeRef.current||!!errorRef.current))show(0)
    playingRef.current=!playingRef.current;setPlaying(playingRef.current)
  },[])
  const step=useCallback(()=>{playingRef.current=false;setPlaying(false);requestNext()},[requestNext])
  const seek=useCallback((index:number)=>{if(!historyRef.current.length)return;playingRef.current=false;setPlaying(false);show(Math.max(0,Math.min(historyRef.current.length-1,index)))},[])
  // Never render an old equilibrium with a newly selected shape, even for
  // the render before the reset effect/worker initialization finishes.
  const current=readyRevision===revision
  return {mesh:current?mesh:null,history:current?history:[],cursor:current?cursor:0,frame:current?(history[cursor]??null):null,playing,busy:current?busy:true,error:current?error:'',complete:current?complete:false,backend,toggle,step,seek}
}
