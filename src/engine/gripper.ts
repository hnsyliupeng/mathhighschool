/** Quasi-static plane-strain soft finger with a discretized, tension-only tendon.
 *
 * The tendon passes through reduced frictionless guides embedded in the finger.
 * Each guide has two locally rotating walls whose clearance follows the local
 * transverse deformation of solid nodes. Unilateral contact acts only when
 * the tendon crosses a wall. Axial sliding is free. This is not a 3-D bore or
 * full surface collision.
 * SI units: m, N, Pa. See docs/TENDON_GRIPPER.md for assumptions.
 */
export type Point2=[number,number]
export interface GripperParams {
  young:number; poisson:number; thickness:number; cableEA:number; cableB:number
  clearance:number; contactStiffness:number; pull:number; cellsPerTooth:number
}
export const defaultGripperParams:GripperParams={young:250_000,poisson:.35,thickness:.008,cableEA:30,cableB:2e-9,clearance:.0004,contactStiffness:5000,pull:.004,cellsPerTooth:4}
export interface ElementResult {energy:number;gradient:number[];hessian:number[];J:number;vonMises:number}
interface Triangle {nodes:[number,number,number]; gradients:[Point2,Point2,Point2]; area:number}
export interface GripperMesh {reference:Point2[]; triangles:Triangle[]; fixed:number[]; guides:number[]; guideWalls:[number,number][]; guideSpans:[number,number][]; tip:number; tipSensor:number; length:number; height:number}
export interface ContactInfo {center:Point2;point:Point2;force:Point2;magnitude:number;penetration:number;clearance:number;active:boolean;sectionReaction:number}
export interface GripperFrame {
  pull:number;positions:Point2[];tendon:Point2[];contacts:ContactInfo[];stress:number[]
  tip:Point2;tipDeflection:number;actuatorForce:Point2;tension:number;energy:number;minJ:number
  maxStress:number;maxPenetration:number;activeContacts:number;residual:number;iterations:number
  converged:boolean; message?:string
}

function triangleData(reference:Point2[],a:number,b:number,c:number):Triangle {
  const A=reference[a],B=reference[b],C=reference[c]
  const dx1=B[0]-A[0],dy1=B[1]-A[1],dx2=C[0]-A[0],dy2=C[1]-A[1],det=dx1*dy2-dx2*dy1
  if(!(det>0))throw Error('Invalid reference triangle')
  const gb:Point2=[dy2/det,-dx2/det],gc:Point2=[-dy1/det,dx1/det],ga:Point2=[-gb[0]-gc[0],-gb[1]-gc[1]]
  return {nodes:[a,b,c],gradients:[ga,gb,gc],area:det/2}
}
/** Five teeth and an unbroken backbone; not a patient- or device-specific mesh. */
export function makeGripperMesh(cellsPerTooth=4):GripperMesh {
  if(!Number.isInteger(cellsPerTooth)||cellsPerTooth<4||cellsPerTooth%4!==0||cellsPerTooth>8)throw Error('cellsPerTooth must be 4 or 8')
  const nx=5*cellsPerTooth,ny=cellsPerTooth,L=.08,H=.014,backbone=ny/2,solidWidth=3*cellsPerTooth/4
  const reference:Point2[]=[],indices=new Map<string,number>(),triangles:Triangle[]=[]
  const node=(i:number,j:number)=>{const key=`${i},${j}`,existing=indices.get(key);if(existing!==undefined)return existing;const id=reference.length;reference.push([L*i/nx,H*j/ny]);indices.set(key,id);return id}
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    if(j>=backbone&&i%cellsPerTooth>=solidWidth)continue
    const a=node(i,j),b=node(i+1,j),c=node(i+1,j+1),d=node(i,j+1)
    triangles.push(triangleData(reference,a,b,c),triangleData(reference,a,c,d))
  }
  const fixed=reference.map((p,i)=>p[0]===0?i:-1).filter(i=>i>=0)
  const guideRow=3*ny/4
  const get=(i:number,j:number)=>{const id=indices.get(`${i},${j}`);if(id===undefined)throw Error('Guide node missing');return id}
  const centers=Array.from({length:5},(_,k)=>get(k*cellsPerTooth+cellsPerTooth/4,guideRow))
  const guideWalls=Array.from({length:4},(_,k):[number,number]=>{
    const mid=k*cellsPerTooth+cellsPerTooth/4
    return [get(mid-cellsPerTooth/4,guideRow),get(mid+cellsPerTooth/4,guideRow)]
  })
  const guideSpans=Array.from({length:4},(_,k):[number,number]=>{
    const mid=k*cellsPerTooth+cellsPerTooth/4
    return [get(mid,ny/2),get(mid,ny)]
  })
  return {reference,triangles,fixed,guides:centers.slice(0,4),guideWalls,guideSpans,tip:centers[4],tipSensor:get(nx,ny/4),length:L,height:H}
}

