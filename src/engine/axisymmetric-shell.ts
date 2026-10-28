import {solveLinear} from './linear'
import type {NewtonResult,Vec2} from './planar'

/** Plane-stress, linear-elastic axisymmetric shell elements used by 2d_surface.
 * Reference quantities are held fixed. Both material and geometric terms are
 * included; forces are minus the returned energy gradient.
 */
export interface ShellElement {energy:number; gradient:number[]; hessian:number[][]}
export function shellStretchElement(a:Vec2,b:Vec2,l0:number,r0:number,ea:number,nu:number,withHessian=true):ShellElement {
  const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),r=(a[0]+b[0])/2
  if(l<1e-12||l0<=0||r0<=0)throw Error('Degenerate shell stretching element')
  const es=l/l0-1,et=r/r0-1,area=2*Math.PI*l0*r0,c=ea*area
  const t=[dx/l,dz/l],g1=[-t[0]/l0,-t[1]/l0,t[0]/l0,t[1]/l0],g2=[.5/r0,0,.5/r0,0]
  const energy=.5*c*(es*es+et*et+2*nu*es*et)
  const gradient=g1.map((v,i)=>c*((es+nu*et)*v+(et+nu*es)*g2[i]))
  const signs=[-1,-1,1,1]
  const hessian=withHessian?Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>{
    const d2e=signs[i]*signs[j]*((i%2===j%2?1:0)-t[i%2]*t[j%2])/(l0*l)
    return c*(g1[i]*g1[j]+g2[i]*g2[j]+nu*(g1[i]*g2[j]+g2[i]*g1[j])+(es+nu*et)*d2e)
  })):[]
  return {energy,gradient,hessian}
}

// Small second-order forward-mode differentiator for a six-coordinate bending
// element. It differentiates the geometric curvatures, not an approximate
// finite-difference stencil. The Hessian can be skipped for line-search trials.
const N=6
interface Jet {v:number; g:Float64Array; h:Float64Array}
function jet(v:number,order2:boolean,index=-1):Jet {const g=new Float64Array(N);if(index>=0)g[index]=1;return {v,g,h:new Float64Array(order2?N*N:0)}}
function add(a:Jet,b:Jet):Jet {
  const g=new Float64Array(N),h=new Float64Array(a.h.length)
  for(let i=0;i<N;i++)g[i]=a.g[i]+b.g[i]
  for(let i=0;i<h.length;i++)h[i]=a.h[i]+b.h[i]
  return {v:a.v+b.v,g,h}
}
function scale(a:Jet,b:number):Jet {
  const g=new Float64Array(N),h=new Float64Array(a.h.length)
  for(let i=0;i<N;i++)g[i]=a.g[i]*b
  for(let i=0;i<h.length;i++)h[i]=a.h[i]*b
  return {v:a.v*b,g,h}
}
function sub(a:Jet,b:Jet):Jet {return add(a,scale(b,-1))}
function mul(a:Jet,b:Jet):Jet {
  const g=new Float64Array(N),h=new Float64Array(a.h.length)
  for(let i=0;i<N;i++)g[i]=a.g[i]*b.v+a.v*b.g[i]
  if(h.length)for(let i=0;i<N;i++)for(let j=0;j<N;j++)h[i*N+j]=a.h[i*N+j]*b.v+a.v*b.h[i*N+j]+a.g[i]*b.g[j]+b.g[i]*a.g[j]
  return {v:a.v*b.v,g,h}
}
function unary(a:Jet,value:number,first:number,second:number):Jet {
  const g=new Float64Array(N),h=new Float64Array(a.h.length)
  for(let i=0;i<N;i++)g[i]=first*a.g[i]
  if(h.length)for(let i=0;i<N;i++)for(let j=0;j<N;j++)h[i*N+j]=first*a.h[i*N+j]+second*a.g[i]*a.g[j]
  return {v:value,g,h}
}
function inverse(a:Jet):Jet {if(Math.abs(a.v)<1e-14)throw Error('Degenerate shell curvature denominator');return unary(a,1/a.v,-1/(a.v*a.v),2/(a.v*a.v*a.v))}
function sqrt(a:Jet):Jet {if(a.v<1e-24)throw Error('Degenerate shell tangent');const r=Math.sqrt(a.v);return unary(a,r,.5/r,-.25/(r*r*r))}
function div(a:Jet,b:Jet):Jet {return mul(a,inverse(b))}

