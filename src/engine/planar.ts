import { kernels } from './kernels'
import { solveLinear } from './linear'

export type Vec2 = [number, number]
export interface ElementResult { energy:number; gradient:number[] }

export function stretchElement(a:Vec2, b:Vec2, rest:number, ea:number): ElementResult {
  const x = b[0]-a[0], y = b[1]-a[1], length = Math.hypot(x,y)
  if (length < 1e-12 || rest <= 0) throw new Error('Degenerate stretching edge')
  const scalar = kernels().stretch_dedl(length,rest,ea)/length
  return { energy:kernels().stretch_energy(length,rest,ea), gradient:[-scalar*x,-scalar*y,scalar*x,scalar*y] }
}

/** Incompressible uniaxial Mooney–Rivlin edge; c1,c2 already include cross-sectional area. */
export function mooneyRivlinElement(a:Vec2,b:Vec2,rest:number,c1:number,c2:number):ElementResult {
  const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)
  if(l<1e-12||rest<=0)throw new Error('Degenerate hyperelastic edge')
  const lambda=l/rest
  const energy=rest*(c1*(lambda**2+2/lambda-3)+c2*(2*lambda+1/lambda**2-3))
  const dEdL=2*c1*(lambda-1/lambda**2)+2*c2*(1-1/lambda**3),s=dEdL/l
  return {energy,gradient:[-s*dx,-s*dy,s*dx,s*dy]}
}
/** Exact 4×4 Cartesian Hessian of the same hyperelastic edge energy. */
export function mooneyRivlinHessian(a:Vec2,b:Vec2,rest:number,c1:number,c2:number):number[][] {
  const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)
  if(l<1e-12||rest<=0)throw new Error('Degenerate hyperelastic edge')
  const lambda=l/rest,t=[dx/l,dy/l]
  const d=2*c1*(lambda-1/lambda**2)+2*c2*(1-1/lambda**3)
  const dd=(c1*(2+4/lambda**3)+6*c2/lambda**4)/rest
  const block=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>d/l*(i===j?1:0)+(dd-d/l)*t[i]*t[j]))
  return Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>block[i%2][j%2]*((i<2)===(j<2)?1:-1)))
}

/** Integrated turning angle beta = 2 tan(phi/2), with reference Voronoi length. */
export function bendingElement(a:Vec2, b:Vec2, c:Vec2, restVoronoi:number, ei:number, restBeta=0): ElementResult {
  const ax=b[0]-a[0], ay=b[1]-a[1], bx=c[0]-b[0], by=c[1]-b[1]
  const la2=ax*ax+ay*ay, lb2=bx*bx+by*by
  const beta=kernels().turning_curvature(ax,ay,bx,by)
  if (!Number.isFinite(beta) || la2 < 1e-16 || lb2 < 1e-16 || restVoronoi <= 0) throw new Error('Degenerate bending element')
  const delta=beta-restBeta
  const factor=ei/restVoronoi*delta*(1+beta*beta/4)
  const ga:[number,number]=[factor*ay/la2,-factor*ax/la2]
  const gb:[number,number]=[-factor*by/lb2,factor*bx/lb2]
  return { energy:0.5*ei/restVoronoi*delta*delta, gradient:[-ga[0],-ga[1],ga[0]-gb[0],ga[1]-gb[1],gb[0],gb[1]] }
}

/**
 * Exact planar bending-energy Hessian via phi = arg(b) - arg(a).
 * beta'=1+beta²/4, beta''=(beta/2) beta';
 * H_E=E_phi_phi grad(phi)grad(phi)^T + E_phi H_phi.
 */
