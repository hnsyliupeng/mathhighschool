import { cases } from '../data/cases'
import jacobianReference from '../data/references/bending-jacobian-reference.json'
import shellElementReference from '../data/references/axis-shell-element-reference.json'
import { bendingElement, bendingHessian, upstreamBendingJacobian, mooneyRivlinElement, mooneyRivlinHessian, PlanarBeam, stretchElement } from './planar'
import { jsKernels,kernels } from './kernels'
import { chainMatrices } from './linear'
import { defaultsFor,Simulation } from './simulation'
import type { ReferenceCheck } from './reference'
import { magneticEdge, sourceDragEdge } from './soft-robot'
import { membraneElement } from './axisymmetric-membrane'
import { shellBendingElement,shellStretchElement } from './axisymmetric-shell'
import { netStretchElement, type NetVec3 } from './net-gravity'

export interface CheckResult { name:string; pass:boolean; skipped?:boolean; detail:string }
export interface CaseCheck { id:string; pass:boolean; detail:string }
export interface VerificationResult { checks:CheckResult[]; cases:CaseCheck[]; comparisons:ReferenceCheck[] }
const delay=()=>new Promise<void>(resolve=>setTimeout(resolve,0))
const cancelled=()=>new DOMException('验证已取消','AbortError')
const checkAbort=(signal?:AbortSignal)=>{if(signal?.aborted)throw cancelled()}
async function compareInWorker(signal?:AbortSignal):Promise<ReferenceCheck[]> {
  // Keep large reference trajectories out of the initial app bundle. The
  // fallback is loaded only when workers are unavailable or fail.
  const fallback=async()=>{checkAbort(signal);const reference=await import('./reference');checkAbort(signal);return reference.compareReferences()}
  checkAbort(signal)
  if(typeof Worker==='undefined')return fallback()
  try {
    const worker=new Worker(new URL('./reference.worker.ts',import.meta.url),{type:'module'})
    return await new Promise<ReferenceCheck[]>((resolve,reject)=>{
      let settled=false
      const finish=(error?:Error,checks?:ReferenceCheck[])=>{
        if(settled)return;settled=true;clearTimeout(timeout);signal?.removeEventListener('abort',onAbort);worker.terminate()
        if(error)reject(error);else resolve(checks!)
      }
      const onAbort=()=>finish(cancelled()),timeout=setTimeout(()=>finish(new Error('Reference worker timed out')),120000)
      worker.onmessage=event=>event.data?.error?finish(new Error(event.data.error)):Array.isArray(event.data?.checks)?finish(undefined,event.data.checks):finish(new Error('Invalid reference worker response'))
      worker.onerror=event=>finish(new Error(event.message||'Reference worker failed'))
      signal?.addEventListener('abort',onAbort,{once:true})
      if(signal?.aborted){onAbort();return}
      try{worker.postMessage({})}catch(error){finish(error instanceof Error?error:new Error(String(error)))}
    })
  } catch(error) {
    if(signal?.aborted)throw cancelled()
    // Worker-disabled browsers still run the same checks, synchronously.
    return fallback()
  }
}
const fd=(f:(x:number[])=>number,x:number[],h=1e-6)=>x.map((_,i)=>{const a=[...x],b=[...x];a[i]+=h;b[i]-=h;return (f(a)-f(b))/(2*h)})
export async function runVerification(onProgress?:(progress:number)=>void,signal?:AbortSignal):Promise<VerificationResult> {
  checkAbort(signal)
  const checks:CheckResult[]=[]
  const run=(name:string,fn:()=>{error:number;limit:number;detail:string})=>{
    try{const r=fn();checks.push({name,pass:Number.isFinite(r.error)&&r.error<r.limit,detail:r.detail})}catch(e){checks.push({name,pass:false,detail:String(e)})}
  }
  await delay()
  run('伸长单元：能量梯度',()=>{
    const q=[.1,-.2,1.3,.4],fn=(x:number[])=>stretchElement([x[0],x[1]],[x[2],x[3]],.9,12)
    const gradient=fn(q).gradient,numerical=fd(x=>fn(x).energy,q),error=Math.max(...gradient.map((v,i)=>Math.abs(v-numerical[i])))
    return {error,limit:1e-6,detail:`中心差分最大误差 ${error.toExponential(2)}（阈值 1e-6）`}
  })
  run('空间柔性网：伸长梯度与 Hessian',()=>{
    const q=[-.2,.1,.3,.9,.4,-.1],args=(x:number[])=>[x.slice(0,3),x.slice(3)] as [NetVec3,NetVec3],evaluate=(x:number[])=>netStretchElement(...args(x),.9,20)
    const local=evaluate(q),numerical=fd(x=>evaluate(x).energy,q),h=1e-6
    let error=Math.max(...local.gradient.map((v,i)=>Math.abs(v-numerical[i])))
    for(let j=0;j<6;j++){const a=[...q],b=[...q];a[j]+=h;b[j]-=h;const ga=evaluate(a).gradient,gb=evaluate(b).gradient;for(let i=0;i<6;i++)error=Math.max(error,Math.abs(local.hessian[i][j]-(ga[i]-gb[i])/(2*h)),Math.abs(local.hessian[i][j]-local.hessian[j][i]))}
    return {error,limit:1e-5,detail:`三维边能量梯度、Hessian 差分与对称性的最大误差 ${error.toExponential(2)}（阈值 1e-5）。`}
  })
  run('弯曲单元：能量梯度',()=>{
    const q=[-.4,.1,.2,.3,.8,-.15],fn=(x:number[])=>bendingElement([x[0],x[1]],[x[2],x[3]],[x[4],x[5]],.7,2.3,.05)
    const gradient=fn(q).gradient,numerical=fd(x=>fn(x).energy,q),error=Math.max(...gradient.map((v,i)=>Math.abs(v-numerical[i])))
    return {error,limit:1e-6,detail:`中心差分最大误差 ${error.toExponential(2)}（阈值 1e-6）`}
  })
  run('弯曲单元：解析 Hessian',()=>{
    const q=[-.4,.1,.2,.3,.8,-.15],points=(x:number[])=>[[x[0],x[1]],[x[2],x[3]],[x[4],x[5]]] as [[number,number],[number,number],[number,number]]
    const H=bendingHessian(...points(q),.7,2.3,.05),h=1e-6;let error=0
    for(let j=0;j<6;j++){const plus=[...q],minus=[...q];plus[j]+=h;minus[j]-=h;const gp=bendingElement(...points(plus),.7,2.3,.05).gradient,gm=bendingElement(...points(minus),.7,2.3,.05).gradient;for(let i=0;i<6;i++)error=Math.max(error,Math.abs(H[i][j]-(gp[i]-gm[i])/(2*h)),Math.abs(H[i][j]-H[j][i]))}
    return {error,limit:1e-5,detail:`与梯度中心差分及对称性比较的最大误差 ${error.toExponential(2)}（阈值 1e-5）`}
  })
  run('原脚本弯曲 Jacobian：兼容回放',()=>{
    const [a,b,c]=jacobianReference.points as [[number,number],[number,number],[number,number]]
    const source=upstreamBendingJacobian(a,b,c,jacobianReference.restVoronoi,jacobianReference.ei,jacobianReference.restBeta)
    const exact=bendingHessian(a,b,c,jacobianReference.restVoronoi,jacobianReference.ei,jacobianReference.restBeta)
    let error=0,difference=0
    for(let i=0;i<6;i++)for(let j=0;j<6;j++){error=Math.max(error,Math.abs(source[i][j]-jacobianReference.matrix[i][j]));difference=Math.max(difference,Math.abs(source[i][j]-exact[i][j]))}
    return {error,limit:1e-7,detail:`与 Octave 原单元 Jacobian 最大差异 ${error.toExponential(2)}；该矩阵与精确 Hessian 最大差异 ${difference.toExponential(2)} N/m。兼容回放不代表校正求解器与原轨迹完全相同。`}
  })
  run('超弹性索：能量梯度与 Hessian',()=>{
    const q=[.1,-.2,1.3,.4],args=(x:number[])=>[[x[0],x[1]],[x[2],x[3]]] as [[number,number],[number,number]]
    const evaluate=(x:number[])=>mooneyRivlinElement(...args(x),.9,12,3),g=evaluate(q).gradient,numerical=fd(x=>evaluate(x).energy,q)
    const H=mooneyRivlinHessian(...args(q),.9,12,3),h=1e-6;let error=Math.max(...g.map((v,i)=>Math.abs(v-numerical[i])))
    for(let j=0;j<4;j++){const plus=[...q],minus=[...q];plus[j]+=h;minus[j]-=h;const gp=evaluate(plus).gradient,gm=evaluate(minus).gradient;for(let i=0;i<4;i++)error=Math.max(error,Math.abs(H[i][j]-(gp[i]-gm[i])/(2*h)),Math.abs(H[i][j]-H[j][i]))}
    return {error,limit:1e-5,detail:`能量、梯度中心差分与对称性的最大误差 ${error.toExponential(2)}（阈值 1e-5）`}
  })
  run('轴对称壳伸长：梯度与 Hessian',()=>{
    const q=shellElementReference.points.slice(0,2).flat(),ref=shellElementReference.stretch
    const evaluate=(x:number[])=>shellStretchElement([x[0],x[1]],[x[2],x[3]],ref.l0,ref.r0,ref.ea,ref.nu)
    const local=evaluate(q),numerical=fd(x=>evaluate(x).energy,q,1e-7);let error=0,sourceError=0
    for(let j=0;j<4;j++){
      error=Math.max(error,Math.abs(local.gradient[j]-numerical[j]));sourceError=Math.max(sourceError,Math.abs(local.gradient[j]-ref.gradient[j]))
      const a=[...q],b=[...q];a[j]+=1e-7;b[j]-=1e-7;const ga=evaluate(a).gradient,gb=evaluate(b).gradient
      for(let i=0;i<4;i++){error=Math.max(error,Math.abs(local.hessian[i][j]-(ga[i]-gb[i])/2e-7));sourceError=Math.max(sourceError,Math.abs(local.hessian[i][j]-ref.hessian[i][j]))}
    }
    return {error:Math.max(error,sourceError),limit:1e-3,detail:`能量及梯度中心差分最大差 ${error.toExponential(2)}；与原 Octave 单元最大差 ${sourceError.toExponential(2)}（阈值 1e-3）。`}
  })
  run('轴对称壳弯曲：梯度与 Hessian',()=>{
    const q=shellElementReference.points.flat(),ref=shellElementReference.bend
    const evaluate=(x:number[])=>shellBendingElement([x[0],x[1]],[x[2],x[3]],[x[4],x[5]],ref.l0,ref.r0,ref.ei,ref.nu,ref.k10,ref.k20)
    const local=evaluate(q),numerical=fd(x=>evaluate(x).energy,q,1e-7);let error=0,sourceError=0
    for(let j=0;j<6;j++){
      error=Math.max(error,Math.abs(local.gradient[j]-numerical[j]));sourceError=Math.max(sourceError,Math.abs(local.gradient[j]-ref.gradient[j]))
      const a=[...q],b=[...q];a[j]+=1e-7;b[j]-=1e-7;const ga=evaluate(a).gradient,gb=evaluate(b).gradient
      for(let i=0;i<6;i++){error=Math.max(error,Math.abs(local.hessian[i][j]-(ga[i]-gb[i])/2e-7));sourceError=Math.max(sourceError,Math.abs(local.hessian[i][j]-ref.hessian[i][j]))}
    }
    return {error:Math.max(error,sourceError),limit:1e-3,detail:`曲率耦合单元中心差分最大差 ${error.toExponential(2)}；与原 Octave 单元最大差 ${sourceError.toExponential(2)}（阈值 1e-3）。`}
  })
  run('轴对称膜：能量梯度与 Hessian',()=>{
    const q=[1.3,.2,1.4,.35],evaluate=(x:number[])=>membraneElement([x[0],x[1]],[x[2],x[3]],.16,1.2,.01,100,20)
    const local=evaluate(q),numerical=fd(x=>evaluate(x).energy,q),h=1e-6
    let error=Math.max(...local.gradient.map((v,i)=>Math.abs(v-numerical[i])))
    for(let j=0;j<4;j++){const a=[...q],b=[...q];a[j]+=h;b[j]-=h;const ga=evaluate(a).gradient,gb=evaluate(b).gradient;for(let i=0;i<4;i++)error=Math.max(error,Math.abs(local.hessian[i][j]-(ga[i]-gb[i])/(2*h)))}
    return {error,limit:1e-5,detail:`膜单元与能量、梯度中心差分最大差异 ${error.toExponential(2)}（阈值 1e-5）。`}
  })
  run('磁驱边：能量梯度与力 Jacobian',()=>{
    const q=[.12,-.08,.41,.17],evaluate=(x:number[])=>magneticEdge([x[0],x[1]],[x[2],x[3]],.37,.002,[.8,.6],[120,35],[2,-1.2])
    const local=evaluate(q),numerical=fd(x=>evaluate(x).energy,q),h=1e-6
    let error=Math.max(...local.force.map((v,i)=>Math.abs(v+numerical[i])))
    for(let j=0;j<4;j++){const a=[...q],b=[...q];a[j]+=h;b[j]-=h;const fa=evaluate(a).force,fb=evaluate(b).force;for(let i=0;i<4;i++)error=Math.max(error,Math.abs(local.jacobian[i][j]-(fa[i]-fb[i])/(2*h)))}
    return {error,limit:1e-6,detail:`磁力及其 Jacobian 与中心差分最大差异 ${error.toExponential(2)}（阈值 1e-6）。`}
  })
  run('流体阻力：完整力 Jacobian',()=>{
    const q=[.02,.013,.031,.018],evaluate=(x:number[])=>sourceDragEdge([x[0],x[1]],[x[2],x[3]],[.019,.014],.01,.001)
    const local=evaluate(q),h=1e-8;let error=0
    for(let j=0;j<4;j++){const a=[...q],b=[...q];a[j]+=h;b[j]-=h;const fa=evaluate(a).force,fb=evaluate(b).force;for(let i=0;i<4;i++)error=Math.max(error,Math.abs(local.jacobian[i][j]-(fa[i]-fb[i])/(2*h)))}
    return {error,limit:1e-7,detail:`包括方向、长度及跨端点依赖的 Jacobian 与中心差分最大差异 ${error.toExponential(2)}（阈值 1e-7）；这不证明原阻力离散物理正确。`}
  })
  run('隐式 Euler：单自由度残差',()=>{
    const x=1.2,v=-.3,dt=.01,m=1,c=.1,k=10,l=1,f=.8,next=kernels().sdof_step(x,v,m,c,k,l,f,dt)
    const error=Math.abs(m*((next-x)/dt-v)/dt+c*(next-x)/dt+k*(next-l)-f)
    return {error,limit:1e-9,detail:`离散方程残差 ${error.toExponential(2)}（阈值 1e-9）`}
  })
  run('多自由度：矩阵对称性',()=>{
    const {K,C}=chainMatrices(),error=Math.max(...K.flatMap((row,i)=>row.map((x,j)=>Math.abs(x-K[j][i]))),...C.flatMap((row,i)=>row.map((x,j)=>Math.abs(x-C[j][i]))))
    return {error,limit:1e-12,detail:`K、C 最大非对称量 ${error.toExponential(2)}`}
  })
  run('小挠度悬臂梁：网格收敛',()=>{
    const err=(nodes:number)=>{const b=new PlanarBeam({nodes,length:1,young:1e6,radius:.1,density:1,gravity:0,damping:.1}),f=.001,l=new Array(b.q.length).fill(0);l[l.length-1]=-f;if(!b.solve(l).converged)throw Error('Newton 未收敛');return Math.abs(b.q.at(-1)!/(-f*(1-b.rest)**3/(3*b.ei))-1)}
    const coarse=err(20),fine=err(60)
    return {error:fine<coarse?fine:Infinity,limit:.03,detail:`20 节点相对误差 ${(100*coarse).toFixed(2)}%，60 节点 ${(100*fine).toFixed(2)}%（细网格阈值 3%）`}
  })
  if(kernels()===jsKernels) {
    checks.push({name:'Rust / JavaScript 核心一致性',pass:false,skipped:true,detail:'WASM 未加载；不能用 JS 与自身比较来声称 Rust 一致性已验证。'})
  } else run('Rust / JavaScript 核心一致性',()=>{
    const a=kernels(),b=jsKernels,error=Math.max(Math.abs(a.stretch_energy(1.2,1,8)-b.stretch_energy(1.2,1,8)),Math.abs(a.sdof_step(1,.2,1,.1,10,1,.4,.01)-b.sdof_step(1,.2,1,.1,10,1,.4,.01)))
    return {error,limit:1e-12,detail:`WASM 与 JS 后备实现的最大差异 ${error.toExponential(2)}。`}
  })
  const caseChecks:CaseCheck[]=[]
  for(let i=0;i<cases.length;i++){
    checkAbort(signal)
    const item=cases[i]
    try{
      const sim=new Simulation(item,defaultsFor(item)),before=sim.frame()
      for(let j=0;j<15;j++)sim.step(.01)
      const after=sim.frame(),finite=after.positions.flat().every(Number.isFinite),moved=after.positions.some((p,k)=>p.some((v,d)=>Math.abs(v-before.positions[k][d])>1e-9)),pass=finite&&moved&&after.converged&&Math.abs(after.time-.15)<1e-8
      caseChecks.push({id:item.id,pass,detail:pass?'初始化、15 步与有限数值检查通过':'初始化、推进或有限数值检查失败'})
    }catch(e){caseChecks.push({id:item.id,pass:false,detail:String(e)})}
    onProgress?.(Math.round((i+1)/cases.length*100));if(i%3===0)await delay()
  }
  await delay();checkAbort(signal)
  const comparisons=await compareInWorker(signal)
  checkAbort(signal)
  return {checks,cases:caseChecks,comparisons}
}