/** Compressible Neo-Hookean, 3-D law with Fzz=1 (plane strain).
 * Exact first Piola stress and consistent material tangent for a linear triangle.
 */
export function neoHookeanTriangle(positions:readonly Point2[],tri:Triangle,young:number,poisson:number,thickness:number,withHessian=true):ElementResult {
  if(![young,poisson,thickness].every(Number.isFinite)||young<=0||poisson<0||poisson>=.5||thickness<=0)throw Error('Invalid solid material')
  const mu=young/(2*(1+poisson)),lambda=young*poisson/((1+poisson)*(1-2*poisson))
  let f00=0,f01=0,f10=0,f11=0
  for(let a=0;a<3;a++){const p=positions[tri.nodes[a]],g=tri.gradients[a];f00+=p[0]*g[0];f01+=p[0]*g[1];f10+=p[1]*g[0];f11+=p[1]*g[1]}
  const J=f00*f11-f01*f10
  if(!(J>1e-8)||!Number.isFinite(J))throw Error('Inverted or degenerate solid element')
  const lnJ=Math.log(J),F=[[f00,f01],[f10,f11]],invT=[[f11/J,-f10/J],[-f01/J,f00/J]]
  const volume=tri.area*thickness,energy=volume*(.5*mu*(f00*f00+f01*f01+f10*f10+f11*f11-2)-mu*lnJ+.5*lambda*lnJ*lnJ)
  const P=F.map((row,i)=>row.map((v,j)=>mu*v+(-mu+lambda*lnJ)*invT[i][j]))
  const gradient=new Array<number>(6).fill(0),hessian=withHessian?new Array<number>(36).fill(0):[]
  for(let a=0;a<3;a++)for(let i=0;i<2;i++){
    for(let j=0;j<2;j++)gradient[2*a+i]+=volume*P[i][j]*tri.gradients[a][j]
    if(withHessian)for(let b=0;b<3;b++)for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let l=0;l<2;l++){
      const tangent=mu*(i===k&&j===l?1:0)+(mu-lambda*lnJ)*invT[i][l]*invT[k][j]+lambda*invT[i][j]*invT[k][l]
      hessian[(2*a+i)*6+2*b+k]+=volume*tri.gradients[a][j]*tangent*tri.gradients[b][l]
    }
  }
  const sxx=(P[0][0]*f00+P[0][1]*f01)/J,syy=(P[1][0]*f10+P[1][1]*f11)/J
  const sxy=(P[0][0]*f10+P[0][1]*f11)/J,szz=lambda*lnJ/J
  const vonMises=Math.sqrt(Math.max(0,.5*((sxx-syy)**2+(syy-szz)**2+(szz-sxx)**2)+3*sxy*sxy))
  return {energy,gradient,hessian,J,vonMises}
}