export function bendingHessian(a:Vec2,b:Vec2,c:Vec2,restVoronoi:number,ei:number,restBeta=0):number[][] {
  const ax=b[0]-a[0],ay=b[1]-a[1],bx=c[0]-b[0],by=c[1]-b[1]
  const aa=ax*ax+ay*ay,bb=bx*bx+by*by,beta=kernels().turning_curvature(ax,ay,bx,by)
  if(!Number.isFinite(beta)||aa<1e-16||bb<1e-16||restVoronoi<=0)throw new Error('Degenerate bending element')
  const ge=[ay/aa,-ax/aa],gf=[-by/bb,bx/bb]
  const g=[-ge[0],-ge[1],ge[0]-gf[0],ge[1]-gf[1],gf[0],gf[1]]
  const ha=[[-2*ax*ay/(aa*aa),(ax*ax-ay*ay)/(aa*aa)],[(ax*ax-ay*ay)/(aa*aa),2*ax*ay/(aa*aa)]]
  const hb=[[2*bx*by/(bb*bb),(by*by-bx*bx)/(bb*bb)],[(by*by-bx*bx)/(bb*bb),-2*bx*by/(bb*bb)]]
  const edgeA=[-1,-1,1,1,0,0],edgeB=[0,0,-1,-1,1,1]
  const prime=1+beta*beta/4, delta=beta-restBeta
  const first=ei/restVoronoi*delta*prime
  const second=ei/restVoronoi*(prime*prime+delta*(beta/2)*prime)
  return Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>
    second*g[i]*g[j]+first*(edgeA[i]*edgeA[j]*ha[i%2][j%2]+edgeB[i]*edgeB[j]*hb[i%2][j%2])))
}

/** Upstream MATLAB's projected DER Newton Jacobian. Column-vector inner products
 * broadcast as scalars in the original code; this is NOT the exact Hessian.
 * Retained only for explicit, diagnostic replay of original iterations. */
export function upstreamBendingJacobian(a:Vec2,b:Vec2,c:Vec2,restVoronoi:number,ei:number,restBeta=0):number[][] {
  const ex=b[0]-a[0],ey=b[1]-a[1],fx=c[0]-b[0],fy=c[1]-b[1],le=Math.hypot(ex,ey),lf=Math.hypot(fx,fy)
  const te=[ex/le,ey/le],tf=[fx/lf,fy/lf],chi=1+te[0]*tf[0]+te[1]*tf[1], beta=2*(te[0]*tf[1]-te[1]*tf[0])/chi
  if(!Number.isFinite(beta)||le<1e-8||lf<1e-8||chi<1e-12)throw Error('Degenerate upstream bending element')
  const t=[(te[0]+tf[0])/chi,(te[1]+tf[1])/chi],cte=[2*te[1]/chi,-2*te[0]/chi],ctf=[2*tf[1]/chi,-2*tf[0]/chi]
  // The MATLAB source transposes column vectors before multiplication;
  // those products are scalars and broadcast across the 3x3 matrices.
  const tt=t[0]*t[0]+t[1]*t[1],et=cte[0]*t[0]+cte[1]*t[1],ft=ctf[0]*t[0]+ctf[1]*t[1],dot=te[0]*tf[0]+te[1]*tf[1]
  const a2=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>(2*beta*tt-2*ft-beta/chi*((i===j?1:0)-1)+beta/2)/(le*le)))
  const b2=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>(2*beta*tt+2*et-beta/chi*((i===j?1:0)-1)+beta/2)/(lf*lf)))
  const cross=[[0,-2/chi],[2/chi,0]]
  const ab=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>(-beta/chi*((i===j?1:0)+dot)+2*beta*tt-ft+et-cross[i][j])/(le*lf)))
  const be=[-1,-1,1,1,0,0],bf=[0,0,-1,-1,1,1],ge=[ey/(le*le),-ex/(le*le)],gf=[-fy/(lf*lf),fx/(lf*lf)]
  const gp=[-ge[0],-ge[1],ge[0]-gf[0],ge[1]-gf[1],gf[0],gf[1]].map(v=>v*(1+beta*beta/4))
  return Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>{
    const u=i%2,v=j%2,dd=be[i]*be[j]*a2[u][v]+be[i]*bf[j]*ab[u][v]+bf[i]*be[j]*ab[v][u]+bf[i]*bf[j]*b2[u][v]
    return ei/restVoronoi*(gp[i]*gp[j]+(beta-restBeta)*dd)
  }))
}