interface ShellCurvatures {meridian:Jet;hoop:Jet}
function curvatures(q:readonly number[],l0:number,order2:boolean):ShellCurvatures {
  if(q.length!==6||l0<=0||q[2]<=1e-12)throw Error('Degenerate axisymmetric bending element')
  const x=q.map((v,i)=>jet(v,order2,i)),one=jet(1,order2)
  const e=[sub(x[2],x[0]),sub(x[3],x[1])],f=[sub(x[4],x[2]),sub(x[5],x[3])]
  const le=sqrt(add(mul(e[0],e[0]),mul(e[1],e[1]))),lf=sqrt(add(mul(f[0],f[0]),mul(f[1],f[1])))
  const te=[div(e[0],le),div(e[1],le)],tf=[div(f[0],lf),div(f[1],lf)]
  const cross=sub(mul(te[0],tf[1]),mul(te[1],tf[0])),dot=add(mul(te[0],tf[0]),mul(te[1],tf[1]))
  const meridian=scale(div(cross,add(one,dot)),2/l0)
  const tx=scale(add(te[0],tf[0]),.5),tz=scale(add(te[1],tf[1]),.5)
  const tangentLength=sqrt(add(mul(tx,tx),mul(tz,tz)))
  const hoop=div(tz,mul(tangentLength,x[2]))
  return {meridian,hoop}
}
/** Reference curvatures are supplied explicitly so stress-free curved shells are supported. */
export function shellBendingElement(a:Vec2,b:Vec2,c:Vec2,l0:number,r0:number,ei:number,nu:number,k10:number,k20:number,withHessian=true):ShellElement {
  if(r0<=0)throw Error('Invalid reference radius')
  const {meridian,hoop}=curvatures([...a,...b,...c],l0,withHessian)
  const k1=meridian.v-k10,k2=hoop.v-k20,factor=ei*2*Math.PI*l0*r0
  const energy=.5*factor*(k1*k1+k2*k2+2*nu*k1*k2)
  const gradient=Array.from({length:N},(_,i)=>factor*((k1+nu*k2)*meridian.g[i]+(k2+nu*k1)*hoop.g[i]))
  const hessian=withHessian?Array.from({length:N},(_,i)=>Array.from({length:N},(_,j)=>factor*(
    (k1+nu*k2)*meridian.h[i*N+j]+(k2+nu*k1)*hoop.h[i*N+j]+meridian.g[i]*meridian.g[j]+hoop.g[i]*hoop.g[j]+nu*(meridian.g[i]*hoop.g[j]+hoop.g[i]*meridian.g[j])
  ))):[]
  return {energy,gradient,hessian}
}

export type AxisShellKind='inflation'|'eversion'
export interface AxisShellParams {nodes:number;stiffness:number;load:number;damping:number}
type RestEdge={length:number;radius:number}
type RestBend={length:number;radius:number;k1:number;k2:number}
function norm(values:number[]){let sum=0;for(const x of values)sum+=x*x;return Math.sqrt(sum)}

/** Open 40-vertex meridian, source 2d_surface/case_1 or case_2.
 * Both examples are quasi-static: velocity is only an extrapolated initial guess.
 * P is computed from the previous configuration, as in getFp.m. The eversion
 * applies prescribed displacement to the first two vertices.
 */
