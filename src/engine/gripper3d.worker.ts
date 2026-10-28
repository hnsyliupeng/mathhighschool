import {TendonGripper3D,type Gripper3DParams} from './gripper3d'

let solver:TendonGripper3D|null=null
const worker=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(value:unknown)=>void}
worker.onmessage=(event:MessageEvent<{type:'init';params:Gripper3DParams}|{type:'step';target:number}>)=>{
  try{
    if(event.data.type==='init'){
      solver=new TendonGripper3D(event.data.params)
      worker.postMessage({type:'ready',mesh:solver.mesh,frame:solver.last})
    }else{
      if(!solver)throw Error('3D solver not initialized')
      worker.postMessage({type:'step',frame:solver.step(event.data.target)})
    }
  }catch(error){worker.postMessage({type:'error',message:error instanceof Error?error.message:String(error)})}
}
