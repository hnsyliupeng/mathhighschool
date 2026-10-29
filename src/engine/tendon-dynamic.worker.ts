import manifoldUrl from '../data/tendon-grasp-manifold.json?url'
import {TendonDynamicGrasp,CompiledTendonManifold,type FingerManifold,type TendonDynamicFrame,type TendonDynamicParams} from './tendon-dynamic-grasp'
import {summarizeCompleteTendonDynamic} from './tendon-dynamic-certification'

type Command={type:'initialize';params:TendonDynamicParams}|{type:'start'}|{type:'pause'}
const worker=self as unknown as {onmessage:((event:MessageEvent<Command>)=>void)|null;postMessage:(value:unknown)=>void}
let sim:TendonDynamicGrasp|null=null,history:TendonDynamicFrame[]=[],running=false,paused=true,load:Promise<FingerManifold>|null=null
const delay=(ms=0)=>new Promise<void>(resolve=>setTimeout(resolve,ms))
worker.onmessage=(event:MessageEvent<Command>)=>{
  if(event.data.type==='pause'){paused=true;return}
  if(event.data.type==='start'){
    if(!sim)return
    if(running){paused=false;return}
    paused=false;running=true
    void (async()=>{
      try{
        let steps=0,batch:TendonDynamicFrame[]=[]
        while(sim&&sim.time<sim.params.duration-1e-10){
          if(paused){await delay(40);continue}
          const frame=sim.step()
          if(!frame.finite){if(batch.length)worker.postMessage({type:'frames',frames:batch});worker.postMessage({type:'failed',message:frame.message,attempted:frame.attempted,summary:summarizeCompleteTendonDynamic(history,sim.params)});return}
          history.push(frame);steps++
          if(steps%4===0||sim.time>=sim.params.duration-1e-10)batch.push(frame)
          if(steps%4===0||sim.time>=sim.params.duration-1e-10){worker.postMessage({type:'frames',frames:batch});batch=[]}
          await delay()
        }
        worker.postMessage({type:'complete',summary:summarizeCompleteTendonDynamic(history,sim.params)})
      }catch(error){worker.postMessage({type:'failed',message:error instanceof Error?error.message:String(error)})}
      finally{running=false}
    })();return
  }
  if(running)return
  const params=event.data.params
  void (async()=>{
    try{
      load??=fetch(manifoldUrl).then(async response=>{if(!response.ok)throw Error(`无法下载 Q1 腱驱参考数据 (${response.status})`);return await response.json() as FingerManifold})
      const data=await load,compiled=new CompiledTendonManifold(data);sim=new TendonDynamicGrasp(data,params,compiled);history=[sim.last];paused=true
      worker.postMessage({type:'ready',mesh:sim.mesh,fingerMesh:data.mesh,fixtureNodes:sim.fixtureNodes,frame:sim.last,reference:{sourceHash:data.sourceHash,frames:data.frames.length,maxPull:compiled.maxPull,lastAngle:data.frames.at(-1)?.tipAngleDeg,maxTendonPenetration:Math.max(...data.frames.map(x=>x.maxPenetration)),minInterpolationJ:Math.min(...data.frames.map(x=>x.interpolationMinPathJ))}})
    }catch(error){worker.postMessage({type:'failed',message:error instanceof Error?error.message:String(error)})}
  })()
}
