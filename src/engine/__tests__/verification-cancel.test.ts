import {afterEach,describe,expect,it,vi} from 'vitest'
import {runVerification} from '../verification'

describe('verification cancellation',()=>{
  afterEach(()=>vi.unstubAllGlobals())
  it('rejects immediately when already cancelled',async()=>{
    const c=new AbortController();c.abort()
    await expect(runVerification(undefined,c.signal)).rejects.toMatchObject({name:'AbortError'})
  })
  it('stops between case checks and does not start the reference worker',async()=>{
    const c=new AbortController(),progress:number[]=[]
    await expect(runVerification(value=>{progress.push(value);c.abort()},c.signal)).rejects.toMatchObject({name:'AbortError'})
    expect(progress).toHaveLength(1)
  },30000)
  it('terminates an in-flight reference worker without launching fallback',async()=>{
    const c=new AbortController(),terminated=vi.fn()
    class PendingWorker {onmessage:unknown;onerror:unknown;postMessage(){queueMicrotask(()=>c.abort())}terminate(){terminated()}}
    vi.stubGlobal('Worker',PendingWorker)
    await expect(runVerification(undefined,c.signal)).rejects.toMatchObject({name:'AbortError'})
    expect(terminated).toHaveBeenCalledTimes(1)
  },30000)
})
