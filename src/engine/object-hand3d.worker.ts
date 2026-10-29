import {ObjectHand3D} from './object-hand3d'
import {createGraspObject,type ObjectPresetId} from './object-presets3d'
let solver:ObjectHand3D|null=null
const worker=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(value:unknown)=>void}
worker.onmessage=(event:MessageEvent<{type:'init';id:ObjectPresetId;scale:number}|{type:'step';targets:number[]}>)=>{
  try{
    if(event.data.type==='init'){
      solver=new ObjectHand3D(createGraspObject(event.data.id,event.data.scale));worker.postMessage({type:'ready',mesh:solver.mesh,frame:solver.last})
    }else{
      if(!solver)throw Error('多物体五指求解器未初始化')
      worker.postMessage({type:'step',frame:solver.step(event.data.targets)})
    }
  }catch(error){worker.postMessage({type:'error',message:error instanceof Error?error.message:String(error)})}
}