// Second-order automatic differentiation for the moving guide / cable crossing.
// Differentiating the intersection is essential: it distributes the contact
// reaction to the solid wall AND the two cable segment endpoints.
interface Jet {v:number;g:Float64Array;h:Float64Array}
function jet(v:number,n:number,index=-1):Jet {const g=new Float64Array(n);if(index>=0)g[index]=1;return {v,g,h:new Float64Array(n*n)}}
function jadd(a:Jet,b:Jet):Jet {const n=a.g.length,g=new Float64Array(n),h=new Float64Array(n*n);for(let i=0;i<n;i++)g[i]=a.g[i]+b.g[i];for(let i=0;i<h.length;i++)h[i]=a.h[i]+b.h[i];return {v:a.v+b.v,g,h}}
function jscale(a:Jet,s:number):Jet {return {v:a.v*s,g:Float64Array.from(a.g,x=>x*s),h:Float64Array.from(a.h,x=>x*s)}}
function jsub(a:Jet,b:Jet){return jadd(a,jscale(b,-1))}
function jmul(a:Jet,b:Jet):Jet {const n=a.g.length,g=new Float64Array(n),h=new Float64Array(n*n);for(let i=0;i<n;i++){g[i]=a.g[i]*b.v+a.v*b.g[i];for(let j=0;j<n;j++)h[i*n+j]=a.h[i*n+j]*b.v+a.v*b.h[i*n+j]+a.g[i]*b.g[j]+b.g[i]*a.g[j]}return {v:a.v*b.v,g,h}}
function junary(a:Jet,v:number,d1:number,d2:number):Jet {const n=a.g.length,g=new Float64Array(n),h=new Float64Array(n*n);for(let i=0;i<n;i++){g[i]=d1*a.g[i];for(let j=0;j<n;j++)h[i*n+j]=d1*a.h[i*n+j]+d2*a.g[i]*a.g[j]}return {v,g,h}}
/** The virtual cable station is the crossing of a rotating guide section.
 * Only its signed transverse coordinate s is an unknown. It is not a material
 * point, so the tendon can slide axially through the guide without friction.
 */
function guideStation(a:Point2,b:Point2,s:number){
  const [ax,ay,bx,by,offset]=[...a,...b,s].map((x,i)=>jet(x,5,i)),vx=jsub(bx,ax),vy=jsub(by,ay),l2=jadd(jmul(vx,vx),jmul(vy,vy)),length=Math.sqrt(l2.v)
  if(!(length>1e-12))throw Error('Degenerate guide orientation')
  const inv=junary(l2,1/length,-.5/length**3,.75/length**5),nx=jscale(jmul(vy,inv),-1),ny=jmul(vx,inv)
  return {x:jadd(jscale(jadd(ax,bx),.5),jmul(offset,nx)),y:jadd(jscale(jadd(ay,by),.5),jmul(offset,ny)),normal:[nx.v,ny.v] as Point2}
}

/** Deformable effective half-clearance follows the projected separation of two
 * transverse solid nodes. Exact derivatives transmit changing-wall contact
 * forces back to those nodes; the actual bore is not cut from the mesh. */
