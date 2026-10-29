/** Numerically conservative positivity audit for a trilinear hexahedron.
 * det(dx/dX) is degree <=2 in each reference coordinate and <=3 along a
 * linear nodal trajectory. Tensor-product Bernstein coefficients bound that
 * polynomial; de Casteljau subdivision tightens the bound. A floating-point
 * guard is applied and a failed/indeterminate proof is never accepted.
 *
 * The structured reference cell must be an axis-aligned parallelepiped, as
 * in hexesFromStructuredTets; its reference volume is 8*hex.weight.
 */
import type {Vec3} from './gripper3d'
import type {Hex3D} from './hexahedron'

export interface JacobianCertificate {safe:boolean;reason:'positive'|'nonpositive-sample'|'indeterminate';lowerBound:number;minimumSample:number;subdivisions:number}
const dims=[3,3,3,4],stride=[1,3,9,27],N=108
const shapeDerivatives=(()=>{
  const points=[0,.5,1],all:Float64Array[]=[]
  for(const z of points)for(const y of points)for(const x of points){
    const p=[x,y,z],d=new Float64Array(24)
    for(let n=0;n<8;n++)for(let k=0;k<3;k++){
      let v=(n&(1<<k))?1:-1
      for(let j=0;j<3;j++)if(j!==k)v*=(n&(1<<j))?p[j]:1-p[j]
      d[3*n+k]=v
    }
    all.push(d)
  }
  return all
})()
function interpolatingToBernstein(a:Float64Array,axis:number){
  const n=dims[axis],step=stride[axis],block=n*step
  for(let outer=0;outer<N;outer+=block)for(let inner=0;inner<step;inner++){
    const k=outer+inner,f0=a[k],f1=a[k+step],f2=a[k+2*step]
    if(n===3)a[k+step]=2*f1-(f0+f2)/2
    else{
      const f3=a[k+3*step],A=27*f1-8*f0-f3,B=27*f2-f0-8*f3
      a[k+step]=(2*A-B)/18;a[k+2*step]=(2*B-A)/18
    }
  }
}
function split(a:Float64Array,axis:number):[Float64Array,Float64Array]{
  const n=dims[axis],step=stride[axis],block=n*step,left=new Float64Array(N),right=new Float64Array(N)
  for(let outer=0;outer<N;outer+=block)for(let inner=0;inner<step;inner++){
    const k=outer+inner,work=Array.from({length:n},(_,i)=>a[k+i*step])
    left[k]=work[0];right[k+(n-1)*step]=work[n-1]
    for(let level=1;level<n;level++){
      for(let i=0;i<n-level;i++)work[i]=(work[i]+work[i+1])/2
      left[k+level*step]=work[0];right[k+(n-level-1)*step]=work[n-level-1]
    }
  }
  return [left,right]
}
function splitAxis(a:Float64Array){
  let axis=0,best=-1
  for(let i=0;i<4;i++){
    const n=dims[i],step=stride[i],block=n*step;let variation=0
    for(let outer=0;outer<N;outer+=block)for(let inner=0;inner<step;inner++)for(let j=0;j<n-1;j++)variation=Math.max(variation,Math.abs(a[outer+inner+(j+1)*step]-a[outer+inner+j*step]))
    if(variation>best){best=variation;axis=i}
  }
  return axis
}
export function certifyHexJacobian(hex:Hex3D,from:readonly Vec3[],to:readonly Vec3[],threshold=1e-8,maxDepth=16,maxNodes=4096):JacobianCertificate{
  const failure=(reason:'nonpositive-sample'|'indeterminate',lowerBound:number,minimumSample:number,subdivisions=0):JacobianCertificate=>({safe:false,reason,lowerBound,minimumSample,subdivisions})
  if(!Number.isFinite(threshold)||threshold<0||!Number.isInteger(maxDepth)||maxDepth<0||!Number.isInteger(maxNodes)||maxNodes<1||hex.nodes.length!==8||!(hex.weight>0)||!Number.isFinite(hex.weight))return failure('indeterminate',NaN,NaN)
  const p0=from[hex.nodes[0]],q0=to[hex.nodes[0]]
  if(!p0||!q0||![...p0,...q0].every(Number.isFinite))return failure('indeterminate',NaN,NaN)
  const base=new Float64Array(24),velocity=new Float64Array(24);let maxRelativeCoordinate=0
  for(let n=0;n<8;n++){
    const p=from[hex.nodes[n]],q=to[hex.nodes[n]]
    if(!p||!q||![...p,...q].every(Number.isFinite))return failure('indeterminate',NaN,NaN)
    for(let j=0;j<3;j++){
      const start=p[j]-p0[j],end=q[j]-q0[j]
      base[3*n+j]=start;velocity[3*n+j]=end-start
      maxRelativeCoordinate=Math.max(maxRelativeCoordinate,Math.abs(start),Math.abs(end))
    }
  }
  const coeff=new Float64Array(N);let minSample=Infinity,maxMagnitude=1
  for(let ti=0;ti<4;ti++){
    const t=ti/3,pos=Float64Array.from(base,(v,i)=>v+t*velocity[i])
    for(let k=0;k<27;k++){
      const d=shapeDerivatives[k];let a=0,b=0,c=0,e=0,f=0,g=0,h=0,i=0,j=0
      for(let n=0;n<8;n++){
        const x=pos[3*n],y=pos[3*n+1],z=pos[3*n+2],dx=d[3*n],dy=d[3*n+1],dz=d[3*n+2]
        a+=x*dx;b+=x*dy;c+=x*dz;e+=y*dx;f+=y*dy;g+=y*dz;h+=z*dx;i+=z*dy;j+=z*dz
      }
      const value=(a*(f*j-g*i)-b*(e*j-g*h)+c*(e*i-f*h))/(8*hex.weight)
      if(!Number.isFinite(value))return failure('indeterminate',NaN,NaN)
      coeff[27*ti+k]=value;minSample=Math.min(minSample,value);maxMagnitude=Math.max(maxMagnitude,Math.abs(value))
    }
  }
  // A guard based only on the computed determinant is unsafe when its large
  // terms cancel: an exactly singular affine cell can round to a large,
  // positive value. Bound the scale of those terms using coordinates relative
  // to node zero as well. This is deliberately conservative for extremely
  // distorted cells; it remains a floating-point heuristic, not an interval or
  // exact-arithmetic proof. Overflow or numerical uncertainty is rejected.
  const cancellationScale=(maxRelativeCoordinate*maxRelativeCoordinate*maxRelativeCoordinate)/(8*hex.weight)
  const guard=1e-10*Math.max(maxMagnitude,cancellationScale)
  if(!Number.isFinite(guard))return failure('indeterminate',NaN,minSample)
  if(minSample<=threshold)return failure('nonpositive-sample',minSample,minSample)
  if(minSample<=threshold+guard)return failure('indeterminate',minSample-guard,minSample)
  for(let axis=0;axis<4;axis++)interpolatingToBernstein(coeff,axis)
  const stack:{coeff:Float64Array;depth:number}[]=[{coeff,depth:0}];let subdivisions=0,lowerBound=Infinity,seen=0
  while(stack.length){
    if(++seen>maxNodes)return failure('indeterminate',lowerBound,minSample,subdivisions)
    const current=stack.pop()!,lo=Math.min(...current.coeff),hi=Math.max(...current.coeff)
    if(!Number.isFinite(lo)||!Number.isFinite(hi))return failure('indeterminate',NaN,minSample,subdivisions)
    if(lo>threshold+guard){lowerBound=Math.min(lowerBound,lo-guard);continue}
    if(current.depth>=maxDepth)return failure('indeterminate',Math.min(lowerBound,lo-guard),minSample,subdivisions)
    const [a,b]=split(current.coeff,splitAxis(current.coeff));subdivisions++
    stack.push({coeff:a,depth:current.depth+1},{coeff:b,depth:current.depth+1})
  }
  return {safe:true,reason:'positive',lowerBound,minimumSample:minSample,subdivisions}
}
