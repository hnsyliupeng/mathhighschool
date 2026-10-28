import mesh from '../data/references/net-gravity-mesh.json'
import type {NewtonResult} from './planar'
import {minres} from './minres'

export type NetVec3=[number,number,number]
export interface NetElement {energy:number;gradient:number[];hessian:number[][]}

/** 3D Hookean engineering-strain edge, exactly as rod_network/case_1. */
export function netStretchElement(a:NetVec3,b:NetVec3,rest:number,ea:number):NetElement {
  const d=b.map((x,i)=>x-a[i]),length=Math.hypot(...d)
  if(length<1e-12||rest<=0||!Number.isFinite(ea))throw Error('Degenerate net edge')
  const t=d.map(x=>x/length),f=ea*(length/rest-1)
  const block=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>ea*((1/rest-1/length)*(i===j?1:0)+t[i]*t[j]/length)))
  return {energy:ea*(length-rest)**2/(2*rest),gradient:[...t.map(x=>-f*x),...t.map(x=>f*x)],hessian:Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>block[i%3][j%3]*((i<3)===(j<3)?1:-1)))}
}

type NetEdge={a:number;b:number;rest:number}
export interface NetParams {stiffness:number;load:number;damping:number}
export interface NetStepResult extends NewtonResult {linearIterations:number;minresFallbacks:number;reason?:string}
interface Blocks {alpha:Float64Array;beta:Float64Array;tx:Float64Array;ty:Float64Array;tz:Float64Array;diag:Float64Array}
const norm=(v:Float64Array)=>Math.sqrt(v.reduce((s,x)=>s+x*x,0))

/**
 * Source network: 631 nodes, 720 straight stretching edges and six completely
 * fixed nodes. Positions are in source (x,y,z); z is vertical. Each edge has
 * EA = E*pi*r²; half its rho*A*L mass is assigned to each endpoint. No bending,
 * torsion, slack-only law or contact is present in the referenced MATLAB case.
 *
 * Newton uses the exact element tangent and the source implicit-Euler equation.
 * Matrix-free preconditioned CG replaces the source's dense backslash. If the
 * symmetric tangent is indefinite, a positive-diagonal MINRES fallback is tried.
 * Failed solves roll back instead of accepting a last iterate. No changes are
 * committed unless the nonlinear residual is sufficiently small.
 */