function norm(v:number[]) { return Math.sqrt(v.reduce((s,x)=>s+x*x,0)) }

export interface BeamOptions {
  nodes:number; length:number; young:number; radius:number; density:number; gravity:number; damping:number
  fixedNodes?:number[]; fixedDofs?:number[]; referenceNodes?:Vec2[]; material?:'hooke'|'mooney-rivlin'; bending?:boolean; referenceJacobian?:boolean
}
/** State-dependent external force and its Jacobian with respect to the trial coordinates. */
export type BeamExternalForce = (q:number[],old:number[],oldV:number[],dt:number,withJacobian:boolean)=>{force:number[];jacobian?:number[][]}
export interface BeamSolveOptions { prescribed?:Readonly<Record<number,number>>; pseudoTimeStep?:number; referenceIterations?:boolean; externalForce?:BeamExternalForce; tolerance?:number }

export interface NewtonResult { converged:boolean; iterations:number; residual:number; accepted?:boolean; reachedLimit?:boolean; preUpdateResidual?:number }

/** Planar DDG beam with analytic gradients/Hessians and static or implicit Euler Newton solves. */
export class PlanarBeam {
  readonly n:number; readonly length:number; readonly rest:number; readonly ea:number; readonly ei:number; readonly mass:number[]
  readonly restLengths:number[]; readonly restCurvatures:number[]; readonly fixedDofs:Set<number>; readonly freeDofs:number[]
  readonly material:'hooke'|'mooney-rivlin'; readonly includeBending:boolean; readonly referenceJacobian:boolean
  gravity:number; damping:number; q:number[]; v:number[]; time=0; last:NewtonResult={converged:true,iterations:0,residual:0}
  constructor(options:BeamOptions) {
    this.n=options.nodes; this.length=options.length; this.rest=options.length/(options.nodes-1)
    if(this.n<3 || this.length<=0)throw new Error('Beam requires at least three nodes and a positive length')
    const points=options.referenceNodes??Array.from({length:this.n},(_,i):Vec2=>[-options.length/2+i*this.rest,0])
    if(points.length!==this.n||points.some(p=>!p.every(Number.isFinite)))throw new Error('Invalid beam reference coordinates')
    this.q=points.flat(); this.v=new Array(2*this.n).fill(0)
    this.restLengths=Array.from({length:this.n-1},(_,i)=>Math.hypot(points[i+1][0]-points[i][0],points[i+1][1]-points[i][1]))
    if(this.restLengths.some(x=>x<1e-12))throw new Error('Degenerate beam reference edge')
    this.restCurvatures=Array.from({length:this.n-2},(_,i)=>kernels().turning_curvature(points[i+1][0]-points[i][0],points[i+1][1]-points[i][1],points[i+2][0]-points[i+1][0],points[i+2][1]-points[i+1][1]))
    if(this.restCurvatures.some(x=>!Number.isFinite(x)))throw new Error('Degenerate beam reference angle')
    const fixed=options.fixedNodes??(options.fixedDofs?[]:[0,1]),dofs=options.fixedDofs??[]
    if(fixed.some(i=>!Number.isInteger(i)||i<0||i>=this.n)||dofs.some(i=>!Number.isInteger(i)||i<0||i>=2*this.n))throw new Error('Invalid fixed node or DOF')
    this.fixedDofs=new Set([...fixed.flatMap(i=>[2*i,2*i+1]),...dofs]);this.freeDofs=Array.from({length:2*this.n},(_,i)=>i).filter(i=>!this.fixedDofs.has(i))
    this.ea=options.young*Math.PI*options.radius**2; this.ei=options.young*Math.PI*options.radius**4/4
    this.mass=new Array(this.n).fill(0)
    for(let i=0;i<this.n-1;i++){const dm=options.density*Math.PI*options.radius**2*this.restLengths[i]/2;this.mass[i]+=dm;this.mass[i+1]+=dm}
    this.gravity=options.gravity; this.damping=options.damping;this.material=options.material??'hooke';this.includeBending=options.bending??true;this.referenceJacobian=options.referenceJacobian??false
  }

