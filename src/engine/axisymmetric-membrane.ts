import { solveLinear } from './linear'
import type { NewtonResult, Vec2 } from './planar'

export interface MembraneElement { energy:number; gradient:number[]; hessian:number[][] }
/** Axisymmetric incompressible Mooney–Rivlin ring element.
 * u=(l/l0)^2, v=(r/r0)^2 and the thickness stretch squared is 1/(uv).
 * W=c1(u+v+1/(uv)-3)+c2(uv+1/u+1/v-3).
 * The 4×4 Hessian is exact via the chain rule, not finite differences.
 */
export function membraneElement(a:Vec2,b:Vec2,l0:number,r0:number,h0:number,c1:number,c2:number):MembraneElement {
  const dx=b[0]-a[0],dy=b[1]-a[1],r=(a[0]+b[0])/2
  if(l0<=0||r0<=0||r<=1e-12)throw Error('Degenerate axisymmetric membrane element')
  const u=(dx*dx+dy*dy)/(l0*l0),v=r*r/(r0*r0)
  if(u<1e-16||v<1e-16)throw Error('Degenerate membrane stretches')
  const volume=2*Math.PI*l0*r0*h0
  const energy=volume*(c1*(u+v+1/(u*v)-3)+c2*(u*v+1/u+1/v-3))
  const wu=c1*(1-1/(u*u*v))+c2*(v-1/(u*u)),wv=c1*(1-1/(u*v*v))+c2*(u-1/(v*v))
  const wuu=2*c1/(u*u*u*v)+2*c2/(u*u*u),wvv=2*c1/(u*v*v*v)+2*c2/(v*v*v),wuv=c1/(u*u*v*v)+c2
  const du=[-2*dx/(l0*l0),-2*dy/(l0*l0),2*dx/(l0*l0),2*dy/(l0*l0)]
  const dv=[r/(r0*r0),0,r/(r0*r0),0],edge=[-1,-1,1,1]
  const gradient=du.map((x,i)=>volume*(wu*x+wv*dv[i]))
  const hessian=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>{
    const ddu=i%2===j%2?2*edge[i]*edge[j]/(l0*l0):0
    const ddv=i%2===0&&j%2===0?1/(2*r0*r0):0
    return volume*(wuu*du[i]*du[j]+wvv*dv[i]*dv[j]+wuv*(du[i]*dv[j]+dv[i]*du[j])+wu*ddu+wv*ddv)
  }))
  return {energy,gradient,hessian}
}