export class GravityNet {
  readonly n=mesh.nodes.length
  readonly initial=Float64Array.from(mesh.nodes.flat())
  readonly edges:NetEdge[]
  readonly fixedNodes=new Set<number>(mesh.fixedNodes)
  readonly mass:Float64Array
  readonly fixed:Uint8Array
  readonly ea:number
  readonly gravity:number
  readonly damping:number
  q:Float64Array;v:Float64Array;time=0
  last:NetStepResult={converged:true,iterations:0,residual:0,linearIterations:0,minresFallbacks:0}
  constructor(params:NetParams){
    if(!Number.isFinite(params.stiffness)||params.stiffness<=0||!Number.isFinite(params.load)||params.load<0||!Number.isFinite(params.damping)||params.damping<0)throw Error('Invalid net parameters')
    this.ea=params.stiffness*1e6*Math.PI*.01**2;this.gravity=params.load;this.damping=params.damping
    this.q=this.initial.slice();this.v=new Float64Array(this.q.length);this.mass=new Float64Array(this.q.length);this.fixed=new Uint8Array(this.q.length)
    for(const node of this.fixedNodes)for(let k=0;k<3;k++)this.fixed[3*node+k]=1
    this.edges=mesh.edges.map(([a,b])=>{
      const i=3*a,j=3*b,rest=Math.hypot(this.q[j]-this.q[i],this.q[j+1]-this.q[i+1],this.q[j+2]-this.q[i+2])
      if(!Number.isFinite(rest)||rest<1e-12)throw Error('Degenerate net mesh')
      const halfMass=1000*Math.PI*.01**2*rest/2
      for(let k=0;k<3;k++){this.mass[i+k]+=halfMass;this.mass[j+k]+=halfMass}
      return {a,b,rest}
    })
    if(this.mass.some(m=>!(m>0)))throw Error('A net node has no mass')
  }
  /** Returns internal energy and residual, plus blocks when a tangent is needed. */
  private assemble(q:Float64Array,old:Float64Array,velocity:Float64Array,dt:number,withBlocks:boolean){
    const nd=q.length,ne=this.edges.length,r=new Float64Array(nd),massFactor=1/(dt*dt)+this.damping/dt
    const blocks:Blocks|undefined=withBlocks?{alpha:new Float64Array(ne),beta:new Float64Array(ne),tx:new Float64Array(ne),ty:new Float64Array(ne),tz:new Float64Array(ne),diag:new Float64Array(nd)}:undefined
    for(let j=0;j<nd;j++){
      if(this.fixed[j])continue
      r[j]=this.mass[j]*((q[j]-old[j]-dt*velocity[j])/(dt*dt)+this.damping*(q[j]-old[j])/dt+(j%3===2?this.gravity:0))
      if(blocks)blocks.diag[j]=this.mass[j]*massFactor
    }
    let energy=0
    for(let e=0;e<ne;e++){
      const {a,b,rest}=this.edges[e],i=3*a,j=3*b,dx=q[j]-q[i],dy=q[j+1]-q[i+1],dz=q[j+2]-q[i+2],l=Math.hypot(dx,dy,dz)
      if(!(l>1e-12)||!Number.isFinite(l))throw Error('Degenerate net edge')
      const tx=dx/l,ty=dy/l,tz=dz/l,f=this.ea*(l/rest-1),fx=f*tx,fy=f*ty,fz=f*tz
      energy+=this.ea*(l-rest)**2/(2*rest)
      if(!this.fixed[i]){r[i]-=fx;r[i+1]-=fy;r[i+2]-=fz}
      if(!this.fixed[j]){r[j]+=fx;r[j+1]+=fy;r[j+2]+=fz}
      if(blocks){
        const alpha=this.ea*(1/rest-1/l),beta=this.ea/l
        blocks.alpha[e]=alpha;blocks.beta[e]=beta;blocks.tx[e]=tx;blocks.ty[e]=ty;blocks.tz[e]=tz
        const b0=alpha+beta*tx*tx,b1=alpha+beta*ty*ty,b2=alpha+beta*tz*tz
        if(!this.fixed[i]){blocks.diag[i]+=b0;blocks.diag[i+1]+=b1;blocks.diag[i+2]+=b2}
        if(!this.fixed[j]){blocks.diag[j]+=b0;blocks.diag[j+1]+=b1;blocks.diag[j+2]+=b2}
      }
    }
    return {energy,r,blocks,massFactor}
  }
  private multiply(v:Float64Array,blocks:Blocks,massFactor:number,out:Float64Array){
    for(let i=0;i<v.length;i++)out[i]=this.fixed[i]?0:this.mass[i]*massFactor*v[i]
    for(let e=0;e<this.edges.length;e++){
      const {a,b}=this.edges[e],i=3*a,j=3*b,dx=v[i]-v[j],dy=v[i+1]-v[j+1],dz=v[i+2]-v[j+2],tx=blocks.tx[e],ty=blocks.ty[e],tz=blocks.tz[e]
      const proj=blocks.beta[e]*(tx*dx+ty*dy+tz*dz),alpha=blocks.alpha[e],fx=alpha*dx+tx*proj,fy=alpha*dy+ty*proj,fz=alpha*dz+tz*proj
      if(!this.fixed[i]){out[i]+=fx;out[i+1]+=fy;out[i+2]+=fz}
      if(!this.fixed[j]){out[j]-=fx;out[j+1]-=fy;out[j+2]-=fz}
    }
  }
  private solvePcg(rhs:Float64Array,blocks:Blocks,massFactor:number){
    const n=rhs.length,x=new Float64Array(n),r=rhs.slice(),z=new Float64Array(n),p=new Float64Array(n),Ap=new Float64Array(n)
    const dot=(a:Float64Array,b:Float64Array)=>{let s=0;for(let i=0;i<n;i++)s+=a[i]*b[i];return s}
    const rhsNorm=norm(rhs),target=Math.max(1e-11,rhsNorm*1e-9)
    if(rhsNorm<=target)return {x,iterations:0,converged:true}
    for(let i=0;i<n;i++){
      if(this.fixed[i])continue
      if(!(blocks.diag[i]>0)||!Number.isFinite(blocks.diag[i]))return {x,iterations:0,converged:false}
      z[i]=r[i]/blocks.diag[i];p[i]=z[i]
    }
    let rz=dot(r,z)
    for(let iteration=1;iteration<=1000;iteration++){
      this.multiply(p,blocks,massFactor,Ap)
      const denom=dot(p,Ap)
      if(!(denom>0)||!Number.isFinite(denom))return {x,iterations:iteration,converged:false}
      const alpha=rz/denom
      for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*Ap[i]}
      if(norm(r)<=target)return {x,iterations:iteration,converged:true}
      for(let i=0;i<n;i++)z[i]=this.fixed[i]?0:r[i]/blocks.diag[i]
      const next=dot(r,z),beta=next/rz
      for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i]
      rz=next
    }
    return {x,iterations:1000,converged:false}
  }
  energy(){return this.assemble(this.q,this.q,this.v,.01,false).energy}
  /** Largest absolute engineering strain among edges at the current state. */
  maxEdgeStrain(){
    let maximum=0
    for(const {a,b,rest} of this.edges){
      const i=3*a,j=3*b,l=Math.hypot(this.q[j]-this.q[i],this.q[j+1]-this.q[i+1],this.q[j+2]-this.q[i+2])
      maximum=Math.max(maximum,Math.abs(l/rest-1))
    }
    return maximum
  }
  step(dt:number):NetStepResult {
    if(!(dt>0)||!Number.isFinite(dt))throw Error('Invalid net timestep')
    const old=this.q,velocity=this.v,trial=old.slice()
    for(let j=0;j<trial.length;j++)if(!this.fixed[j])trial[j]+=dt*velocity[j]
    let residual=Infinity,iterations=0,linearIterations=0,minresFallbacks=0,reason='Newton iteration limit'
    try{
      for(let iter=0;iter<20;iter++){
        const current=this.assemble(trial,old,velocity,dt,true);residual=norm(current.r);iterations=iter
        if(residual<1e-5){
          const nextV=new Float64Array(trial.length);for(let j=0;j<trial.length;j++)nextV[j]=(trial[j]-old[j])/dt
          this.q=trial;this.v=nextV;this.time+=dt
          return this.last={converged:true,iterations,residual,linearIterations,minresFallbacks}
        }
        const rhs=Float64Array.from(current.r,x=>-x),blocks=current.blocks!
        let linear:{x:Float64Array;iterations:number;converged:boolean}=this.solvePcg(rhs,blocks,current.massFactor);linearIterations+=linear.iterations
        if(!linear.converged){
          // Compression can make the exact tangent indefinite, which CG cannot
          // solve. MINRES retains the same equations and uses an SPD diagonal.
          const diag=Float64Array.from(blocks.diag,(d,i)=>this.fixed[i]?1:Math.max(Math.abs(d),this.mass[i]*current.massFactor*1e-6,1e-12))
          linear=minres(rhs,(v,out)=>this.multiply(v,blocks,current.massFactor,out),diag)
          linearIterations+=linear.iterations;minresFallbacks++
        }
        if(!linear.converged){reason='PCG and MINRES could not solve the tangent system';break}
        let alpha=1,accepted=false
        for(let search=0;search<18;search++){
          const candidate=Float64Array.from(trial,(x,j)=>x+alpha*linear.x[j])
          const candidateResidual=norm(this.assemble(candidate,old,velocity,dt,false).r)
          if(Number.isFinite(candidateResidual)&&candidateResidual<residual){trial.set(candidate);accepted=true;break}
          alpha*=.5
        }
        if(!accepted){reason='Newton line search failed';break}
      }
      residual=norm(this.assemble(trial,old,velocity,dt,false).r)
    }catch(error){reason=error instanceof Error?error.message:'Numerical failure'}
    return this.last={converged:false,iterations,residual,linearIterations,minresFallbacks,reason}
  }
}
