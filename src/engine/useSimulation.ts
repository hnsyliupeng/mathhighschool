import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CaseDefinition } from '../data/cases'
import { Simulation, type Frame, type LoadCurveValue, type SimulationParams, type Snapshot } from './simulation'

export interface Sample { time:number; displacement:number; energy:number|null; loadCurve?:LoadCurveValue; snapshot:Snapshot }

export function useSimulation(item:CaseDefinition, params:SimulationParams, revision:number) {
  const duration=item.duration??10
  const instance=useMemo(()=>new Simulation(item,params),[item.id,revision])
  const simRef=useRef(instance)
  const frameRef=useRef<Frame>(undefined!)
  if (!frameRef.current || simRef.current!==instance) {
    simRef.current=instance
    frameRef.current=instance.frame()
  }
  const [frame,setFrame]=useState<Frame>(frameRef.current)
  const [playing,setPlaying]=useState(true)
  const playingRef=useRef(true)
  const [speed,setSpeed]=useState(1)
  const speedRef=useRef(1)
  // Taking solver snapshots can be expensive; initialize only when the solver
  // instance changes, not on every unrelated React render while paused.
  const initial=useMemo<Sample>(()=>({time:0,displacement:frameRef.current.displacement,energy:frameRef.current.energy,loadCurve:frameRef.current.loadCurve,snapshot:instance.snapshot()}),[instance])
  const historyRef=useRef<Sample[]>([initial])
  const [history,setHistory]=useState<Sample[]>([initial])
  const cursorRef=useRef(0)
  const [cursor,setCursor]=useState(0)
  const toggle=useCallback(()=>{
    // The displayed button can lag one React render behind a completed step.
    // Never resume a completed/failed run from that stale visual state.
    if(!playingRef.current&&(frameRef.current.time>=duration-1e-9||!frameRef.current.converged))return
    const next=!playingRef.current
    playingRef.current=next;setPlaying(next)
    setFrame({...frameRef.current})
  },[duration])
  useEffect(()=>{playingRef.current=playing},[playing])
  useEffect(()=>{speedRef.current=speed},[speed])
  useEffect(()=>{
    const simulation=instance
    const first=simulation.frame();frameRef.current=first;setFrame(first)
    const firstSample={time:0,displacement:first.displacement,energy:first.energy,loadCurve:first.loadCurve,snapshot:simulation.snapshot()}
    historyRef.current=[firstSample];cursorRef.current=0;setHistory([firstSample]);setCursor(0)
    setPlaying(true);playingRef.current=true
    let last=performance.now(), lastUi=last, accumulator=0, raf=0
    let reportedFrame=frameRef.current,reportedLength=historyRef.current.length,reportedCursor=cursorRef.current
    const tick=(now:number)=>{
      const elapsed=Math.min((now-last)/1000,.06);last=now
      if(playingRef.current) {
        // Resuming after scrubbing branches the recorded trajectory at that instant.
        if(cursorRef.current<historyRef.current.length-1) historyRef.current=historyRef.current.slice(0,cursorRef.current+1)
        accumulator+=elapsed*speedRef.current
        let count=0
        while(accumulator>=.01 && count<6) {
          if(simulation.time>=duration-1e-9) {playingRef.current=false;setPlaying(false);accumulator=0;break}
          simulation.step(Math.min(.01,duration-simulation.time));accumulator-=.01;count++
          const current=simulation.frame();frameRef.current=current
          if(!current.converged) {playingRef.current=false;setPlaying(false);accumulator=0;break}
          const samples=historyRef.current
          if(current.time-samples[samples.length-1].time>=.0499 || current.time>=duration-1e-9) {
            samples.push({time:current.time,displacement:current.displacement,energy:current.energy,loadCurve:current.loadCurve,snapshot:simulation.snapshot()})
            cursorRef.current=samples.length-1
          }
          if(current.time>=duration-1e-9) {playingRef.current=false;setPlaying(false);accumulator=0;break}
        }
      }
      if(now-lastUi>100&&(reportedFrame!==frameRef.current||reportedLength!==historyRef.current.length||reportedCursor!==cursorRef.current)) {
        reportedFrame=frameRef.current;reportedLength=historyRef.current.length;reportedCursor=cursorRef.current
        setFrame({...reportedFrame});setHistory([...historyRef.current]);setCursor(reportedCursor);lastUi=now
      }
      raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(raf)
    // A parameter application increments revision; editing a draft does not reset the solver.
  },[item.id,revision])
  const seek=useCallback((index:number)=>{
    const sample=historyRef.current[Math.max(0,Math.min(index,historyRef.current.length-1))]
    if(!sample)return
    playingRef.current=false;setPlaying(false);simRef.current.restore(sample.snapshot)
    cursorRef.current=index;setCursor(index);frameRef.current=simRef.current.frame();setFrame({...frameRef.current})
  },[])
  const step=useCallback(()=>{
    playingRef.current=false;setPlaying(false)
    if(cursorRef.current<historyRef.current.length-1)historyRef.current=historyRef.current.slice(0,cursorRef.current+1)
    if(simRef.current.time>=duration-1e-9||!simRef.current.converged)return
    simRef.current.step(Math.min(.01,duration-simRef.current.time));const current=simRef.current.frame();frameRef.current=current
    // Like the continuous-play path, keep a failed trial out of response/CSV
    // history. The frame still carries the failure warning and residual.
    if(!current.converged){setHistory([...historyRef.current]);setCursor(cursorRef.current);setFrame({...current});return}
    historyRef.current.push({time:current.time,displacement:current.displacement,energy:current.energy,loadCurve:current.loadCurve,snapshot:simRef.current.snapshot()})
    cursorRef.current=historyRef.current.length-1;setCursor(cursorRef.current);setHistory([...historyRef.current]);setFrame({...current})
  },[duration])
  return {frame,frameRef,playing,toggle,setPlaying,speed,setSpeed,history,cursor,seek,step}
}
