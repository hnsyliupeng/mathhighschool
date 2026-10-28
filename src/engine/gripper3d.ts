/** Three-dimensional soft finger with explicitly meshed open bores.
 * Linear tetrahedral compressible Neo-Hookean solid + elastic tendon segments.
 * Frictionless finite-radius tendon/actual deforming bore triangles use sampled
 * segment-to-triangle penalty contact, assembled on both bodies. This is a
 * quasi-static model; it does not include object contact, self contact or
 * unsampled continuous collision detection. SI units throughout.
 */
export type Vec3=[number,number,number]
export interface Gripper3DParams {young:number;poisson:number;EA:number;bending:number;radius:number;contactPerLength:number;pull:number;step:number;samples:number;meshLevel:1|2}
export const defaultGripper3DParams:Gripper3DParams={young:250000,poisson:.35,EA:30,bending:2e-8,radius:.0004,contactPerLength:4e6,pull:.003,step:.00025,samples:12,meshLevel:1}
export interface Tet3D {nodes:[number,number,number,number];gradients:[Vec3,Vec3,Vec3,Vec3];volume:number}
export interface Surface3D {nodes:[number,number,number];tet:number;wall:-1|0|1|2|3}
export interface Mesh3D {reference:Vec3[];tets:Tet3D[];surface:Surface3D[];walls:Surface3D[];fixed:number[];anchor:number[];length:number;hole:{y0:number;y1:number;z0:number;z1:number}}
export interface Contact3D {point:Vec3;wallPoint:Vec3;force:Vec3;penetration:number;gap:number;wall:0|1|2|3;triangle:[number,number,number]}
export interface Frame3D {pull:number;positions:Vec3[];tendon:Vec3[];stress:number[];contacts:Contact3D[];tip:Vec3;tipDeflection:number;tension:number;energy:number;minJ:number;maxStress:number;maxPenetration:number;checkPenetration:number;contactForce:number;anchorSlip:number;forceBalance:number;residual:number;iterations:number;linearIterations:number;converged:boolean;message?:string}
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s]
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const norm=(a:Vec3)=>Math.hypot(...a)
function inverse3(m:number[]){
  const [a,b,c,d,e,f,g,h,i]=m,det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g)
  if(Math.abs(det)<1e-18||!Number.isFinite(det))throw Error('Degenerate 3D element')
  return {det,inv:[(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det,(f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det,(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]}
}
function makeTet(reference:Vec3[],nodes0:[number,number,number,number]):Tet3D{
  let nodes:[number,number,number,number]=[...nodes0]
  const build=()=>{const [a,b,c,d]=nodes.map(i=>reference[i]),u=sub(b,a),v=sub(c,a),w=sub(d,a);return inverse3([u[0],v[0],w[0],u[1],v[1],w[1],u[2],v[2],w[2]])}
  let result=build();if(result.det<0){nodes=[nodes[0],nodes[2],nodes[1],nodes[3]];result=build()}
  const x=result.inv,g1:Vec3=[x[0],x[1],x[2]],g2:Vec3=[x[3],x[4],x[5]],g3:Vec3=[x[6],x[7],x[8]],g0:Vec3=[-g1[0]-g2[0]-g3[0],-g1[1]-g2[1]-g3[1],-g1[2]-g2[2]-g3[2]]
  return {nodes,gradients:[g0,g1,g2,g3],volume:result.det/6}
}
/** Three hollow pads connected by a continuous backbone. The rectangular
 * through-bores are actual missing volumes, not embedded guide points. */
export function makeGripper3DMesh(level:1|2=1):Mesh3D {
  if(level!==1&&level!==2)throw Error('Invalid 3D mesh level')
  const baseX=Array.from({length:13},(_,i)=>.08*i/12),baseY=[0,.0035,.007,.0097,.0113,.014],baseZ=[0,.0032,.0048,.008]
  const subdivide=(a:number[])=>a.flatMap((v,i)=>i===a.length-1?[v]:Array.from({length:level},(_,j)=>v+(a[i+1]-v)*j/level))
  const X=subdivide(baseX),Y=subdivide(baseY),Z=subdivide(baseZ)
  const reference:Vec3[]=[],ids=new Map<string,number>(),tets:Tet3D[]=[],hole={y0:baseY[3],y1:baseY[4],z0:baseZ[1],z1:baseZ[2]}
  const node=(i:number,j:number,k:number)=>{const key=`${i},${j},${k}`,old=ids.get(key);if(old!==undefined)return old;const id=reference.length;reference.push([X[i],Y[j],Z[k]]);ids.set(key,id);return id}
  const occupiedPad=(i:number)=>{const n=Math.floor(i/level);return n<3||(n>=5&&n<8)||n>=10}
  for(let i=0;i<X.length-1;i++)for(let j=0;j<Y.length-1;j++)for(let k=0;k<Z.length-1;k++){
    if(j>=2*level&&!occupiedPad(i))continue
    if(occupiedPad(i)&&Math.floor(j/level)===3&&Math.floor(k/level)===1)continue // actual lumen
    const v=[node(i,j,k),node(i+1,j,k),node(i+1,j+1,k),node(i,j+1,k),node(i,j,k+1),node(i+1,j,k+1),node(i+1,j+1,k+1),node(i,j+1,k+1)]
    for(const c of [[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]])tets.push(makeTet(reference,[v[c[0]],v[c[1]],v[c[2]],v[c[3]]]))
  }
  const faces=new Map<string,{nodes:[number,number,number];tet:number;count:number}>()
  tets.forEach((tet,ti)=>{const n=tet.nodes;for(const [a,b,c,opposite] of [[n[1],n[2],n[3],n[0]],[n[0],n[3],n[2],n[1]],[n[0],n[1],n[3],n[2]],[n[0],n[2],n[1],n[3]]]){
    const key=[a,b,c].sort((x,y)=>x-y).join(':'),old=faces.get(key);if(old){old.count++;continue}
    const p=reference[a],q=reference[b],r=reference[c],normal=cross(sub(q,p),sub(r,p));const outward=dot(normal,sub(reference[opposite],p))>0?[a,c,b]:[a,b,c]
    faces.set(key,{nodes:outward as [number,number,number],tet:ti,count:1})
  }})
  if([...faces.values()].some(f=>f.count>2))throw Error('Non-manifold 3D mesh')
  const close=(a:number,b:number)=>Math.abs(a-b)<1e-10,within=(x:number,a:number,b:number)=>x>=a-1e-10&&x<=b+1e-10
  const surface:Surface3D[]=[]
  for(const f of faces.values())if(f.count===1){
    const p=f.nodes.map(i=>reference[i]);let wall:-1|0|1|2|3=-1
    if(p.every(q=>close(q[1],hole.y0)&&within(q[2],hole.z0,hole.z1)))wall=0
    if(p.every(q=>close(q[1],hole.y1)&&within(q[2],hole.z0,hole.z1)))wall=1
    if(p.every(q=>close(q[2],hole.z0)&&within(q[1],hole.y0,hole.y1)))wall=2
    if(p.every(q=>close(q[2],hole.z1)&&within(q[1],hole.y0,hole.y1)))wall=3
    surface.push({...f,wall})
  }
  const fixed=reference.map((p,i)=>p[0]===0?i:-1).filter(i=>i>=0)
  const anchor=[[12,3,1],[12,3,2],[12,4,1],[12,4,2]].map(([i,j,k])=>{const found=ids.get(`${i*level},${j*level},${k*level}`);if(found===undefined)throw Error('Missing 3D anchor');return found})
  return {reference,tets,surface,walls:surface.filter(f=>f.wall!==-1),fixed,anchor,length:.08,hole}
}

/** Exact first Piola force and consistent 3-D tangent for one tetrahedron. */
export function neoHookeanTet(positions:readonly Vec3[],tet:Tet3D,E:number,nu:number,withHessian=true){
  if(!Number.isFinite(E)||E<=0||!Number.isFinite(nu)||nu<0||nu>=.49)throw Error('Invalid 3D material')
  const mu=E/(2*(1+nu)),lambda=E*nu/((1+nu)*(1-2*nu)),F=new Array<number>(9).fill(0)
  for(let a=0;a<4;a++){const x=positions[tet.nodes[a]],g=tet.gradients[a];for(let i=0;i<3;i++)for(let j=0;j<3;j++)F[3*i+j]+=x[i]*g[j]}
  const {det:J,inv}=inverse3(F);if(!(J>1e-8))throw Error('Inverted 3D element')
  const invT=[inv[0],inv[3],inv[6],inv[1],inv[4],inv[7],inv[2],inv[5],inv[8]],ln=Math.log(J),c=lambda*ln-mu
  const P=F.map((v,i)=>mu*v+c*invT[i]),energy=tet.volume*(.5*mu*(F.reduce((s,v)=>s+v*v,0)-3)-mu*ln+.5*lambda*ln*ln)
  const u=tet.gradients.map(g=>[0,1,2].map(i=>invT[3*i]*g[0]+invT[3*i+1]*g[1]+invT[3*i+2]*g[2])),gradient=new Array<number>(12).fill(0),hessian=withHessian?new Array<number>(144).fill(0):[]
  for(let a=0;a<4;a++)for(let i=0;i<3;i++){
    const g=tet.gradients[a];gradient[3*a+i]=tet.volume*(P[3*i]*g[0]+P[3*i+1]*g[1]+P[3*i+2]*g[2])
    if(withHessian)for(let b=0;b<4;b++)for(let k=0;k<3;k++)hessian[(3*a+i)*12+3*b+k]=tet.volume*(mu*(i===k?dot(tet.gradients[a],tet.gradients[b]):0)+(mu-lambda*ln)*u[b][i]*u[a][k]+lambda*u[a][i]*u[b][k])
  }
  const sigma=new Array<number>(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)sigma[3*i+j]+=P[3*i+k]*F[3*j+k]/J
  const mean=(sigma[0]+sigma[4]+sigma[8])/3;let dev2=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++){const v=sigma[3*i+j]-(i===j?mean:0);dev2+=v*v}
  return {energy,gradient,hessian,J,vonMises:Math.sqrt(1.5*dev2)}
}

/** Oriented actual wall triangle: normal points from solid into the bore.
 * Returns null if the perpendicular projection is outside the triangle. */
export function wallContactGeometry(a:Vec3,b:Vec3,c:Vec3,p:Vec3){
  const ab=sub(b,a),ac=sub(c,a),raw=cross(ab,ac),length=norm(raw);if(!(length>1e-15))throw Error('Degenerate bore triangle')
  const n=scale(raw,1/length),gap=dot(sub(p,a),n),projection=sub(p,scale(n,gap)),ap=sub(projection,a)
  const aa=dot(ab,ab),bb=dot(ab,ac),cc=dot(ac,ac),d=dot(ap,ab),e=dot(ap,ac),den=aa*cc-bb*bb
  if(!(den>1e-26))throw Error('Degenerate bore triangle')
  const v=(cc*d-bb*e)/den,w=(aa*e-bb*d)/den,u=1-v-w
  if(u<-1e-8||v<-1e-8||w<-1e-8)return null
  return {gap,normal:n,bary:[u,v,w] as Vec3,projection}
}
export function wallPenalty(a:Vec3,b:Vec3,c:Vec3,p:Vec3,radius:number,stiffness:number){
  if(![...a,...b,...c,...p,radius,stiffness].every(Number.isFinite)||radius<=0||stiffness<=0)throw Error('Invalid 3D wall contact properties')
  const geometry=wallClosestGeometry(a,b,c,p);if(!geometry)return null
  const penetration=Math.max(0,radius-geometry.gap),force=scale(geometry.normal,stiffness*penetration),gradient=new Array<number>(12).fill(0)
  for(let v=0;v<3;v++)for(let d=0;d<3;d++)gradient[3*v+d]=force[d]*geometry.bary[v]
  for(let d=0;d<3;d++)gradient[9+d]=-force[d]
  return {energy:.5*stiffness*penetration**2,gradient,penetration,force,...geometry}
}

interface CableEdge {a:number;b:number;matrix:Float64Array}
interface ContactTerm {indices:number[];derivative:Float64Array;stiffness:number}
interface Assembly3D {energy:number;gradient:Float64Array;diag:Float64Array;elements:Float64Array[];edges:CableEdge[];contacts:ContactTerm[];positions:Vec3[];tendon:Vec3[];stress:number[];contactInfo:Contact3D[];minJ:number;maxStress:number;maxPenetration:number;contactForce:number;tension:number;anchorSlip:number}
function vec(q:Float64Array,node:number):Vec3{return [q[3*node],q[3*node+1],q[3*node+2]]}
function scatter(g:Float64Array,id:number,v:Vec3,factor=1){for(let d=0;d<3;d++)g[3*id+d]+=factor*v[d]}

export class TendonGripper3D {
  readonly params:Gripper3DParams;readonly mesh:Mesh3D;readonly cableStart:number;readonly cableCount:number;readonly restLengths:number[];readonly fixedDofs:Uint8Array;readonly tipSensor:number[];readonly tetDofs:Int32Array[];readonly anchorStiffness=10000
  q:Float64Array;pull=0;last:Frame3D
  constructor(params:Gripper3DParams=defaultGripper3DParams){
    this.params={...params};const p=this.params
    if(!Object.values(p).every(Number.isFinite)||p.young<=0||p.poisson<0||p.poisson>=.49||p.EA<=0||p.bending<=0||p.radius<=0||p.radius>=.0008||p.contactPerLength<=0||p.pull<0||p.step<=0||!Number.isInteger(p.samples)||p.samples<1||p.samples>12||(p.meshLevel!==1&&p.meshLevel!==2))throw Error('Invalid 3D gripper parameters')
    this.mesh=makeGripper3DMesh(p.meshLevel);this.tetDofs=this.mesh.tets.map(t=>Int32Array.from(t.nodes.flatMap(id=>[3*id,3*id+1,3*id+2])));this.cableStart=this.mesh.reference.length;this.cableCount=24
    this.q=new Float64Array(3*(this.cableStart+this.cableCount));this.mesh.reference.forEach((x,i)=>{this.q[3*i]=x[0];this.q[3*i+1]=x[1];this.q[3*i+2]=x[2]})
    for(let i=0;i<this.cableCount;i++){const j=this.cableStart+i;this.q[3*j]=-.012+i*.004;this.q[3*j+1]=.0105;this.q[3*j+2]=.004}
    this.restLengths=Array.from({length:this.cableCount-1},(_,i)=>norm(sub(vec(this.q,this.cableStart+i+1),vec(this.q,this.cableStart+i))))
    this.fixedDofs=new Uint8Array(this.q.length);for(const i of [...this.mesh.fixed,this.cableStart])for(let d=0;d<3;d++)this.fixedDofs[3*i+d]=1
    this.tipSensor=this.mesh.reference.map((p,i)=>Math.abs(p[0]-.08)<1e-10&&Math.abs(p[1]-.0035)<1e-10&&(Math.abs(p[2]-.0032)<1e-10||Math.abs(p[2]-.0048)<1e-10)?i:-1).filter(i=>i>=0)
    if(this.tipSensor.length!==2)throw Error('3D tip sensor missing')
    this.last=this.makeFrame(this.q,0,0,0,0,true)
  }
  private assemble(q:Float64Array,withTangent:boolean):Assembly3D {
    const nd=q.length,g=new Float64Array(nd),diag=new Float64Array(nd),elements:Float64Array[]=[],edges:CableEdge[]=[],contacts:ContactTerm[]=[]
    const positions=this.mesh.reference.map((_,i)=>vec(q,i)),tendon=Array.from({length:this.cableCount},(_,i)=>vec(q,this.cableStart+i)),stress:number[]=[],contactInfo:Contact3D[]=[]
    let energy=0,minJ=Infinity,maxStress=0,maxPenetration=0,contactForce=0,tension=0
    for(const tet of this.mesh.tets){
      const e=neoHookeanTet(positions,tet,this.params.young,this.params.poisson,withTangent);energy+=e.energy;minJ=Math.min(minJ,e.J);maxStress=Math.max(maxStress,e.vonMises);stress.push(e.vonMises)
      for(let a=0;a<4;a++)for(let d=0;d<3;d++){const k=3*tet.nodes[a]+d;g[k]+=e.gradient[3*a+d];if(withTangent)diag[k]+=e.hessian[(3*a+d)*12+3*a+d]}
      if(withTangent)elements.push(Float64Array.from(e.hessian))
    }
    for(let i=0;i<this.cableCount-1;i++){
      const a=this.cableStart+i,b=a+1,d=sub(tendon[i+1],tendon[i]),l=norm(d),l0=this.restLengths[i];if(!(l>1e-10))throw Error('Collapsed tendon edge')
      const t=scale(d,1/l),extension=Math.max(0,l-l0),k=this.params.EA/l0,T=k*extension
      if(i===0)tension=T
      if(extension>0){
        energy+=.5*k*extension*extension;scatter(g,a,t,-T);scatter(g,b,t,T)
        if(withTangent){const H=new Float64Array(9),fraction=extension/l;for(let x=0;x<3;x++)for(let y=0;y<3;y++)H[3*x+y]=k*(t[x]*t[y]+fraction*((x===y?1:0)-t[x]*t[y]));edges.push({a,b,matrix:H});for(let d0=0;d0<3;d0++){diag[3*a+d0]+=H[3*d0+d0];diag[3*b+d0]+=H[3*d0+d0]}}
      }
    }
    for(let i=1;i<this.cableCount-1;i++){
      const a=this.cableStart+i-1,b=a+1,c=a+2,h=(this.restLengths[i-1]+this.restLengths[i])/2,k=this.params.bending/(h*h*h),v=add(sub(tendon[i-1],scale(tendon[i],2)),tendon[i+1])
      energy+=.5*k*dot(v,v);scatter(g,a,v,k);scatter(g,b,v,-2*k);scatter(g,c,v,k)
      if(withTangent)for(let d=0;d<3;d++){diag[3*a+d]+=k;diag[3*b+d]+=4*k;diag[3*c+d]+=k}
    }
    const anchor=this.mesh.anchor.reduce((v,id)=>add(v,scale(positions[id],.25)),[0,0,0] as Vec3),tipId=this.cableStart+this.cableCount-1,offset=sub(tendon.at(-1)!,anchor),anchorSlip=norm(offset),anchorK=this.anchorStiffness
    energy+=.5*anchorK*dot(offset,offset);scatter(g,tipId,offset,anchorK);for(const id of this.mesh.anchor)scatter(g,id,offset,-anchorK*.25)
    if(withTangent)for(let d=0;d<3;d++){diag[3*tipId+d]+=anchorK;for(const id of this.mesh.anchor)diag[3*id+d]+=anchorK/16}
    // Integrate penalty energy along the tendon, sampled at Gauss-like
    // midpoints. Each side chooses one projected triangle to prevent double
    // counting at triangulation diagonals. Contact nodes act on BOTH meshes.
    for(let i=0;i<this.cableCount-1;i++)for(let sample=0;sample<this.params.samples;sample++){
      const t=(sample+.5)/this.params.samples,p=add(scale(tendon[i],1-t),scale(tendon[i+1],t)),best:(null|{face:Surface3D;geo:NonNullable<ReturnType<typeof wallClosestGeometry>>})[]=[null,null,null,null]
      for(const face of this.mesh.walls){
        const [a,b,c]=face.nodes.map(id=>positions[id]),xmin=Math.min(a[0],b[0],c[0])-.004,xmax=Math.max(a[0],b[0],c[0])+.004
        if(p[0]<xmin||p[0]>xmax)continue
        const geo=wallClosestGeometry(a,b,c,p);if(!geo)continue
        const side=face.wall as 0|1|2|3;if(!best[side]||geo.distance<best[side]!.geo.distance)best[side]={face,geo}
      }
      const k=this.params.contactPerLength*this.restLengths[i]/this.params.samples
      const used:Vec3[]=[]
      for(const hit of best)if(hit){
        // Only nearby surfaces participate; without continuous collision
        // detection very large trial displacements can still tunnel.
        if(hit.geo.distance>this.params.radius*3)continue
        if(used.some(v=>norm(sub(v,hit.geo.projection))<1e-10))continue
        const pen=Math.max(0,this.params.radius-hit.geo.gap);if(!pen)continue
        used.push(hit.geo.projection)
        const normal=hit.geo.normal,force=scale(normal,k*pen),indices=[...hit.face.nodes,this.cableStart+i,this.cableStart+i+1],weights=[-hit.geo.bary[0],-hit.geo.bary[1],-hit.geo.bary[2],1-t,t],dofs:number[]=[],derivative=new Float64Array(15)
        energy+=.5*k*pen*pen;maxPenetration=Math.max(maxPenetration,pen);contactForce+=k*pen
        indices.forEach((node,j)=>{for(let d=0;d<3;d++){const index=3*node+d,v=weights[j]*normal[d];dofs.push(index);derivative[3*j+d]=v;g[index]-=k*pen*v;if(withTangent)diag[index]+=k*v*v}})
        if(withTangent)contacts.push({indices:dofs,derivative,stiffness:k})
        contactInfo.push({point:p,wallPoint:hit.geo.projection,force,penetration:pen,gap:hit.geo.gap,wall:hit.face.wall as 0|1|2|3,triangle:hit.face.nodes})
      }
    }
    if(!Number.isFinite(energy)||!g.every(Number.isFinite))throw Error('Non-finite 3D state')
    return {energy,gradient:g,diag,elements,edges,contacts,positions,tendon,stress,contactInfo,minJ,maxStress,maxPenetration,contactForce,tension,anchorSlip}
  }
  private multiply(x:Float64Array,out:Float64Array,A:Assembly3D,shift:number){
    out.fill(0)
    for(let it=0;it<this.mesh.tets.length;it++){
      const H=A.elements[it],ids=this.tetDofs[it]
      for(let a=0;a<12;a++){let sum=0;const offset=12*a;for(let b=0;b<12;b++)sum+=H[offset+b]*x[ids[b]];out[ids[a]]+=sum}
    }
    for(const {a,b,matrix:H} of A.edges){const d=[x[3*b]-x[3*a],x[3*b+1]-x[3*a+1],x[3*b+2]-x[3*a+2]];for(let i=0;i<3;i++){const value=H[3*i]*d[0]+H[3*i+1]*d[1]+H[3*i+2]*d[2];out[3*a+i]-=value;out[3*b+i]+=value}}
    for(let i=1;i<this.cableCount-1;i++){
      const a=this.cableStart+i-1,b=a+1,c=a+2,h=(this.restLengths[i-1]+this.restLengths[i])/2,k=this.params.bending/(h*h*h)
      for(let d=0;d<3;d++){const v=k*(x[3*a+d]-2*x[3*b+d]+x[3*c+d]);out[3*a+d]+=v;out[3*b+d]-=2*v;out[3*c+d]+=v}
    }
    const tip=this.cableStart+this.cableCount-1
    for(let d=0;d<3;d++){let v=x[3*tip+d];for(const id of this.mesh.anchor)v-=.25*x[3*id+d];v*=this.anchorStiffness;out[3*tip+d]+=v;for(const id of this.mesh.anchor)out[3*id+d]-=.25*v}
    for(const c of A.contacts){let v=0;for(let i=0;i<15;i++)v+=c.derivative[i]*x[c.indices[i]];v*=c.stiffness;for(let i=0;i<15;i++)out[c.indices[i]]+=c.derivative[i]*v}
    for(let i=0;i<out.length;i++)out[i]=this.fixedDofs[i]?x[i]:out[i]+shift*x[i]
  }
  /** Incomplete Cholesky on the lower sparsity pattern of the actual tangent.
   * This is a preconditioner only; the matrix-free PCG still multiplies the
   * full assembled tangent. Diagonal safeguards do not change the model. */
  private incompleteCholesky(A:Assembly3D,shift:number){
    const n=this.q.length,rows=Array.from({length:n},()=>new Map<number,number>())
    const add=(i:number,j:number,value:number)=>{
      if(this.fixedDofs[i]||this.fixedDofs[j]||value===0)return
      if(j>i){const tmp=i;i=j;j=tmp}
      const row=rows[i];row.set(j,(row.get(j)||0)+value)
    }
    for(let t=0;t<this.mesh.tets.length;t++){
      const ids=this.tetDofs[t],H=A.elements[t]
      for(let i=0;i<12;i++)for(let j=0;j<=i;j++)add(ids[i],ids[j],H[12*i+j])
    }
    for(const {a,b,matrix:H} of A.edges){
      const ids=[3*a,3*a+1,3*a+2,3*b,3*b+1,3*b+2]
      for(let i=0;i<6;i++)for(let j=0;j<=i;j++)add(ids[i],ids[j],(Math.floor(i/3)===Math.floor(j/3)?1:-1)*H[3*(i%3)+(j%3)])
    }
    for(let i=1;i<this.cableCount-1;i++){
      const a=this.cableStart+i-1,h=(this.restLengths[i-1]+this.restLengths[i])/2,k=this.params.bending/(h*h*h),weights=[1,-2,1]
      for(let d=0;d<3;d++)for(let u=0;u<3;u++)for(let v=0;v<=u;v++)add(3*(a+u)+d,3*(a+v)+d,k*weights[u]*weights[v])
    }
    const nodes=[...this.mesh.anchor,this.cableStart+this.cableCount-1],weights=[-.25,-.25,-.25,-.25,1]
    for(let d=0;d<3;d++)for(let i=0;i<nodes.length;i++)for(let j=0;j<=i;j++)add(3*nodes[i]+d,3*nodes[j]+d,this.anchorStiffness*weights[i]*weights[j])
    for(const c of A.contacts)for(let i=0;i<c.indices.length;i++)for(let j=0;j<=i;j++)add(c.indices[i],c.indices[j],c.stiffness*c.derivative[i]*c.derivative[j])
    for(let i=0;i<n;i++)rows[i].set(i,this.fixedDofs[i]?1:(rows[i].get(i)||0)+shift)
    const starts=new Int32Array(n+1);for(let i=0;i<n;i++)starts[i+1]=starts[i]+rows[i].size
    const cols=new Int32Array(starts[n]),values=new Float64Array(starts[n]),diags=new Int32Array(n)
    for(let i=0;i<n;i++){
      const ordered=[...rows[i].entries()].sort((a,b)=>a[0]-b[0]);let p=starts[i]
      for(const [j,v] of ordered){cols[p]=j;values[p]=v;if(i===j)diags[i]=p;p++}
    }
    for(let i=0;i<n;i++){
      const begin=starts[i],end=diags[i],original=values[end];let square=0
      for(let p=begin;p<end;p++){
        const j=cols[p];let a=begin,b=starts[j],sum=0
        while(a<p&&b<diags[j]){const x=cols[a],y=cols[b];if(x===y){sum+=values[a]*values[b];a++;b++}else if(x<y)a++;else b++}
        const v=(values[p]-sum)/values[diags[j]];values[p]=v;square+=v*v
      }
      // A positive floor keeps the preconditioner SPD when an incomplete
      // factorization breaks down; this never modifies the true operator.
      values[end]=Math.sqrt(Math.max(original-square,Math.abs(original)*.03,1e-8))
    }
    return (r:Float64Array,z:Float64Array)=>{
      for(let i=0;i<n;i++){let v=r[i];for(let p=starts[i];p<diags[i];p++)v-=values[p]*z[cols[p]];z[i]=v/values[diags[i]]}
      for(let i=n-1;i>=0;i--){z[i]/=values[diags[i]];const v=z[i];for(let p=starts[i];p<diags[i];p++)z[cols[p]]-=values[p]*v}
    }
  }
  private linearSolve(A:Assembly3D,shift:number){
    const n=this.q.length,x=new Float64Array(n),r=new Float64Array(n),z=new Float64Array(n),p=new Float64Array(n),Ap=new Float64Array(n),precondition=this.incompleteCholesky(A,shift)
    let rr=0,rz=0
    for(let i=0;i<n;i++){r[i]=this.fixedDofs[i]?0:-A.gradient[i];rr+=r[i]*r[i]}
    precondition(r,z);for(let i=0;i<n;i++){p[i]=z[i];rz+=r[i]*z[i]}
    const initial=Math.sqrt(rr);if(initial<1e-14)return {x,iterations:0,ok:true,relative:0}
    let iteration=0,relative=1
    for(;iteration<600;iteration++){
      this.multiply(p,Ap,A,shift);let pAp=0;for(let i=0;i<n;i++)pAp+=p[i]*Ap[i]
      if(!(pAp>1e-24)||!Number.isFinite(pAp))return {x,iterations:iteration,ok:false,relative}
      const alpha=rz/pAp;rr=0
      for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*Ap[i];rr+=r[i]*r[i]}
      relative=Math.sqrt(rr)/initial
      if(relative<.001)return {x,iterations:iteration+1,ok:true,relative}
      precondition(r,z);let next=0;for(let i=0;i<n;i++)next+=r[i]*z[i]
      const beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rz=next
    }
    return {x,iterations:iteration,ok:relative<.05,relative}
  }
  /** A separate, denser post-check: it does not add forces or constitute CCD. */
  private checkPenetration(positions:Vec3[],tendon:Vec3[],count=64){
    let maximum=0
    for(let i=0;i<tendon.length-1;i++)for(let j=0;j<=count;j++){
      const t=j/count,p=add(scale(tendon[i],1-t),scale(tendon[i+1],t)),best:(null|NonNullable<ReturnType<typeof wallClosestGeometry>>)[]=[null,null,null,null]
      for(const face of this.mesh.walls){
        const [a,b,c]=face.nodes.map(id=>positions[id]),xmin=Math.min(a[0],b[0],c[0])-.004,xmax=Math.max(a[0],b[0],c[0])+.004
        if(p[0]<xmin||p[0]>xmax)continue
        const geo=wallClosestGeometry(a,b,c,p),side=face.wall as 0|1|2|3
        if(geo&&(!best[side]||geo.distance<best[side]!.distance))best[side]=geo
      }
      for(const geo of best)if(geo&&geo.distance<=3*this.params.radius)maximum=Math.max(maximum,this.params.radius-geo.gap)
    }
    return Math.max(0,maximum)
  }
  private makeFrame(q:Float64Array,pull:number,residual:number,iterations:number,linearIterations:number,converged:boolean,message?:string):Frame3D {
    const a=this.assemble(q,false),tip=scale(add(a.positions[this.tipSensor[0]],a.positions[this.tipSensor[1]]),.5),reference=scale(add(this.mesh.reference[this.tipSensor[0]],this.mesh.reference[this.tipSensor[1]]),.5)
    const support:Vec3=[0,0,0];for(let i=0;i<this.fixedDofs.length;i++)if(this.fixedDofs[i])support[i%3]+=a.gradient[i]
    return {pull,positions:a.positions,tendon:a.tendon,stress:a.stress,contacts:a.contactInfo,tip,tipDeflection:tip[1]-reference[1],tension:a.tension,energy:a.energy,minJ:a.minJ,maxStress:a.maxStress,maxPenetration:a.maxPenetration,checkPenetration:this.checkPenetration(a.positions,a.tendon),contactForce:a.contactForce,anchorSlip:a.anchorSlip,forceBalance:norm(support),residual,iterations,linearIterations,converged,message}
  }
  step(target:number):Frame3D{
    if(!Number.isFinite(target)||target<0||target>this.params.pull+1e-12)return {...this.last,converged:false,message:'驱动位移超出范围'}
    if(Math.abs(target-this.pull)>this.params.step+1e-12)return {...this.last,converged:false,message:'驱动增量过大，已回滚；请减小加载步长。'}
    const trial=new Float64Array(this.q);trial[3*this.cableStart]=-.012-target
    let q=trial,residual=Infinity,iterations=0,totalLinear=0,reason='三维平衡未收敛，已回滚。'
    try{
      for(let it=0;it<35;it++){
        const A=this.assemble(q,true);let sum=0;for(let i=0;i<q.length;i++)if(!this.fixedDofs[i])sum+=A.gradient[i]*A.gradient[i]
        residual=Math.sqrt(sum);iterations=it
        if(residual<2e-5){this.q=q;this.pull=target;this.last=this.makeFrame(q,target,residual,it,totalLinear,true);return this.last}
        let solution:ReturnType<TendonGripper3D['linearSolve']>|null=null
        for(const shift of [0,.1,1,10,100]){const attempt=this.linearSolve(A,shift);totalLinear+=attempt.iterations;if(attempt.ok){solution=attempt;break}}
        if(!solution){reason='三维线性迭代未收敛，已回滚。';break}
        let slope=0;for(let i=0;i<q.length;i++)if(!this.fixedDofs[i])slope+=A.gradient[i]*solution.x[i]
        if(!(slope<0)){reason='无法获得下降方向，已回滚。';break}
        let alpha=1,accepted=false
        for(let line=0;line<18;line++){
          const candidate=new Float64Array(q);for(let i=0;i<q.length;i++)if(!this.fixedDofs[i])candidate[i]+=alpha*solution.x[i]
          try{const next=this.assemble(candidate,false);if(next.energy<=A.energy+1e-4*alpha*slope){q=candidate;accepted=true;break}}catch{/* inverted tetrahedra and singular contacts are rejected */}
          alpha*=.5
        }
        if(!accepted){reason='三维线搜索失败，已回滚。';break}
      }
    }catch(e){reason=`三维求解失败，已回滚：${e instanceof Error?e.message:String(e)}`}
    return {...this.last,converged:false,residual,iterations,linearIterations:totalLinear,message:reason}
  }
  evaluate(q:Float64Array=this.q){return this.assemble(q,true)}
}
// Closest point on a closed triangle, including its edges and vertices.
// This prevents a discontinuous loss of contact at a triangulation seam or
// the open mouth of a hole (unlike an interior-only projection).
export function wallClosestGeometry(a:Vec3,b:Vec3,c:Vec3,p:Vec3){
  const ab=sub(b,a),ac=sub(c,a),raw=cross(ab,ac),area=norm(raw);if(area<1e-16)return null
  const faceNormal=scale(raw,1/area),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap)
  let bary:[number,number,number]
  if(d1<=0&&d2<=0)bary=[1,0,0]
  else{
    const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp)
    if(d3>=0&&d4<=d3)bary=[0,1,0]
    else{
      const vc=d1*d4-d3*d2
      if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);bary=[1-v,v,0]}
      else{
        const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp)
        if(d6>=0&&d5<=d6)bary=[0,0,1]
        else{
          const vb=d5*d2-d1*d6
          if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);bary=[1-w,0,w]}
          else{
            const va=d3*d6-d5*d4
            if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));bary=[0,1-w,w]}
            else{const denom=1/(va+vb+vc),v=vb*denom,w=vc*denom;bary=[1-v-w,v,w]}
          }
        }
      }
    }
  }
  const projection=add(add(scale(a,bary[0]),scale(b,bary[1])),scale(c,bary[2])),delta=sub(p,projection),distance=norm(delta),sign=dot(delta,faceNormal)<0?-1:1
  return {gap:sign*distance,normal:distance>1e-14?scale(delta,sign/distance):faceNormal,bary,projection,distance,faceNormal}
}