export interface AxisymmetricMembraneParams {nodes:number;stiffness:number;load:number;damping:number}
function norm(v:number[]){return Math.hypot(...v)}
/** Closed 60-edge toroidal meridian from hyper_elastic/case_2. */
export class AxisymmetricMembrane {
  readonly n:number; readonly mass:number[]; readonly restLengths:number[]; readonly restRadii:number[]; readonly h0=.01
  readonly params:AxisymmetricMembraneParams; readonly referenceCompatibility:boolean
  q:number[];v:number[];time=0;last:NewtonResult={converged:true,iterations:0,residual:0}
  constructor(params:AxisymmetricMembraneParams,referenceCompatibility=false){
    this.params={...params};this.referenceCompatibility=referenceCompatibility;this.n=params.nodes
    if(!Number.isInteger(this.n)||this.n<8)throw Error('Membrane needs at least eight meridian vertices')
    this.q=Array.from({length:this.n},(_,i)=>{const angle=2*Math.PI*i/this.n;return [1+.2*Math.cos(angle),.2*Math.sin(angle)]}).flat()
    this.v=new Array(2*this.n).fill(0);this.mass=new Array(this.n).fill(0);this.restLengths=[];this.restRadii=[]
    for(let i=0;i<this.n;i++){
      const j=(i+1)%this.n,r1=this.q[2*i],r2=this.q[2*j],l=Math.hypot(r2-r1,this.q[2*j+1]-this.q[2*i+1])
      this.restLengths.push(l);this.restRadii.push((r1+r2)/2)
      // Exactly as source defRodParams: the full ring mass is assigned to each endpoint.
      const dm=1000*l*Math.PI*(r1+r2)*this.h0
      this.mass[i]+=dm;this.mass[j]+=dm
    }
  }
  private assemble(q:number[],withHessian:boolean){
    const nd=q.length,gradient=new Array<number>(nd).fill(0),H=withHessian?Array.from({length:nd},()=>new Array<number>(nd).fill(0)):[]
    const mu=this.params.stiffness*1e6/(2*(1+.5)),c1=.4*mu,c2=.1*mu
    let energy=0
    for(let i=0;i<this.n;i++){
      const j=(i+1)%this.n,ids=[2*i,2*i+1,2*j,2*j+1]
      const el=membraneElement([q[ids[0]],q[ids[1]]],[q[ids[2]],q[ids[3]]],this.restLengths[i],this.restRadii[i],this.h0,c1,c2)
      energy+=el.energy
      for(let a=0;a<4;a++){gradient[ids[a]]+=el.gradient[a];if(withHessian)for(let b=0;b<4;b++)H[ids[a]][ids[b]]+=el.hessian[a][b]}
    }
    return {energy,gradient,H}
  }
  energy(){return this.assemble(this.q,false).energy}
  step(dt:number):NewtonResult {
    if(!(dt>0))throw Error('Invalid time step')
    const old=[...this.q],oldV=[...this.v],nd=old.length,free=Array.from({length:nd},(_,i)=>i).filter(i=>i!==1)
    const pressure=-10000*(this.time+dt)*this.params.load,load=new Array<number>(nd).fill(0)
    // Source evaluates pressure on x0: it is an explicit follower load here.
    for(let i=0;i<this.n;i++){
      const j=(i+1)%this.n,dx=old[2*j]-old[2*i],dy=old[2*j+1]-old[2*i+1],c=Math.PI*(old[2*i]+old[2*j])*pressure/2
      load[2*i]+=-dy*c;load[2*j]+=-dy*c;load[2*i+1]+=dx*c;load[2*j+1]+=dx*c
    }
    let trial=old.map((x,i)=>x+(i===1?0:dt*oldV[i]))
    const residual=(q:number[],withHessian:boolean)=>{
      const {gradient,H}=this.assemble(q,withHessian)
      const r=free.map(i=>gradient[i]-load[i]+this.mass[Math.floor(i/2)]*((q[i]-old[i]-dt*oldV[i])/(dt*dt)+this.params.damping*(q[i]-old[i])/dt))
      const J=withHessian?free.map(i=>free.map(j=>H[i][j]+(i===j?this.mass[Math.floor(i/2)]*(1/(dt*dt)+this.params.damping/dt):0))):[]
      return {r,J}
    }
    let converged=false,accepted=false,reachedLimit=false,preUpdateResidual=Infinity,iterations=0,error=Infinity
    try{
      if(this.referenceCompatibility){
        for(let it=0;it<11;it++){
          const {r,J}=residual(trial,true);preUpdateResidual=norm(r);iterations=it+1
          const dx=solveLinear(J,r.map(x=>-x));free.forEach((index,j)=>trial[index]+=dx[j])
          reachedLimit=it===10;if(preUpdateResidual<=1e-4)break
        }
        error=norm(residual(trial,false).r);accepted=Number.isFinite(error);converged=accepted&&preUpdateResidual<=1e-4
      }else{
        for(let it=0;it<30;it++){
          const {r,J}=residual(trial,true);error=norm(r);iterations=it
          if(error<1e-7){converged=true;break}
          const delta=solveLinear(J,r.map(x=>-x));let alpha=1,candidate=[...trial],nextError=Infinity
          for(let line=0;line<9;line++){
            candidate=[...trial];free.forEach((index,j)=>candidate[index]+=alpha*delta[j])
            try{nextError=norm(residual(candidate,false).r)}catch{nextError=Infinity}
            if(Number.isFinite(nextError)&&(nextError<error||alpha<.005))break
            alpha*=.5
          }
          if(!Number.isFinite(nextError)||nextError>=error)break
          trial=candidate;iterations=it+1
        }
        error=norm(residual(trial,false).r);converged=error<1e-7
      }
    }catch{converged=false;accepted=false}
    if(converged||accepted){this.q=trial;this.v=trial.map((x,i)=>(x-old[i])/dt);this.time+=dt}
    return this.last={converged,iterations,residual:error,...(this.referenceCompatibility?{accepted,reachedLimit,preUpdateResidual}:{})}
  }
}
