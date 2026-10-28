import { loadRustKernels } from './kernels'
import { compareReferences } from './reference'

// Run long reference replays off the UI thread; use the same WASM/JS fallback
// contract as the main application. Errors are returned rather than hidden.
const port=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void}
port.onmessage=async()=>{
  try{await loadRustKernels();port.postMessage({checks:compareReferences()})}
  catch(error){port.postMessage({error:error instanceof Error?error.message:String(error)})}
}