export class AxisymmetricShell {
  readonly n:number;readonly kind:AxisShellKind;readonly params:AxisShellParams;readonly restEdges:RestEdge[]=[];readonly restBends:RestBend[]=[]
  readonly initial:number[];readonly freeDofs:number[];readonly ea:number;readonly ei:number;readonly nu=.5;readonly referenceCompatibility:boolean
  q:number[];v:number[];time=0;last:NewtonResult={converged:true,iterations:0,residual:0};reaction=0;branchSwitches=0
  constructor(kind:AxisShellKind,params:AxisShellParams,referenceCompatibility=false){
    this.kind=kind;this.params={...params};this.referenceCompatibility=referenceCompatibility;this.n=params.nodes
    if(!Number.isInteger(this.n)||this.n<6)throw Error('Shell needs at least six meridian nodes')
    this.q=Array.from({length:this.n},(_,i):Vec2=>{
      const s=i/(this.n-1)
      if(kind==='inflation')return [.0001+(1-.0001)*s,0]
      const theta=.0001+(Math.PI/2-.8-.0001)*s
      return [Math.sin(theta),Math.cos(theta)]
    }).flat()
    this.initial=[...this.q];this.v=new Array(2*this.n).fill(0)
    const h=.02,E=params.stiffness*1e6
    this.ea=E*h/(1-this.nu*this.nu);this.ei=E*h*h*h/(12*(1-this.nu*this.nu))
    for(let i=0;i<this.n-1;i++){
      const ax=this.q[2*i],az=this.q[2*i+1],bx=this.q[2*i+2],bz=this.q[2*i+3]
      this.restEdges.push({length:Math.hypot(bx-ax,bz-az),radius:(ax+bx)/2})
    }
    for(let i=1;i<this.n-1;i++){
      const length=(this.restEdges[i-1].length+this.restEdges[i].length)/2,radius=this.q[2*i]
      const k=curvatures(this.q.slice(2*i-2,2*i+4),length,false)
      this.restBends.push({length,radius,k1:k.meridian.v,k2:k.hoop.v})
    }
    const constrained=kind==='inflation'?[0,2*this.n-2,2*this.n-1]:[0,1,2,3,2*this.n-1]
    const fixed=new Set(constrained);this.freeDofs=Array.from({length:2*this.n},(_,i)=>i).filter(i=>!fixed.has(i))
  }
  /** Internal potential, gradient and exact Hessian assembled by shared nodes. */
  assemble(q:number[],withHessian:boolean){
    const nd=2*this.n,gradient=new Array<number>(nd).fill(0),H=withHessian?Array.from({length:nd},()=>new Array<number>(nd).fill(0)):[]
    let energy=0
    const vertex=(i:number):Vec2=>[q[2*i],q[2*i+1]]
    const accumulate=(ids:number[],element:ShellElement)=>{
      energy+=element.energy
      for(let a=0;a<ids.length;a++){gradient[ids[a]]+=element.gradient[a];if(withHessian)for(let b=0;b<ids.length;b++)H[ids[a]][ids[b]]+=element.hessian[a][b]}
    }
    for(let i=0;i<this.n-1;i++){
      const ref=this.restEdges[i]
      accumulate([2*i,2*i+1,2*i+2,2*i+3],shellStretchElement(vertex(i),vertex(i+1),ref.length,ref.radius,this.ea,this.nu,withHessian))
    }
    for(let i=1;i<this.n-1;i++){
      const ref=this.restBends[i-1]
      accumulate([2*i-2,2*i-1,2*i,2*i+1,2*i+2,2*i+3],shellBendingElement(vertex(i-1),vertex(i),vertex(i+1),ref.length,ref.radius,this.ei,this.nu,ref.k1,ref.k2,withHessian))
    }
    return {energy,gradient,H}
  }
  energy(){return this.assemble(this.q,false).energy}
  /** Current maximum absolute engineering strain along meridian edges.
   * This is not a full 2D strain/stress measure or a material validity test.
   */
  maxMeridionalStrain(){
    let max=0
    for(let i=0;i<this.n-1;i++){
      const length=Math.hypot(this.q[2*i+2]-this.q[2*i],this.q[2*i+3]-this.q[2*i+1])
      max=Math.max(max,Math.abs(length/this.restEdges[i].length-1))
    }
    return max
  }
  private pressureLoad(q:number[],pressure:number){
    const force=new Array<number>(2*this.n).fill(0)
    for(let i=0;i<this.n-1;i++){
      const dx=q[2*i+2]-q[2*i],dz=q[2*i+3]-q[2*i+1],factor=Math.PI*(q[2*i]+q[2*i+2])*pressure/2
      force[2*i]+=-dz*factor;force[2*i+2]+=-dz*factor
      force[2*i+1]+=dx*factor;force[2*i+3]+=dx*factor
    }
    return force
  }
  step(dt:number):NewtonResult {
    if(!(dt>0))throw Error('Invalid time step')
    const old=[...this.q],oldV=[...this.v],free=this.freeDofs
    const force=this.kind==='inflation'?this.pressureLoad(old,10000*(this.time+dt)*this.params.load):new Array<number>(old.length).fill(0)
    let trial=old.map((x,i)=>x+(free.includes(i)?dt*oldV[i]:0))
    if(this.kind==='eversion'){trial[1]=old[1]-.1*dt*this.params.load;trial[3]=old[3]-.1*dt*this.params.load}
    const residual=(q:number[],withHessian:boolean)=>{
      const assembled=this.assemble(q,withHessian),r=free.map(i=>assembled.gradient[i]-force[i])
      const J=withHessian?free.map(i=>free.map(j=>assembled.H[i][j])):[]
      return {r,J,gradient:assembled.gradient}
    }
    let converged=false,accepted=false,reachedLimit=false,preUpdateResidual=Infinity,iterations=0,error=Infinity,reaction=0
    try{
      if(this.referenceCompatibility){
        for(let it=0;it<11;it++){
          const {r,J,gradient}=residual(trial,true);preUpdateResidual=norm(r);iterations=it+1
          // The upstream objfun records the reaction before its final update.
          reaction=-(gradient[1]+gradient[3])
          const delta=solveLinear(J,r.map(x=>-x));free.forEach((index,j)=>trial[index]+=delta[j])
          reachedLimit=it===10;if(preUpdateResidual<=1e-4)break
        }
        error=norm(residual(trial,false).r);accepted=Number.isFinite(error);converged=accepted&&preUpdateResidual<=1e-4
      }else{
        // Tighter than the source when attainable, with rollback on failure.
        const tolerance=1e-5,initial=[...trial]
        const solve=(start:number[])=>{
          let current=[...start],currentError=Infinity,currentIterations=0
          for(let it=0;it<35;it++){
            const {r,J}=residual(current,true);currentError=norm(r);currentIterations=it
            if(currentError<tolerance)break
            const delta=solveLinear(J,r.map(x=>-x));let alpha=1,candidate=[...current],nextError=Infinity
            for(let line=0;line<18;line++){
              candidate=[...current];free.forEach((index,j)=>candidate[index]+=alpha*delta[j])
              try{nextError=norm(residual(candidate,false).r)}catch{nextError=Infinity}
              if(Number.isFinite(nextError)&&nextError<currentError)break
              alpha*=.5
            }
            if(!Number.isFinite(nextError)||nextError>=currentError)break
            current=candidate;currentIterations=it+1
          }
          const last=residual(current,false),res=norm(last.r)
          return {q:current,res,iterations:currentIterations,reaction:-(last.gradient[1]+last.gradient[3])}
        }
        let solution=solve(initial)
        if(solution.res>=tolerance&&this.kind==='eversion'&&this.params.load>0){
          // At a displacement-controlled limit point, the old branch can stop
          // existing. Try an explicitly labelled, smooth lower-branch seed;
          // accept it only after the full static residual is converged. This is
          // a branch-selection heuristic, not a dynamic snap-through simulation.
          const seed=[...initial],amplitude=.15*this.initial[2*this.n-2]/.696706709347165
          for(let i=2;i<this.n-1;i++)seed[2*i+1]-=amplitude*Math.sin(Math.PI*(i-1)/(this.n-2))
          const alternate=solve(seed)
          if(alternate.res<tolerance){solution=alternate;this.branchSwitches++}
        }
        trial=solution.q;error=solution.res;iterations=solution.iterations;reaction=solution.reaction;converged=error<tolerance
      }
    }catch{converged=false;accepted=false}
    if(converged||accepted){this.q=trial;this.v=trial.map((x,i)=>(x-old[i])/dt);this.time+=dt;this.reaction=reaction}
    return this.last={converged,iterations,residual:error,...(this.referenceCompatibility?{accepted,reachedLimit,preUpdateResidual}:{})}
  }
}
