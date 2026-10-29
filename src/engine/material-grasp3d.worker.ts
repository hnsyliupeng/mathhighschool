import {MaterialGrasp3D,type DynamicFrame,type GraspParams} from './material-grasp3d'

type Command={type:'start';params:GraspParams}|{type:'pause'}|{type:'resume'}
const worker=self as unknown as {onmessage:((event:MessageEvent<Command>)=>void)|null;postMessage:(value:unknown)=>void}
let paused=false,running=false
const yieldThread=()=>new Promise<void>(resolve=>setTimeout(resolve,0))
worker.onmessage=(event:MessageEvent<Command>)=>{
  if(event.data.type==='pause'){paused=true;return}
  if(event.data.type==='resume'){paused=false;return}
  if(running)return
  running=true;const params=event.data.params
  void (async()=>{
    try{
      const sim=new MaterialGrasp3D(params)
      while(sim.time<params.duration-1e-10){
        if(paused){await new Promise(resolve=>setTimeout(resolve,30));continue}
        const frames:DynamicFrame[]=[]
        for(let i=0;i<8&&sim.time<params.duration-1e-10;i++){
          const frame=sim.step()
          if(!frame.finite){if(frames.length)worker.postMessage({type:'frames',frames});worker.postMessage({type:'failed',message:frame.message,attempted:frame.attempted});return}
          frames.push(frame)
        }
        if(frames.length)worker.postMessage({type:'frames',frames})
        await yieldThread()
      }
      worker.postMessage({type:'complete'})
    }catch(error){worker.postMessage({type:'failed',message:error instanceof Error?error.message:String(error)})}
    finally{running=false}
  })()
}
