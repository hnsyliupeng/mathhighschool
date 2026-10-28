import {TendonGripper,type GripperParams} from './gripper'

let solver:TendonGripper|null=null
const worker=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(value:unknown)=>void}
worker.onmessage=(event:MessageEvent<{type:'init';params:GripperParams}|{type:'step';target:number}>)=>{
  try{
    if(event.data.type==='init'){
      solver=new TendonGripper(event.data.params)
      worker.postMessage({type:'ready',mesh:solver.mesh,frame:solver.last})
    }else{
      if(!solver)throw Error('Solver not initialized')
      worker.postMessage({type:'step',frame:solver.step(event.data.target)})
    }
  }catch(error){worker.postMessage({type:'error',message:error instanceof Error?error.message:String(error)})}
}
