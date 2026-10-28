export interface MinresResult {x:Float64Array;iterations:number;converged:boolean;residual:number}

/**
 * Matrix-free MINRES for a real symmetric, possibly indefinite system.
 * The diagonal is a strictly positive preconditioner. Acceptance always uses
 * the *true*, unpreconditioned residual, not the Lanczos estimate alone.
 */
export function minres(rhs:Float64Array,apply:(v:Float64Array,out:Float64Array)=>void,diagonal:Float64Array,maxIterations=3000):MinresResult {
  const n=rhs.length,x=new Float64Array(n)
  if(diagonal.length!==n||diagonal.some(v=>!(v>0)||!Number.isFinite(v)))throw Error('MINRES requires a positive diagonal preconditioner')
  const dot=(a:Float64Array,b:Float64Array)=>{let sum=0;for(let i=0;i<n;i++)sum+=a[i]*b[i];return sum}
  const norm=(a:Float64Array)=>Math.sqrt(dot(a,a)),target=Math.max(1e-11,norm(rhs)*1e-9)
  const work=new Float64Array(n)
  const trueResidual=()=>{apply(x,work);let sum=0;for(let i=0;i<n;i++){const d=rhs[i]-work[i];sum+=d*d}return Math.sqrt(sum)}
  const precondition=(r:Float64Array)=>Float64Array.from(r,(v,i)=>v/diagonal[i])
  let r1=rhs.slice(),r2=rhs.slice(),y=precondition(r1),beta=Math.sqrt(dot(r1,y)),oldBeta=0
  let dbar=0,epsln=0,phibar=beta,cs=-1,sn=0,w=new Float64Array(n),w2=new Float64Array(n)
  if(norm(rhs)<=target)return {x,iterations:0,converged:true,residual:norm(rhs)}
  let residual=norm(rhs),attempted=0
  for(let iteration=1;iteration<=maxIterations;iteration++){
    attempted=iteration
    if(!(beta>0)||!Number.isFinite(beta))break
    const v=Float64Array.from(y,z=>z/beta),next=new Float64Array(n)
    apply(v,next)
    if(iteration>=2)for(let i=0;i<n;i++)next[i]-=(beta/oldBeta)*r1[i]
    const alpha=dot(v,next)
    for(let i=0;i<n;i++)next[i]-=(alpha/beta)*r2[i]
    r1=r2;r2=next;y=precondition(r2);oldBeta=beta
    const betaSquared=dot(r2,y)
    if(!Number.isFinite(betaSquared)||betaSquared<0)break
    beta=Math.sqrt(betaSquared)
    const oldeps=epsln,delta=cs*dbar+sn*alpha,gbar=sn*dbar-cs*alpha
    epsln=sn*beta;dbar=-cs*beta
    const gamma=Math.hypot(gbar,beta)
    if(!(gamma>0)||!Number.isFinite(gamma))break
    cs=gbar/gamma;sn=beta/gamma
    const phi=cs*phibar;phibar=sn*phibar
    const w1=w2;w2=w;w=new Float64Array(n)
    for(let i=0;i<n;i++){w[i]=(v[i]-oldeps*w1[i]-delta*w2[i])/gamma;x[i]+=phi*w[i]}
    // Recompute explicitly: a small recursive/weighted residual is not enough.
    if(iteration%10===0||Math.abs(phibar)<target||beta===0){
      residual=trueResidual()
      if(residual<=target)return {x,iterations:iteration,converged:true,residual}
    }
  }
  return {x,iterations:attempted,converged:false,residual:trueResidual()}
}
