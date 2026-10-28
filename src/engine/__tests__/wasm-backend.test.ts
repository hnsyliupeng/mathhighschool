import {afterEach,describe,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {jsKernels,kernels,loadRustKernels,type Kernels} from '../kernels'

const wasm=readFileSync('public/ddg_core.wasm')
const response=(bytes:Uint8Array)=>({ok:true,arrayBuffer:async()=>bytes}) as unknown as Response
const close=(a:number,b:number)=>{
  if(Number.isNaN(a)||Number.isNaN(b)){expect(Number.isNaN(a)&&Number.isNaN(b)).toBe(true);return}
  if(!Number.isFinite(a)||!Number.isFinite(b)){expect(a).toBe(b);return}
  expect(Math.abs(a-b)).toBeLessThanOrEqual(1e-11*Math.max(1,Math.abs(a),Math.abs(b)))
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()})

describe('Rust WASM and JavaScript backend contract',()=>{
  it('matches all four exported kernels over deterministic physical inputs and boundaries',async()=>{
    const {instance}=await WebAssembly.instantiate(wasm,{})
    const rust=instance.exports as unknown as Kernels
    let seed=0x9273a5d1
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32}
    for(let i=0;i<1000;i++){
      const length=.05+2*random(),rest=.05+2*random(),ea=.01+1000*random()
      close(rust.stretch_energy(length,rest,ea),jsKernels.stretch_energy(length,rest,ea))
      close(rust.stretch_dedl(length,rest,ea),jsKernels.stretch_dedl(length,rest,ea))
      const x=2*random()-1,v=2*random()-1,m=.01+10*random(),c=5*random(),k=100*random(),l0=random(),f=20*random()-10,dt=.001+.099*random()
      const a=rust.sdof_step(x,v,m,c,k,l0,f,dt),b=jsKernels.sdof_step(x,v,m,c,k,l0,f,dt)
      close(a,b)
      const residual=m*((a-x)/dt-v)/dt+c*(a-x)/dt+k*(a-l0)-f
      expect(Math.abs(residual)).toBeLessThan(2e-8)
      const theta=(random()-.5)*2.8,ct=Math.cos(theta),st=Math.sin(theta)
      close(rust.turning_curvature(1,0,ct,st),jsKernels.turning_curvature(1,0,ct,st))
    }
    for(const rest of [0,-1,NaN]){
      close(rust.stretch_energy(1,rest,8),jsKernels.stretch_energy(1,rest,8))
      close(rust.stretch_dedl(1,rest,8),jsKernels.stretch_dedl(1,rest,8))
    }
    for(const [ax,ay,bx,by] of [[0,0,1,0],[1,0,-1,0]] as const)close(rust.turning_curvature(ax,ay,bx,by),jsKernels.turning_curvature(ax,ay,bx,by))
  })
  it('reverts to JavaScript if a later WASM module is missing required exports',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(wasm)).mockResolvedValueOnce(response(Uint8Array.from([0,97,115,109,1,0,0,0]))))
    expect(await loadRustKernels()).toBe(true);expect(kernels()).not.toBe(jsKernels)
    expect(await loadRustKernels()).toBe(false);expect(kernels()).toBe(jsKernels)
    vi.unstubAllGlobals()
  })
  it('rejects exports that exist but are not callable functions',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(wasm)))
    vi.spyOn(WebAssembly,'instantiate').mockResolvedValueOnce({instance:{exports:{...jsKernels,sdof_step:42}},module:{}} as never)
    expect(await loadRustKernels()).toBe(false);expect(kernels()).toBe(jsKernels)
    vi.unstubAllGlobals()
  })
})
