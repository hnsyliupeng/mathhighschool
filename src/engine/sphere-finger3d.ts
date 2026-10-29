/** Isolated research extension of continuous-gripper3d.ts. In addition to
 * its original tendon/solid constraints, this copy assembles a frictionless
 * fixed-sphere/triangle augmented-Lagrangian contact. The fixed sphere is an
 * externally supported fixture, NOT a freely moving grasped body. Keep the
 * production single-finger implementation and its audits independent. */
import {makeGripper3DMesh,neoHookeanTet,defaultGripper3DParams,type Vec3,type Gripper3DParams,type Mesh3D,type Frame3D} from './gripper3d'
import {segmentTriangleClosest,segmentTriangleFeatures,boxDistance,type SegmentTriangleFeatureKind} from './segment-triangle'
import {Gripper3DSafety,sweptMinTetJ} from './gripper3d-safety'
import {hexesFromStructuredTets,neoHookeanHex,type Hex3D} from './hexahedron'
import {sphereTriangleContact,sphereMotion,referenceTriangleArea,type FixedSphere,type SphereContact} from './hand-object-contact'

/** The interactive demonstrator deliberately loads into a large-curl regime.
 * The legacy sampled solver keeps its original 3 mm default. */
const defaultContinuousGripper3DParams:Gripper3DParams={...defaultGripper3DParams,pull:.01475}

const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s]
const norm=(a:Vec3)=>Math.hypot(...a)
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
function vec(q:Float64Array,node:number):Vec3{return [q[3*node],q[3*node+1],q[3*node+2]]}
function scatter(g:Float64Array,id:number,v:Vec3,factor=1){for(let d=0;d<3;d++)g[3*id+d]+=factor*v[d]}

type WallSide=-1|0|1|2|3
interface ContinuousContact {point:Vec3;wallPoint:Vec3;force:Vec3;penetration:number;gap:number;wall:WallSide;triangle:[number,number,number];segment:number;lambda:number;feature:SegmentTriangleFeatureKind}
interface ContinuousFrame extends Omit<Frame3D,'contacts'> {
  contacts:ContinuousContact[]
  /** Projected rotation of the last 6.67 mm of the backbone, in degrees. */
  tipAngleDeg:number
  minGap:number;complementarity:number;contactConverged:boolean;outerIterations:number
  interiorNodes:number;surfaceIntersections:number;selfIntersections:number;volumeOverlaps:number;solidChecks:number;collisionChecks:number;substeps:number;minPathJ:number;sweptClearance:number;torqueBalance:number
}
export interface SphereFingerFrame extends ContinuousFrame {
  sphereContacts:SphereContact[];spherePenetration:number;sphereMinGap:number;sphereForce:Vec3;sphereComplementarity:number
}
interface CableEdge {a:number;b:number;matrix:Float64Array}
interface ContactTerm {indices:number[];derivative:Float64Array;stiffness:number}
interface Assembly3D {energy:number;gradient:Float64Array;diag:Float64Array;elements:Float64Array[];edges:CableEdge[];contacts:ContactTerm[];positions:Vec3[];tendon:Vec3[];stress:number[];contactInfo:ContinuousContact[];minJ:number;maxStress:number;maxPenetration:number;contactForce:number;tension:number;anchorSlip:number;nextLambda:Float64Array;complementarity:number;nextSphereLambda:Float64Array;sphereContacts:SphereContact[];spherePenetration:number;sphereMinGap:number;sphereForce:Vec3;sphereComplementarity:number}
interface GeometryAudit {minDistance:number;minGap:number;penetration:number;interiorNodes:number;surfaceIntersections:number;collisionChecks:number}