export function deformableGuideContact(a:Point2,b:Point2,lower:Point2,upper:Point2,s:number,referenceSpan:number,clearance0:number,stiffness:number,withHessian=true){
  if(![...a,...b,...lower,...upper,s,referenceSpan,clearance0,stiffness].every(Number.isFinite)||!(referenceSpan>0&&clearance0>0&&stiffness>0))throw Error('Invalid contact properties')
  const [ax,ay,bx,by,lx,ly,ux,uy,offset]=[...a,...b,...lower,...upper,s].map((v,i)=>jet(v,9,i))
  const vx=jsub(bx,ax),vy=jsub(by,ay),l2=jadd(jmul(vx,vx),jmul(vy,vy)),length=Math.sqrt(l2.v)
  if(!(length>1e-12))throw Error('Degenerate guide orientation')
  const inv=junary(l2,1/length,-.5/length**3,.75/length**5),nx=jscale(jmul(vy,inv),-1),ny=jmul(vx,inv)
  const span=jadd(jmul(jsub(ux,lx),nx),jmul(jsub(uy,ly),ny)),clearance=jscale(span,clearance0/referenceSpan)
  if(!(clearance.v>1e-9))throw Error('Collapsed guide clearance')
  const penetration=Math.max(0,Math.abs(s)-clearance.v),magnitude=stiffness*penetration
  const force:Point2=[-magnitude*Math.sign(s)*nx.v,-magnitude*Math.sign(s)*ny.v]
  if(!penetration)return {energy:0,gradient:new Array<number>(9).fill(0),hessian:withHessian?new Array<number>(81).fill(0):[],penetration,clearance:clearance.v,magnitude,force}
  const violation=jsub(jscale(offset,Math.sign(s)),clearance),gradient=Array.from(violation.g,v=>stiffness*penetration*v)
  const hessian=withHessian?Array.from(violation.h,(v,i)=>stiffness*(violation.g[Math.floor(i/9)]*violation.g[i%9]+penetration*v)):[]
  return {energy:.5*stiffness*penetration**2,gradient,hessian,penetration,clearance:clearance.v,magnitude,force}
}

/** A single extensible, frictionless tendon: strain is based on TOTAL length,
 * so tension is common to all segments and material can slide through guides. */
export function tendonLengthEnergy(points:Point2[],restLength:number,EA:number,withHessian=true){
  if(points.length<2||!Number.isFinite(restLength)||!Number.isFinite(EA)||restLength<=0||EA<=0||points.some(p=>!p.every(Number.isFinite)))throw Error('Invalid tendon geometry or material')
  const n=points.length,nd=2*n,gradient=new Array<number>(nd).fill(0),dL=new Array<number>(nd).fill(0),H=withHessian?new Array<number>(nd*nd).fill(0):[]
  let length=0;const edges:{length:number;tx:number;ty:number}[]=[]
  for(let i=0;i<n-1;i++){const dx=points[i+1][0]-points[i][0],dy=points[i+1][1]-points[i][1],l=Math.hypot(dx,dy);if(!(l>1e-12))throw Error('Degenerate tendon segment');const tx=dx/l,ty=dy/l;length+=l;edges.push({length:l,tx,ty});dL[2*i]-=tx;dL[2*i+1]-=ty;dL[2*i+2]+=tx;dL[2*i+3]+=ty}
  const extension=Math.max(0,length-restLength),k=EA/restLength,tension=k*extension
  if(extension>0){
    for(let i=0;i<nd;i++){gradient[i]=tension*dL[i];if(withHessian)for(let j=0;j<nd;j++)H[i*nd+j]=k*dL[i]*dL[j]}
    if(withHessian)edges.forEach(({length:l,tx,ty},i)=>{
      const A=[1-tx*tx,-tx*ty,-tx*ty,1-ty*ty]
      for(let a=0;a<4;a++)for(let b=0;b<4;b++)H[(2*i+a)*nd+2*i+b]+=tension/l*(a<2?1:-1)*(b<2?1:-1)*A[(a%2)*2+b%2]
    })
  }
  return {energy:.5*k*extension**2,gradient,hessian:H,tension,length}
}

/** Cholesky solve of a symmetric positive definite, row-major matrix. */
function choleskySolve(matrix:Float64Array,rhs:Float64Array,n:number,shift:number):Float64Array|null {
  const L=new Float64Array(n*n)
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let sum=matrix[i*n+j]+(i===j?shift:0)
    for(let k=0;k<j;k++)sum-=L[i*n+k]*L[j*n+k]
    if(i===j){if(!(sum>1e-14)||!Number.isFinite(sum))return null;L[i*n+j]=Math.sqrt(sum)}
    else L[i*n+j]=sum/L[j*n+j]
  }
  const x=new Float64Array(n)
  for(let i=0;i<n;i++){let s=rhs[i];for(let j=0;j<i;j++)s-=L[i*n+j]*x[j];x[i]=s/L[i*n+i]}
  for(let i=n-1;i>=0;i--){let s=x[i];for(let j=i+1;j<n;j++)s-=L[j*n+i]*x[j];x[i]=s/L[i*n+i]}
  return x
}