  private assemble(q:number[], withHessian:boolean) {
    const nd=q.length, grad=new Array<number>(nd).fill(0)
    const H=withHessian ? Array.from({length:nd},()=>new Array<number>(nd).fill(0)) : []
    let energy=0
    const point=(i:number):Vec2=>[q[2*i],q[2*i+1]]
    for(let i=0;i<this.n-1;i++) {
      const a=point(i), b=point(i+1), rest=this.restLengths[i], ids=[2*i,2*i+1,2*i+2,2*i+3]
      const c1=.8*this.ea/6,c2=.2*this.ea/6
      const el=this.material==='mooney-rivlin'?mooneyRivlinElement(a,b,rest,c1,c2):stretchElement(a,b,rest,this.ea)
      energy+=el.energy; ids.forEach((id,j)=>grad[id]+=el.gradient[j])
      if(withHessian) {
        if(this.material==='mooney-rivlin') {
          const localH=mooneyRivlinHessian(a,b,rest,c1,c2)
          for(let row=0;row<4;row++)for(let col=0;col<4;col++)H[ids[row]][ids[col]]+=localH[row][col]
        } else {
          const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy), t=[dx/l,dy/l]
          const block=Array.from({length:2},(_,r)=>Array.from({length:2},(_,s)=>this.ea*((1/rest-1/l)*(r===s?1:0)+t[r]*t[s]/l)))
          for(let r=0;r<2;r++) for(let s=0;s<2;s++) {
            H[ids[r]][ids[s]]+=block[r][s]; H[ids[r+2]][ids[s+2]]+=block[r][s]
            H[ids[r]][ids[s+2]]-=block[r][s]; H[ids[r+2]][ids[s]]-=block[r][s]
          }
        }
      }
    }
    if(this.includeBending)for(let i=1;i<this.n-1;i++) {
      const ids=[2*i-2,2*i-1,2*i,2*i+1,2*i+2,2*i+3]
      const a=point(i-1),b=point(i),c=point(i+1),voro=(this.restLengths[i-1]+this.restLengths[i])/2,restBeta=this.restCurvatures[i-1]
      const el=bendingElement(a,b,c,voro,this.ei,restBeta); energy+=el.energy; ids.forEach((id,j)=>grad[id]+=el.gradient[j])
      if(withHessian) {
        const localH=this.referenceJacobian?upstreamBendingJacobian(a,b,c,voro,this.ei,restBeta):bendingHessian(a,b,c,voro,this.ei,restBeta)
        for(let row=0;row<6;row++)for(let col=0;col<6;col++)H[ids[row]][ids[col]]+=localH[row][col]
      }
    }
    return {energy,grad,H}
  }
  energy() { return this.assemble(this.q,false).energy }
  gradient(q=this.q) { return this.assemble(q,false).grad }

  /** Static equilibrium if dt is absent; prescribed values affect constrained DOFs only. */
  solve(load:number[], dt?:number, options:BeamSolveOptions={}):NewtonResult {
    if(load.length!==this.q.length||load.some(x=>!Number.isFinite(x)))throw new Error('Invalid beam load')
    if((dt!==undefined&&dt<=0)||(options.pseudoTimeStep!==undefined&&options.pseudoTimeStep<=0))throw new Error('Invalid time step')
    if(options.externalForce&&dt===undefined)throw new Error('State-dependent external force requires a time step')
    const tolerance=options.tolerance??1e-7
    if(!(tolerance>0&&Number.isFinite(tolerance)))throw new Error('Invalid residual tolerance')
    const old=[...this.q],oldV=[...this.v],free=this.freeDofs,advance=dt??options.pseudoTimeStep
    let trial=old.map((value,i)=>value+(advance&&!this.fixedDofs.has(i)?advance*oldV[i]:0))
    for(const [key,value] of Object.entries(options.prescribed??{})) {
      const i=Number(key)
      if(!this.fixedDofs.has(i)||!Number.isFinite(value))throw new Error('Prescribed displacement must be finite and constrained')
      trial[i]=value
    }
    const residual=(q:number[], withHessian:boolean) => {
      const {grad,H}=this.assemble(q,withHessian)
      const external=options.externalForce?.(q,old,oldV,dt!,withHessian)
      if(external&&(external.force.length!==q.length||external.force.some(x=>!Number.isFinite(x))))throw Error('Invalid external force')
      const r=free.map(i=>grad[i]-load[i]-(external?.force[i]??0)+(dt ? this.mass[Math.floor(i/2)]*((q[i]-old[i]-dt*oldV[i])/(dt*dt)+this.damping*(q[i]-old[i])/dt) : 0))
      let J:number[][]=[]
      if(withHessian) J=free.map(i=>free.map(j=>H[i][j]-(external?.jacobian?.[i]?.[j]??0)+(dt&&i===j ? this.mass[Math.floor(i/2)]*(1/(dt*dt)+this.damping/dt) : 0)))
      return {r,J}
    }
    let converged=false, iterations=0, error=Infinity, accepted=false, reachedLimit=false, preUpdateResidual=Infinity
    try {
      // Compatibility is intentionally opt-in and only used by reference replay:
      // the source checks the pre-update norm after applying each update, and
      // returns its last iterate when it reaches the iteration limit.
      if(options.referenceIterations) {
        for(let it=0;it<11;it++) {
          const {r,J}=residual(trial,true);preUpdateResidual=norm(r);iterations=it+1
          const delta=solveLinear(J,r.map(x=>-x));free.forEach((index,j)=>trial[index]+=delta[j])
          reachedLimit=it===10
          if(preUpdateResidual<=1e-4)break
        }
        error=norm(residual(trial,false).r)
        accepted=Number.isFinite(error);converged=accepted&&preUpdateResidual<=1e-4
      } else {
        for(let it=0;it<30;it++) {
          const {r,J}=residual(trial,true); error=norm(r); iterations=it
          if(error<tolerance) { converged=true; break }
          const delta=solveLinear(J,r.map(x=>-x))
          let alpha=1, candidate=[...trial], nextError=Infinity
          for(let line=0;line<9;line++) {
            candidate=[...trial]; free.forEach((index,j)=>candidate[index]+=alpha*delta[j])
            try { nextError=norm(residual(candidate,false).r) } catch { nextError=Infinity }
            if(Number.isFinite(nextError) && (nextError<error || alpha<.005)) break
            alpha*=.5
          }
          if(!Number.isFinite(nextError) || nextError>=error) break
          trial=candidate; iterations=it+1
        }
        error=norm(residual(trial,false).r); converged=error<tolerance
      }
    } catch { converged=false;accepted=false }
    // Normal solves never commit a divergent iterate. Reference replay explicitly
    // accepts the upstream last iterate even when the original hit its limit.
    if(converged||accepted) {
      this.q=trial
      if(advance) { this.v=trial.map((x,i)=>(x-old[i])/advance); this.time+=advance }
    }
    return this.last={converged,iterations,residual:error,...(options.referenceIterations?{accepted,reachedLimit,preUpdateResidual}: {})}
  }
  step(dt:number) {
    const load=new Array<number>(this.q.length).fill(0)
    for(let i=0;i<this.n;i++) load[2*i+1]=-this.mass[i]*this.gravity
    return this.solve(load,dt)
  }
}