export class SphereFinger3D {
  readonly params:Gripper3DParams;readonly mesh:Mesh3D;readonly cableStart:number;readonly cableCount:number;readonly restLengths:number[];readonly fixedDofs:Uint8Array;readonly tipSensor:number[];readonly precedingTipSensor:number[];readonly solidDofs:Int32Array[];readonly hexes:Hex3D[];readonly element:'tet'|'hex';readonly anchorStiffness=10000
  readonly contactTolerance:number;readonly forceTolerance=2e-5;readonly safety:Gripper3DSafety;readonly sweptClearance:number
  readonly restQ:Float64Array
  q:Float64Array;lambda:Float64Array;sphereLambda:Float64Array;pull=0;last:SphereFingerFrame
  readonly sphere:FixedSphere|null;readonly sphereStiffness:number[]
  constructor(params:Gripper3DParams=defaultContinuousGripper3DParams,sphere:FixedSphere|null=null,element:'tet'|'hex'='hex'){
    this.element=element
    if(sphere&&(![...sphere.center,sphere.radius,sphere.stiffnessPerArea].every(Number.isFinite)||sphere.radius<=0||sphere.stiffnessPerArea<=0))throw Error('Invalid fixed sphere')
    this.sphere=sphere?{...sphere,center:[...sphere.center]}:null
    this.params={...params};const p=this.params
    if(!Object.values(p).every(Number.isFinite)||p.young<=0||p.poisson<0||p.poisson>=.49||p.EA<=0||p.bending<=0||p.radius<=0||p.radius>=.0008||p.contactPerLength<=0||p.pull<0||p.step<=0||(p.meshLevel!==1&&p.meshLevel!==2&&p.meshLevel!==3)||(p.tendonResolution!==1&&p.tendonResolution!==2&&p.tendonResolution!==3))throw Error('Invalid continuous gripper parameters')
    this.contactTolerance=Math.min(2e-8,p.radius*.00005)
    // The motion certificate permits at most 2 µm compression during a
    // Newton path; converged states have the stricter tolerance above.
    this.sweptClearance=Math.max(0,p.radius-Math.min(2e-6,p.radius*.01))
    this.mesh=makeGripper3DMesh(p.meshLevel);this.hexes=element==='hex'?hexesFromStructuredTets(this.mesh):[];this.safety=new Gripper3DSafety(this.mesh,this.hexes)
    this.solidDofs=(element==='hex'?this.hexes:this.mesh.tets).map(t=>Int32Array.from(t.nodes.flatMap(id=>[3*id,3*id+1,3*id+2])));this.cableStart=this.mesh.reference.length;this.cableCount=23*p.tendonResolution+1
    this.lambda=new Float64Array(5*(this.cableCount-1)*this.mesh.surface.length)
    this.sphereLambda=new Float64Array(this.mesh.surface.length)
    this.sphereStiffness=this.mesh.surface.map(face=>(sphere?.stiffnessPerArea||1)*referenceTriangleArea(face.nodes.map(i=>this.mesh.reference[i]) as [Vec3,Vec3,Vec3]))
    this.q=new Float64Array(3*(this.cableStart+this.cableCount));this.mesh.reference.forEach((x,i)=>{this.q[3*i]=x[0];this.q[3*i+1]=x[1];this.q[3*i+2]=x[2]})
    for(let i=0;i<this.cableCount;i++){const j=this.cableStart+i;this.q[3*j]=-.012+i*.004/p.tendonResolution;this.q[3*j+1]=.0105;this.q[3*j+2]=.004}
    this.restQ=this.q.slice()
    this.restLengths=Array.from({length:this.cableCount-1},(_,i)=>norm(sub(vec(this.q,this.cableStart+i+1),vec(this.q,this.cableStart+i))))
    this.fixedDofs=new Uint8Array(this.q.length);for(const i of [...this.mesh.fixed,this.cableStart])for(let d=0;d<3;d++)this.fixedDofs[3*i+d]=1
    this.tipSensor=this.mesh.reference.map((p,i)=>Math.abs(p[0]-.08)<1e-10&&Math.abs(p[1]-.0035)<1e-10&&(Math.abs(p[2]-.0032)<1e-10||Math.abs(p[2]-.0048)<1e-10)?i:-1).filter(i=>i>=0)
    // Always compare the last 1/12 of the original 80 mm backbone, even
    // on refined meshes, so the reported angle is a comparable physical
    // sensor rather than a rendering rotation or mesh-dependent last cell.
    this.precedingTipSensor=this.mesh.reference.map((p,i)=>Math.abs(p[0]-(.08-.08/12))<1e-10&&Math.abs(p[1]-.0035)<1e-10&&(Math.abs(p[2]-.0032)<1e-10||Math.abs(p[2]-.0048)<1e-10)?i:-1).filter(i=>i>=0)
    if(this.tipSensor.length!==2||this.precedingTipSensor.length!==2)throw Error('3D tip angle sensors missing')
    const initial=this.assemble(this.q,false),geometry=this.auditGeometry(initial.positions,initial.tendon),self=this.safety.staticSelf(initial.positions),solid=this.safety.staticSolidOverlap(initial.positions)
    if(geometry.penetration>0||geometry.interiorNodes>0||geometry.surfaceIntersections>0||self.intersections>0||solid.overlaps>0||initial.spherePenetration>0||this.sphereCenterInside(initial.positions))throw Error('Initial 3D configuration intersects the solid or sphere')
    this.last=this.makeFrame(initial,0,0,0,0,true,geometry,0,0,self.checks,self.intersections,solid.overlaps,solid.checks,1)
  }
  private assemble(q:Float64Array,withTangent:boolean):Assembly3D {
    const nd=q.length,g=new Float64Array(nd),diag=new Float64Array(nd),elements:Float64Array[]=[],edges:CableEdge[]=[],contacts:ContactTerm[]=[],nextLambda=new Float64Array(this.lambda.length),nextSphereLambda=new Float64Array(this.sphereLambda.length)
    const positions=this.mesh.reference.map((_,i)=>vec(q,i)),tendon=Array.from({length:this.cableCount},(_,i)=>vec(q,this.cableStart+i)),stress:number[]=[],contactInfo:ContinuousContact[]=[]
    let energy=0,minJ=Infinity,maxStress=0,maxPenetration=0,contactForce=0,tension=0,complementarity=0
    let spherePenetration=0,sphereMinGap=Infinity,sphereComplementarity=0;const sphereContacts:SphereContact[]=[],sphereForce:Vec3=[0,0,0]
    if(this.element==='tet')for(const tet of this.mesh.tets){
      const e=neoHookeanTet(positions,tet,this.params.young,this.params.poisson,withTangent);energy+=e.energy;minJ=Math.min(minJ,e.J);maxStress=Math.max(maxStress,e.vonMises);stress.push(e.vonMises)
      for(let a=0;a<4;a++)for(let d=0;d<3;d++){const k=3*tet.nodes[a]+d;g[k]+=e.gradient[3*a+d];if(withTangent)diag[k]+=e.hessian[(3*a+d)*12+3*a+d]}
      if(withTangent)elements.push(Float64Array.from(e.hessian))
    }
    else for(const hex of this.hexes){
      const e=neoHookeanHex(positions,hex,this.params.young,this.params.poisson,withTangent);energy+=e.energy;minJ=Math.min(minJ,e.minJ);maxStress=Math.max(maxStress,e.vonMises)
      // Rendering uses the same cell's six boundary-tetrahedron records.
      for(let i=0;i<6;i++)stress.push(e.vonMises)
      for(let a=0;a<8;a++)for(let d=0;d<3;d++){const k=3*hex.nodes[a]+d;g[k]+=e.gradient[3*a+d];if(withTangent)diag[k]+=e.hessian[(3*a+d)*24+3*a+d]}
      if(withTangent)elements.push(e.hessian)
    }
    for(let i=0;i<this.cableCount-1;i++){
      const a=this.cableStart+i,b=a+1,d=sub(tendon[i+1],tendon[i]),l=norm(d),l0=this.restLengths[i];if(!(l>1e-10))throw Error('Collapsed tendon edge')
      const t=scale(d,1/l),extension=Math.max(0,l-l0),k=this.params.EA/l0,T=k*extension
      if(i===0)tension=T
      // At exactly zero strain choose the tensile-side generalized tangent;
      // it avoids a nearly singular slack-start Newton system without adding
      // compression energy or force.
      if(extension>0||(withTangent&&extension===0)){energy+=.5*k*extension*extension;scatter(g,a,t,-T);scatter(g,b,t,T)
        if(withTangent){const H=new Float64Array(9),fraction=extension/l;for(let x=0;x<3;x++)for(let y=0;y<3;y++)H[3*x+y]=k*(t[x]*t[y]+fraction*((x===y?1:0)-t[x]*t[y]));edges.push({a,b,matrix:H});for(let d0=0;d0<3;d0++){diag[3*a+d0]+=H[3*d0+d0];diag[3*b+d0]+=H[3*d0+d0]}}}
    }
    for(let i=1;i<this.cableCount-1;i++){
      const a=this.cableStart+i-1,b=a+1,c=a+2,h=(this.restLengths[i-1]+this.restLengths[i])/2,k=this.params.bending/(h*h*h),v=add(sub(tendon[i-1],scale(tendon[i],2)),tendon[i+1])
      energy+=.5*k*dot(v,v);scatter(g,a,v,k);scatter(g,b,v,-2*k);scatter(g,c,v,k)
      if(withTangent)for(let d=0;d<3;d++){diag[3*a+d]+=k;diag[3*b+d]+=4*k;diag[3*c+d]+=k}
    }
    const anchor=this.mesh.anchor.reduce((v,id)=>add(v,scale(positions[id],.25)),[0,0,0] as Vec3),tipId=this.cableStart+this.cableCount-1,offset=sub(tendon.at(-1)!,anchor),anchorSlip=norm(offset),anchorK=this.anchorStiffness
    energy+=.5*anchorK*dot(offset,offset);scatter(g,tipId,offset,anchorK);for(const id of this.mesh.anchor)scatter(g,id,offset,-anchorK*.25)
    if(withTangent)for(let d=0;d<3;d++){diag[3*tipId+d]+=anchorK;for(const id of this.mesh.anchor)diag[3*id+d]+=anchorK/16}
    // The five feature distances are redundant inequalities whose feasible
    // intersection equals the non-crossing full-segment constraint. Separate
    // multipliers remove switches in the MINIMUM feature from the augmented
    // energy. A crossing itself is still rejected using the exact segment–
    // triangle test; no CCD, clearance or static audit is relaxed. At shared
    // edges/vertices the feature multipliers sum to one physical reaction.
    const nfaces=this.mesh.surface.length,featuresPerPair=5
    for(let i=0;i<this.cableCount-1;i++){
      const p0=tendon[i],p1=tendon[i+1],k=this.params.contactPerLength*this.restLengths[i]/featuresPerPair
      for(let j=0;j<nfaces;j++){
        const face=this.mesh.surface[j],base=featuresPerPair*(i*nfaces+j),nodes=face.nodes,[a,b,c]=nodes.map(id=>positions[id])
        let oldMax=0;for(let feature=0;feature<featuresPerPair;feature++)oldMax=Math.max(oldMax,this.lambda[base+feature])
        // The AABB distance is a lower bound on every feature. Pruning is
        // safe even for an active multiplier: lambda-k*gap must then be < 0.
        if(boxDistance([p0,p1],[a,b,c])>this.params.radius+oldMax/k)continue
        if(segmentTriangleClosest(p0,p1,a,b,c).distance<1e-12)throw Error('Tendon axis intersects the solid surface')
        const hits=segmentTriangleFeatures(p0,p1,a,b,c)
        for(let feature=0;feature<featuresPerPair;feature++){
          const hit=hits[feature],gap=hit.distance-this.params.radius,lambda=Math.max(0,this.lambda[base+feature]-k*gap)
          nextLambda[base+feature]=lambda
          const pen=Math.max(0,-gap);maxPenetration=Math.max(maxPenetration,pen);complementarity=Math.max(complementarity,Math.abs(Math.min(gap,lambda/k)))
          if(lambda<=0)continue
          if(hit.distance<1e-12)throw Error('Tendon feature intersects the solid surface')
          const normal=scale(sub(hit.point,hit.surface),1/hit.distance),force=scale(normal,lambda),indices=[...nodes,this.cableStart+i,this.cableStart+i+1],weights=[-hit.bary[0],-hit.bary[1],-hit.bary[2],1-hit.segmentT,hit.segmentT],dofs:number[]=[],derivative=new Float64Array(15)
          energy+=lambda*lambda/(2*k);contactForce+=lambda
          indices.forEach((node,v)=>{for(let d=0;d<3;d++){const index=3*node+d,z=weights[v]*normal[d];dofs.push(index);derivative[3*v+d]=z;g[index]-=lambda*z;if(withTangent)diag[index]+=k*z*z}})
          if(withTangent)contacts.push({indices:dofs,derivative,stiffness:k})
          contactInfo.push({point:hit.point,wallPoint:hit.surface,force,penetration:pen,gap,wall:face.wall,triangle:nodes,segment:i,lambda,feature:hit.kind})
        }
      }
    }
    if(this.sphere)for(let j=0;j<this.mesh.surface.length;j++){
      const face=this.mesh.surface[j],nodes=face.nodes,tri=nodes.map(id=>positions[id]) as [Vec3,Vec3,Vec3],k=this.sphereStiffness[j]
      // Keep an exact minimum-gap diagnostic even for inactive faces. AABB
      // pruning is only used when it cannot change the projected multiplier.
      const lower=boxDistance([this.sphere.center],tri)-this.sphere.radius
      if(lower>0&&lower>this.sphereLambda[j]/k&&lower>=sphereMinGap)continue
      const hit=sphereTriangleContact(this.sphere,tri,k,this.sphereLambda[j])
      sphereMinGap=Math.min(sphereMinGap,hit.gap);spherePenetration=Math.max(spherePenetration,Math.max(0,-hit.gap))
      nextSphereLambda[j]=hit.lambda;sphereComplementarity=Math.max(sphereComplementarity,Math.abs(Math.min(hit.gap,hit.lambda/k)))
      if(hit.lambda<=0)continue
      energy+=hit.energy
      const indices:number[]=[],derivative=new Float64Array(9),force=scale(hit.normal,hit.lambda)
      for(let d=0;d<3;d++)sphereForce[d]+=force[d]
      nodes.forEach((node,v)=>{for(let d=0;d<3;d++){const id=3*node+d,z=hit.bary[v]*hit.normal[d];indices.push(id);derivative[3*v+d]=z;g[id]-=hit.lambda*z;if(withTangent)diag[id]+=k*z*z}})
      if(withTangent)contacts.push({indices,derivative,stiffness:k})
      sphereContacts.push({triangle:nodes,point:hit.point,force,gap:hit.gap,lambda:hit.lambda})
    }
    if(!Number.isFinite(energy)||!g.every(Number.isFinite))throw Error('Non-finite 3D state')
    return {energy,gradient:g,diag,elements,edges,contacts,positions,tendon,stress,contactInfo,minJ,maxStress,maxPenetration,contactForce,tension,anchorSlip,nextLambda,complementarity,nextSphereLambda,sphereContacts,spherePenetration,sphereMinGap,sphereForce,sphereComplementarity}
  }
  private multiply(x:Float64Array,out:Float64Array,A:Assembly3D,shift:number){
    out.fill(0)
    for(let it=0;it<this.solidDofs.length;it++){
      const H=A.elements[it],ids=this.solidDofs[it],n=ids.length
      for(let a=0;a<n;a++){let sum=0;const offset=n*a;for(let b=0;b<n;b++)sum+=H[offset+b]*x[ids[b]];out[ids[a]]+=sum}
    }
    for(const {a,b,matrix:H} of A.edges){const d=[x[3*b]-x[3*a],x[3*b+1]-x[3*a+1],x[3*b+2]-x[3*a+2]];for(let i=0;i<3;i++){const value=H[3*i]*d[0]+H[3*i+1]*d[1]+H[3*i+2]*d[2];out[3*a+i]-=value;out[3*b+i]+=value}}
    for(let i=1;i<this.cableCount-1;i++){
      const a=this.cableStart+i-1,b=a+1,c=a+2,h=(this.restLengths[i-1]+this.restLengths[i])/2,k=this.params.bending/(h*h*h)
      for(let d=0;d<3;d++){const v=k*(x[3*a+d]-2*x[3*b+d]+x[3*c+d]);out[3*a+d]+=v;out[3*b+d]-=2*v;out[3*c+d]+=v}
    }
    const tip=this.cableStart+this.cableCount-1
    for(let d=0;d<3;d++){let v=x[3*tip+d];for(const id of this.mesh.anchor)v-=.25*x[3*id+d];v*=this.anchorStiffness;out[3*tip+d]+=v;for(const id of this.mesh.anchor)out[3*id+d]-=.25*v}
    for(const c of A.contacts){let v=0;for(let i=0;i<c.indices.length;i++)v+=c.derivative[i]*x[c.indices[i]];v*=c.stiffness;for(let i=0;i<c.indices.length;i++)out[c.indices[i]]+=c.derivative[i]*v}
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
    for(let t=0;t<this.solidDofs.length;t++){
      const ids=this.solidDofs[t],H=A.elements[t],n=ids.length
      for(let i=0;i<n;i++)for(let j=0;j<=i;j++)add(ids[i],ids[j],H[n*i+j])
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
      // Strong pivot compensation prevents IC(0) factors from overflowing
      // on nearly slack, highly refined tendon degrees of freedom. This is
      // ONLY a preconditioner; the full matrix-free operator is unchanged.
      values[end]=Math.sqrt(Math.max(original-square,Math.abs(original)*.5,1e-8))
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
  /** Exact spatial segment / all-boundary clearance, plus an independent
   * point-in-tetrahedra check. This is a static check, not time CCD. */
  auditGeometry(positions:Vec3[],tendon:Vec3[]):GeometryAudit {
    const finite=(p:Vec3)=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)
    if(!Array.isArray(positions)||positions.length!==this.mesh.reference.length||!positions.every(finite)||!Array.isArray(tendon)||tendon.length<2||!tendon.every(finite))throw Error('Invalid tendon or solid geometry')
    let minDistance=Infinity,surfaceIntersections=0,collisionChecks=0
    for(let i=0;i<tendon.length-1;i++)for(const face of this.mesh.surface){
      const [a,b,c]=face.nodes.map(id=>positions[id]),lower=boxDistance([tendon[i],tendon[i+1]],[a,b,c])
      if(lower>minDistance&&lower>1e-14)continue
      const hit=segmentTriangleClosest(tendon[i],tendon[i+1],a,b,c);collisionChecks++
      minDistance=Math.min(minDistance,hit.distance);if(hit.intersects)surfaceIntersections++
    }
    let interiorNodes=0
    for(const p of tendon){
      let inside=false
      for(const tet of this.mesh.tets){
        const [a,b,c,d]=tet.nodes.map(id=>positions[id]);let possible=true
        for(let axis=0;axis<3;axis++)if(p[axis]<Math.min(a[axis],b[axis],c[axis],d[axis])-1e-12||p[axis]>Math.max(a[axis],b[axis],c[axis],d[axis])+1e-12){possible=false;break}
        if(!possible)continue
        const ab=sub(b,a),ac=sub(c,a),ad=sub(d,a),v=sub(p,a),det=dot(ab,cross(ac,ad));if(Math.abs(det)<1e-25)continue
        const u=dot(v,cross(ac,ad))/det,w=dot(ab,cross(v,ad))/det,z=dot(ab,cross(ac,v))/det
        if(u>=-1e-10&&w>=-1e-10&&z>=-1e-10&&u+w+z<=1+1e-10){inside=true;break}
      }
      if(inside)interiorNodes++
    }
    return {minDistance,minGap:minDistance-this.params.radius,penetration:Math.max(0,this.params.radius-minDistance),interiorNodes,surfaceIntersections,collisionChecks}
  }
  /** A sphere fully inside the solid has positive boundary distance yet is
   * still invalid. Check its center against every piecewise-linear tet. */
  private sphereCenterInside(positions:Vec3[]):boolean{
    if(!this.sphere)return false
    const p=this.sphere.center
    for(const tet of this.mesh.tets){
      const [a,b,c,d]=tet.nodes.map(i=>positions[i]),ab=sub(b,a),ac=sub(c,a),ad=sub(d,a),v=sub(p,a),det=dot(ab,cross(ac,ad))
      if(!Number.isFinite(det)||Math.abs(det)<1e-25)throw Error('Invalid sphere/solid tet')
      const u=dot(v,cross(ac,ad))/det,w=dot(ab,cross(v,ad))/det,z=dot(ab,cross(ac,v))/det
      if(u>=-1e-10&&w>=-1e-10&&z>=-1e-10&&u+w+z<=1+1e-10)return true
    }
    return false
  }
  private objectMotion(from:Vec3[],to:Vec3[]){
    return this.sphere?sphereMotion(this.sphere,this.mesh.surface,from,to,Math.min(2e-6,this.sphere.radius*.01)):{safe:true,checks:0,reason:'no sphere'}
  }
  private supportMetrics(a:Assembly3D){
    const support:Vec3=[0,0,0],moment:Vec3=[0,0,0]
    for(let node=0;node<this.fixedDofs.length/3;node++){
      const f:Vec3=[0,0,0];for(let d=0;d<3;d++)if(this.fixedDofs[3*node+d])f[d]=a.gradient[3*node+d]
      const p=node<this.cableStart?a.positions[node]:a.tendon[node-this.cableStart],m=cross(p,f)
      for(let d=0;d<3;d++){support[d]+=f[d];moment[d]+=m[d]}
    }
    // support is the energy gradient on prescribed DOFs. Sphere contact
    // contributes an external force on the finger; include it in the global
    // force and moment equilibrium instead of incorrectly treating it as an
    // internal tendon pair.
    for(const contact of a.sphereContacts){const m=cross(contact.point,contact.force);for(let d=0;d<3;d++){support[d]+=contact.force[d];moment[d]+=m[d]}}
    return {force:norm(support),torque:norm(moment)}
  }
  private makeFrame(a:Assembly3D,pull:number,residual:number,iterations:number,linearIterations:number,converged:boolean,geometry:GeometryAudit,outerIterations:number,substeps:number,collisionChecks:number,selfIntersections:number,volumeOverlaps:number,solidChecks:number,minPathJ:number,message?:string):SphereFingerFrame {
    const tip=scale(add(a.positions[this.tipSensor[0]],a.positions[this.tipSensor[1]]),.5),reference=scale(add(this.mesh.reference[this.tipSensor[0]],this.mesh.reference[this.tipSensor[1]]),.5),balance=this.supportMetrics(a)
    const previous=scale(add(a.positions[this.precedingTipSensor[0]],a.positions[this.precedingTipSensor[1]]),.5),direction=sub(tip,previous),tipAngleDeg=Math.atan2(direction[1],direction[0])*180/Math.PI
    let minJ=a.minJ
    if(this.element==='hex')for(const tet of this.mesh.tets)minJ=Math.min(minJ,sweptMinTetJ(tet,a.positions,a.positions))
    return {sphereContacts:a.sphereContacts,spherePenetration:a.spherePenetration,sphereMinGap:a.sphereMinGap,sphereForce:a.sphereForce,sphereComplementarity:a.sphereComplementarity,tipAngleDeg,torqueBalance:balance.torque,pull,positions:a.positions,tendon:a.tendon,stress:a.stress,contacts:a.contactInfo,tip,tipDeflection:tip[1]-reference[1],tension:a.tension,energy:a.energy,minJ,maxStress:a.maxStress,maxPenetration:a.maxPenetration,checkPenetration:geometry.penetration,contactForce:a.contactForce,anchorSlip:a.anchorSlip,forceBalance:balance.force,residual,iterations,linearIterations,converged,message,minGap:geometry.minGap,complementarity:a.complementarity,contactConverged:a.complementarity<=this.contactTolerance&&a.sphereComplementarity<=this.contactTolerance&&a.spherePenetration<=this.contactTolerance&&geometry.penetration<=this.contactTolerance&&geometry.interiorNodes===0&&geometry.surfaceIntersections===0&&selfIntersections===0&&volumeOverlaps===0,outerIterations,interiorNodes:geometry.interiorNodes,surfaceIntersections:geometry.surfaceIntersections,selfIntersections,volumeOverlaps,solidChecks,collisionChecks:geometry.collisionChecks+collisionChecks,substeps,minPathJ,sweptClearance:this.sweptClearance}
  }
  private solveSingle(target:number):SphereFingerFrame{
    if(!Number.isFinite(target)||target<0||target>this.params.pull+1e-12)return {...this.last,converged:false,message:'驱动位移超出范围'}
    if(Math.abs(target-this.pull)>this.params.step+1e-12)return {...this.last,converged:false,message:'驱动增量过大，已回滚。'}
    const oldLambda=this.lambda.slice(),oldSphereLambda=this.sphereLambda.slice(),trial=new Float64Array(this.q);trial[3*this.cableStart]=-.012-target
    let q=trial,residual=Infinity,iterations=0,totalLinear=0,reason='接触外迭代未收敛，已回滚。',outer=0,motionChecks=0,minPathJ=Infinity
    try{
      const beginning=this.assemble(this.q,false),driven=this.assemble(trial,false),driveSafety=this.safety.motion(beginning.positions,driven.positions,beginning.tendon,driven.tendon,this.sweptClearance)
      motionChecks+=driveSafety.checks;minPathJ=Math.min(minPathJ,driveSafety.minimumPathJ)
      if(!driveSafety.safe)throw Error(`驱动连续碰撞检查未通过：${driveSafety.reason}`)
      const sphereDrive=this.objectMotion(beginning.positions,driven.positions);motionChecks+=sphereDrive.checks
      if(!sphereDrive.safe)throw Error(`驱动物体碰撞检查未通过：${sphereDrive.reason}`)
      // Redundant feature constraints can require many multiplier updates at
      // feature transitions. This increases the iteration budget only: every
      // accepted state still has the same force, KKT and CCD tolerances.
      for(outer=1;outer<=200;outer++){
        let converged=false
        for(let it=0;it<60;it++){
          const A=this.assemble(q,true);let sum=0;for(let i=0;i<q.length;i++)if(!this.fixedDofs[i])sum+=A.gradient[i]*A.gradient[i]
          residual=Math.sqrt(sum);iterations++
          if(residual<this.forceTolerance){
            const balance=this.supportMetrics(A)
            if(balance.force<2e-5&&balance.torque<2e-6){converged=true;break}
          }
          let solution:ReturnType<SphereFinger3D['linearSolve']>|null=null
          for(const shift of [0,.1,1,10,100,1000,10000,100000,1000000]){const attempt=this.linearSolve(A,shift);totalLinear+=attempt.iterations;if(attempt.ok){solution=attempt;break}}
          if(!solution){reason='三维线性迭代未收敛，已回滚。';break}
          let slope=0;for(let i=0;i<q.length;i++)if(!this.fixedDofs[i])slope+=A.gradient[i]*solution.x[i]
          if(!(slope<0)){reason='无法获得下降方向，已回滚。';break}
          let alpha=1,accepted=false
          for(let line=0;line<25;line++){
            const candidate=new Float64Array(q);for(let i=0;i<q.length;i++)if(!this.fixedDofs[i])candidate[i]+=alpha*solution.x[i]
            try{
              const next=this.assemble(candidate,false)
              if(next.energy<=A.energy+1e-4*alpha*slope){
                const path=this.safety.motion(A.positions,next.positions,A.tendon,next.tendon,this.sweptClearance);motionChecks+=path.checks
                if(path.safe){
                  const objectPath=this.objectMotion(A.positions,next.positions);motionChecks+=objectPath.checks
                  if(objectPath.safe){minPathJ=Math.min(minPathJ,path.minimumPathJ);q=candidate;accepted=true;break}
                  reason=`物体连续碰撞检查未通过（${objectPath.reason}），已回滚。`
                }else reason=`连续碰撞检查未通过（${path.reason}），已回滚。`
              }
            }catch{/* reject invalid trial */}
            alpha*=.5
          }
          if(!accepted){if(!reason.startsWith('连续碰撞'))reason='接触线搜索失败，已回滚。';break}
        }
        if(!converged)break
        const A=this.assemble(q,false),geometry=this.auditGeometry(A.positions,A.tendon),self=this.safety.staticSelf(A.positions);motionChecks+=self.checks
        if(self.intersections>0){reason='实体自干涉，已回滚。';break}
        if(A.complementarity<=this.contactTolerance&&A.sphereComplementarity<=this.contactTolerance&&A.spherePenetration<=this.contactTolerance&&geometry.penetration<=this.contactTolerance&&geometry.interiorNodes===0&&geometry.surfaceIntersections===0&&!this.sphereCenterInside(A.positions)){
          const solid=this.safety.staticSolidOverlap(A.positions)
          if(solid.overlaps>0){reason='实体四面体内部重叠，已回滚。';break}
          const frame=this.makeFrame(A,target,residual,iterations,totalLinear,true,geometry,outer,1,motionChecks,self.intersections,solid.overlaps,solid.checks,minPathJ)
          this.q=q;this.pull=target;this.lambda=A.nextLambda;this.sphereLambda=A.nextSphereLambda;this.last=frame;return frame
        }
        this.lambda=A.nextLambda;this.sphereLambda=A.nextSphereLambda
      }
    }catch(error){reason=`三维接触求解失败：${error instanceof Error?error.message:String(error)}`}
    this.lambda=oldLambda;this.sphereLambda=oldSphereLambda
    return {...this.last,converged:false,residual,iterations,linearIterations:totalLinear,outerIterations:outer,message:reason}
  }
  /** A requested step is atomic: failed recursive subdivisions restore both
   * coordinates and contact multipliers to the last accepted configuration. */
  step(target:number):SphereFingerFrame{
    if(!Number.isFinite(target)||target<0||target>this.params.pull+1e-12)return {...this.last,converged:false,message:'驱动位移超出范围'}
    if(Math.abs(target-this.pull)>this.params.step+1e-12)return {...this.last,converged:false,message:'驱动增量过大，已回滚。'}
    if(Math.abs(target-this.pull)<1e-14)return this.last
    // No loads, prestress, friction or plasticity are present at zero pull.
    // The exact reference configuration is therefore a zero-energy global
    // equilibrium. Accept it only if the entire connecting numerical path
    // passes the same CCD/J checks and the final state passes all audits.
    if(target===0){
      const oldLambda=this.lambda,oldSphereLambda=this.sphereLambda
      try{
        const from=this.assemble(this.q,false);this.lambda=new Float64Array(oldLambda.length);this.sphereLambda=new Float64Array(oldSphereLambda.length)
        const reference=this.assemble(this.restQ,false),path=this.safety.motion(from.positions,reference.positions,from.tendon,reference.tendon,this.sweptClearance)
        const objectPath=this.objectMotion(from.positions,reference.positions),geometry=this.auditGeometry(reference.positions,reference.tendon),self=this.safety.staticSelf(reference.positions),solid=this.safety.staticSolidOverlap(reference.positions)
        let residual=0;for(let i=0;i<this.q.length;i++)if(!this.fixedDofs[i])residual+=reference.gradient[i]*reference.gradient[i];residual=Math.sqrt(residual)
        const balance=this.supportMetrics(reference)
        if(path.safe&&objectPath.safe&&residual<this.forceTolerance&&balance.force<2e-5&&balance.torque<2e-6&&reference.spherePenetration<=this.contactTolerance&&reference.sphereComplementarity<=this.contactTolerance&&!this.sphereCenterInside(reference.positions)&&geometry.penetration<=this.contactTolerance&&!geometry.interiorNodes&&!geometry.surfaceIntersections&&!self.intersections&&!solid.overlaps){
          const frame=this.makeFrame(reference,0,residual,0,0,true,geometry,0,1,path.checks+objectPath.checks+self.checks,self.intersections,solid.overlaps,solid.checks,path.minimumPathJ)
          this.q=this.restQ.slice();this.pull=0;this.last=frame;return frame
        }
      }catch{/* fall back to ordinary adaptive Newton without accepting a shortcut */}
      this.lambda=oldLambda;this.sphereLambda=oldSphereLambda
    }
    const q=this.q.slice(),lambda=this.lambda.slice(),sphereLambda=this.sphereLambda.slice(),pull=this.pull,last=this.last
    let count=0,iterations=0,linear=0,checks=0,minPathJ=Infinity
    const advance=(to:number,depth:number):SphereFingerFrame=>{
      const from=this.pull,result=this.solveSingle(to)
      if(result.converged){count++;iterations+=result.iterations;linear+=result.linearIterations;checks+=result.collisionChecks;minPathJ=Math.min(minPathJ,result.minPathJ);return result}
      if(depth>=6||Math.abs(to-from)<2e-6)return result
      const halfway=(from+to)/2,first=advance(halfway,depth+1)
      return first.converged?advance(to,depth+1):first
    }
    const result=advance(target,0)
    if(!result.converged){this.q=q;this.lambda=lambda;this.sphereLambda=sphereLambda;this.pull=pull;this.last=last;return {...last,converged:false,residual:result.residual,iterations:result.iterations,linearIterations:result.linearIterations,message:`${result.message||'未收敛'}（自适应子步也失败，已完整回滚）`}}
    this.last={...result,substeps:count,iterations,linearIterations:linear,collisionChecks:checks,minPathJ};return this.last
  }
}