type CoordinateMap={value:number;indices:number[];derivatives:Float64Array;second:Float64Array}
function directCoordinate(q:Float64Array,index:number):CoordinateMap{return {value:q[index],indices:[index],derivatives:Float64Array.of(1),second:new Float64Array(1)}}
function mappedCoordinate(value:Jet,indices:number[]):CoordinateMap{return {value:value.v,indices,derivatives:value.g,second:value.h}}

export class TendonGripper {
  readonly params:GripperParams;readonly mesh:GripperMesh;readonly actuatorDof:number;readonly stationDofs:number[];readonly free:number[];readonly restLengths:number[]
  q:Float64Array;pull=0;last:GripperFrame
  constructor(params:GripperParams=defaultGripperParams){
    this.params={...params};const p=this.params
    if(!Number.isFinite(p.young)||p.young<=0||p.poisson<0||p.poisson>=.49||p.thickness<=0||p.cableEA<=0||p.cableB<=0||p.clearance<=0||p.contactStiffness<=0||p.pull<0||!Object.values(p).every(Number.isFinite))throw Error('Invalid gripper parameters')
    this.mesh=makeGripperMesh(p.cellsPerTooth)
    const base=2*this.mesh.reference.length
    this.stationDofs=this.mesh.guides.map((_,i)=>base+i);this.actuatorDof=base+this.stationDofs.length
    this.q=new Float64Array(this.actuatorDof+2)
    this.mesh.reference.forEach((v,i)=>{this.q[2*i]=v[0];this.q[2*i+1]=v[1]})
    const first=this.mesh.reference[this.mesh.guides[0]],next=this.mesh.reference[this.mesh.guides[1]],spacing=next[0]-first[0]
    this.q[this.actuatorDof]=first[0]-spacing;this.q[this.actuatorDof+1]=first[1]
    const tendon:Point2[]=[[this.q[this.actuatorDof],this.q[this.actuatorDof+1]],...this.mesh.guides.map(id=>this.mesh.reference[id]),this.mesh.reference[this.mesh.tip]]
    this.restLengths=tendon.slice(1).map((p,i)=>Math.hypot(p[0]-tendon[i][0],p[1]-tendon[i][1]))
    const fixed=new Set([...this.mesh.fixed.flatMap(id=>[2*id,2*id+1]),this.actuatorDof,this.actuatorDof+1])
    this.free=Array.from({length:this.q.length},(_,i)=>i).filter(i=>!fixed.has(i))
    this.last=this.frame(this.q,0,0,0,true)
  }
  private assemble(q:Float64Array,withHessian:boolean){
    const nd=q.length,gradient=new Float64Array(nd),H=withHessian?new Float64Array(nd*nd):null
    const positions=this.mesh.reference.map((_,i):Point2=>[q[2*i],q[2*i+1]])
    let energy=0,minJ=Infinity,maxStress=0,maxPenetration=0
    const stress:number[]=[],contacts:ContactInfo[]=[]
    const add=(ids:number[],result:{energy:number;gradient:number[];hessian:number[]})=>{
      energy+=result.energy
      for(let a=0;a<ids.length;a++){gradient[ids[a]]+=result.gradient[a];if(H)for(let b=0;b<ids.length;b++)H[ids[a]*nd+ids[b]]+=result.hessian[a*ids.length+b]}
    }
    for(const tri of this.mesh.triangles){
      const e=neoHookeanTriangle(positions,tri,this.params.young,this.params.poisson,this.params.thickness,withHessian)
      add(tri.nodes.flatMap(i=>[2*i,2*i+1]),e);stress.push(e.vonMises);minJ=Math.min(minJ,e.J);maxStress=Math.max(maxStress,e.vonMises)
    }
    const maps:CoordinateMap[]=[directCoordinate(q,this.actuatorDof),directCoordinate(q,this.actuatorDof+1)]
    this.mesh.guideWalls.forEach(([a,b],i)=>{
      const stationDof=this.stationDofs[i],offset=q[stationDof],station=guideStation(positions[a],positions[b],offset),indices=[2*a,2*a+1,2*b,2*b+1,stationDof]
      maps.push(mappedCoordinate(station.x,indices),mappedCoordinate(station.y,indices))
      const [lower,upper]=this.mesh.guideSpans[i],referenceSpan=this.mesh.reference[upper][1]-this.mesh.reference[lower][1]
      const contact=deformableGuideContact(positions[a],positions[b],positions[lower],positions[upper],offset,referenceSpan,this.params.clearance,this.params.contactStiffness,withHessian)
      add([2*a,2*a+1,2*b,2*b+1,2*lower,2*lower+1,2*upper,2*upper+1,stationDof],contact)
      const point:Point2=[station.x.v,station.y.v],center:Point2=[(positions[a][0]+positions[b][0])/2,(positions[a][1]+positions[b][1])/2]
      contacts.push({center,point,force:contact.force,magnitude:contact.magnitude,penetration:contact.penetration,clearance:contact.clearance,active:contact.penetration>0,sectionReaction:0});maxPenetration=Math.max(maxPenetration,contact.penetration)
    })
    maps.push(directCoordinate(q,2*this.mesh.tip),directCoordinate(q,2*this.mesh.tip+1))
    const tendon=Array.from({length:maps.length/2},(_,i):Point2=>[maps[2*i].value,maps[2*i+1].value])
    const cable=tendonLengthEnergy(tendon,this.restLengths.reduce((sum,x)=>sum+x,0),this.params.cableEA,withHessian)
    // The bending energy regularizes slack transverse station motion. It is a
    // documented physical term and is included in energy and force reports.
    const m=maps.length
    for(let i=1;i<tendon.length-1;i++){
      const h=(this.restLengths[i-1]+this.restLengths[i])/2,k=this.params.cableB/(h*h*h),coeff=[1,-2,1],bend=[0,0]
      for(let a=0;a<3;a++)for(let d=0;d<2;d++)bend[d]+=coeff[a]*maps[2*(i-1+a)+d].value
      cable.energy+=.5*k*(bend[0]**2+bend[1]**2)
      for(let a=0;a<3;a++)for(let d=0;d<2;d++){
        const ai=2*(i-1+a)+d;cable.gradient[ai]+=k*coeff[a]*bend[d]
        if(withHessian)for(let b=0;b<3;b++)cable.hessian[ai*m+2*(i-1+b)+d]+=k*coeff[a]*coeff[b]
      }
    }
    // The fixed-section parameterization introduces an axial section reaction
    // in addition to the reported normal wall contact. It is NOT Coulomb
    // friction and is reported so the approximation can be assessed.
    this.mesh.guideWalls.forEach(([a,b],i)=>{
      const dx=positions[b][0]-positions[a][0],dy=positions[b][1]-positions[a][1],l=Math.hypot(dx,dy),j=2*(i+1)
      contacts[i].sectionReaction=(cable.gradient[j]*dx+cable.gradient[j+1]*dy)/l
    })
    energy+=cable.energy
    // Full chain rule through guide translations and rotations, including the
    // geometric term g_x * Hessian(x(z)); keeps the assembled tangent exact.
    for(let i=0;i<m;i++){
      const x=maps[i]
      for(let a=0;a<x.indices.length;a++){
        const ia=x.indices[a];gradient[ia]+=cable.gradient[i]*x.derivatives[a]
        if(H){
          for(let b=0;b<x.indices.length;b++)H[ia*nd+x.indices[b]]+=cable.gradient[i]*x.second[a*x.indices.length+b]
          for(let j=0;j<m;j++){
            const y=maps[j],v=cable.hessian[i*m+j]*x.derivatives[a]
            if(v!==0)for(let b=0;b<y.indices.length;b++)H[ia*nd+y.indices[b]]+=v*y.derivatives[b]
          }
        }
      }
    }
    return {energy,gradient,H,positions,tendon,stress,minJ,maxStress,maxPenetration,contacts,cableTension:cable.tension}
  }
  private frame(q:Float64Array,pull:number,residual:number,iterations:number,converged:boolean,message?:string):GripperFrame {
    const s=this.assemble(q,false),tip=s.positions[this.mesh.tipSensor],ref=this.mesh.reference[this.mesh.tipSensor]
    return {pull,positions:s.positions,tendon:s.tendon,contacts:s.contacts,stress:s.stress,tip,tipDeflection:tip[1]-ref[1],
      actuatorForce:[s.gradient[this.actuatorDof],s.gradient[this.actuatorDof+1]],tension:s.cableTension,energy:s.energy,minJ:s.minJ,maxStress:s.maxStress,maxPenetration:s.maxPenetration,
      activeContacts:s.contacts.filter(c=>c.active).length,residual,iterations,converged,message}
  }
  /** Advance prescribed pull. On any failure, retain the previous equilibrium. */
  step(target:number):GripperFrame {
    if(!Number.isFinite(target)||target<0||target>this.params.pull+1e-12)return {...this.last,converged:false,message:'驱动位移超出设定范围'}
    const trial=new Float64Array(this.q),initialActuator=this.mesh.reference[this.mesh.guides[0]][0]-this.restLengths[0]
    trial[this.actuatorDof]=initialActuator-target
    const free=this.free,n=free.length,tolerance=2e-7,maxIterations=55
    let q=trial,residual=Infinity,iterations=0,reason='Newton 未收敛，已回滚至上一平衡态。'
    try {
      for(let it=0;it<maxIterations;it++){
        const assembled=this.assemble(q,true),g=assembled.gradient,H=assembled.H!,rhs=new Float64Array(n),A=new Float64Array(n*n)
        let squared=0;for(let i=0;i<n;i++){const value=g[free[i]];rhs[i]=-value;squared+=value*value}
        residual=Math.sqrt(squared);iterations=it
        if(residual<tolerance){this.q=q;this.pull=target;this.last=this.frame(q,target,residual,it,true);return this.last}
        for(let i=0;i<n;i++)for(let j=0;j<n;j++)A[i*n+j]=H[free[i]*q.length+free[j]]
        let delta:Float64Array|null=null,shift=0
        for(let attempt=0;attempt<9&&!delta;attempt++){delta=choleskySolve(A,rhs,n,shift);shift=shift===0?1e-5:shift*10}
        if(!delta){reason='切线矩阵无法稳定求解，已回滚。';break}
        let slope=0;for(let i=0;i<n;i++)slope-=rhs[i]*delta[i]
        if(!(slope<0)){reason='无法找到下降方向，已回滚。';break}
        let accepted=false,alpha=1
        for(let line=0;line<24;line++){
          const candidate=new Float64Array(q);for(let i=0;i<n;i++)candidate[free[i]]+=alpha*delta[i]
          try {const next=this.assemble(candidate,false);if(Number.isFinite(next.energy)&&next.energy<=assembled.energy+1e-4*alpha*slope){q=candidate;accepted=true;break}}catch{/* reject inverted trial */}
          alpha*=.5
        }
        if(!accepted){reason='线搜索无法找到有效构型，已回滚。';break}
      }
    }catch(e){reason=`求解失败，已回滚：${e instanceof Error?e.message:String(e)}`}
    return {...this.last,converged:false,residual,iterations,message:reason}
  }
  /** Exposes assembled energy for derivative/force-balance tests. */
  evaluate(q:Float64Array=this.q){return this.assemble(q,true)}
}
