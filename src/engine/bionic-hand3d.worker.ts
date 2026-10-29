import {BionicHand3D} from './bionic-hand3d'
let solver:BionicHand3D|null=null
const worker=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(value:unknown)=>void}
worker.onmessage=(event:MessageEvent<{type:'init'}|{type:'step';targets:number[]}>)=>{
  try{
    if(event.data.type==='init'){
      solver=new BionicHand3D();worker.postMessage({type:'ready',mesh:solver.mesh,frame:solver.last})
    }else{
      if(!solver)throw Error('五指求解器未初始化')
      worker.postMessage({type:'step',frame:solver.step(event.data.targets)})
    }
  }catch(error){worker.postMessage({type:'error',message:error instanceof Error?error.message:String(error)})}
}
