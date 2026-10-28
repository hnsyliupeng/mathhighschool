import { PlanarBeam, type NewtonResult, type Vec2 } from './planar'

export type PrescribedBeamKind='buckling'|'snap'
export interface PrescribedBeamParams { nodes:number; stiffness:number; load:number; damping:number }
export interface PrescribedBeamState { compression:number; acceleration:number }

/**
 * 2d_curve/case_2 (quasi-static) and case_3 (implicit dynamics).
 * Both ends clamp two vertices. Coordinates are rounded as in the upstream
 * input files; the default 40-node mesh therefore matches those files.
 */
export class PrescribedBeam {
  readonly beam:PlanarBeam
  readonly kind:PrescribedBeamKind
  readonly params:PrescribedBeamParams
  readonly referenceCompatibility:boolean
  private compression=0
  private acceleration=0
  constructor(kind:PrescribedBeamKind,params:PrescribedBeamParams,referenceCompatibility=false) {
    this.kind=kind;this.params={...params};this.referenceCompatibility=referenceCompatibility
    const n=params.nodes
    const points=Array.from({length:n},(_,i):Vec2=>[Math.round((-0.5+i/(n-1))*1e4)/1e4,0])
    this.beam=new PlanarBeam({nodes:n,length:1,young:params.stiffness*1e6,radius:.01,density:1000,gravity:0,damping:params.damping,referenceNodes:points,fixedNodes:[0,1,n-2,n-1],referenceJacobian:referenceCompatibility})
  }
  step(dt:number):NewtonResult {return this.advance(dt,0)}
  private advance(dt:number,depth:number):NewtonResult {
    const b=this.beam,n=b.n,t=b.time,scale=this.params.load
    // An attempted path step is transactional: rejected branches and failed
    // substeps leave coordinates, velocities, time and loading state unchanged.
    const beforeQ=[...b.q],beforeV=[...b.v],beforeLast=b.last,beforeCompression=this.compression,beforeAcceleration=this.acceleration
    const restore=()=>{b.q=beforeQ;b.v=beforeV;b.time=t;b.last=beforeLast;this.compression=beforeCompression;this.acceleration=beforeAcceleration}
    const prescribed:Record<number,number>={}
    let compression=this.compression,acceleration=this.acceleration
    if(this.kind==='buckling') {
      // Original case_2 retains this small upward perturbation after t=1 s.
      if(t<1)acceleration=.1*scale
      if(t>1&&compression<=.6) {
        const shift=dt*.1*scale
        prescribed[2*n-4]=b.q[2*n-4]-shift;prescribed[2*n-2]=b.q[2*n-2]-shift
        compression+=shift
      }
    } else {
      // Original case_3: compress both ends, retain the perturbation to t=3 s,
      // then rotate the second left vertex about the first one after t=5 s.
      if(t<3&&compression<=.3) {
        acceleration=10*scale
        const shift=dt*.1*scale
        prescribed[0]=b.q[0]+shift;prescribed[2]=b.q[2]+shift
        prescribed[2*n-4]=b.q[2*n-4]-shift;prescribed[2*n-2]=b.q[2*n-2]-shift
        compression+=2*shift
      }
      if(t>3)acceleration=0
      if(t>5) {
        const angle=(t-5)*.1*scale,delta=b.restLengths[0]
        prescribed[2]=b.q[0]+delta*Math.cos(angle);prescribed[3]=b.q[1]-delta*Math.sin(angle)
      }
    }
    const load=new Array<number>(2*n).fill(0)
    for(let i=0;i<n;i++)load[2*i+1]=b.mass[i]*acceleration
    const result=this.kind==='buckling'?b.solve(load,undefined,{prescribed,pseudoTimeStep:dt,referenceIterations:this.referenceCompatibility}):b.solve(load,dt,{prescribed,referenceIterations:this.referenceCompatibility})
    const probe=2*Math.floor((n-1)/2)+1
    // For an upward imperfection and monotonically increasing compression,
    // reject Newton roots that jump to the opposite/decreasing branch. Retry
    // smaller continuation steps; the default reference path needs no retry.
    const wrongBranch=!this.referenceCompatibility&&this.kind==='buckling'&&compression>beforeCompression&&scale>0&&b.q[probe]<beforeQ[probe]-1e-9
    if((result.converged||result.accepted)&&!wrongBranch){this.compression=compression;this.acceleration=acceleration;return result}
    restore()
    if(!this.referenceCompatibility&&this.kind==='buckling'&&depth<8&&dt>1e-6) {
      const a=this.advance(dt/2,depth+1)
      if(a.converged) {
        const c=this.advance(dt/2,depth+1)
        if(c.converged)return b.last={converged:true,iterations:a.iterations+c.iterations,residual:c.residual}
      }
      restore()
    }
    return b.last={converged:false,iterations:result.iterations,residual:result.residual}

  }
  phase():string {
    const t=this.beam.time
    if(this.params.load===0)return '无加载'
    if(this.kind==='buckling')return t<=1?'初始微扰':this.compression<=.6?'右端压缩':'压缩保持'
    if(t<3&&this.compression<=.3)return '双端压缩'
    if(t<=3)return '保持微扰'
    if(t<=5)return '去除微扰'
    const probe=2*Math.floor((this.beam.n-1)/2)+1
    return this.beam.q[probe]<0?'端部旋转 · 已翻转':'端部旋转 · 等待翻转'
  }
  snapshot():PrescribedBeamState {return {compression:this.compression,acceleration:this.acceleration}}
  restore(state:PrescribedBeamState) {this.compression=state.compression;this.acceleration=state.acceleration}
}
