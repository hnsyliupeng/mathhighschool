/**
 * Reduced-order dynamic pinch bench. Five compliant, driven fingertip pads
 * interact with freely moving spring-network objects. This is NOT the Q1
 * tendon/finger solver, a continuum solid, or a calibrated real hand.
 *
 * SI units. XPBD distances use physical link stiffness k [N/m], alpha=1/kdt²;
 * normal contact is unilateral and pad friction is displacement-level Coulomb capped.
 * Pad-sphere/triangular object surfaces are enforced at discrete substeps;
 * there is no continuous collision certificate. See docs.
 */
import type {Vec3} from './gripper3d'
import {closestPointTriangle} from './segment-triangle'

export type MaterialObjectId='screwdriver'|'egg'|'bottle-cap'|'cloth'
export type Phase='closing'|'holding'|'lifting'|'finished'
export interface GraspParams {id:MaterialObjectId;scale:number;stiffnessScale:number;gripStiffness:number;friction:number;bite:number;dt:number;iterations:number;duration:number;lift:number}
export interface Spring {a:number;b:number;rest:number;k:number;kind:'structural'|'shear'|'bend'|'radial'|'rigid'}
export interface ObjectMesh {positions:Vec3[];triangles:[number,number,number][];faceMaterial:number[];surfaceNodes:number[];radii:number[];springs:Spring[];mass:number;clipNodes:number[];dimensionsMm:[number,number,number];description:string}
export interface ContactSample {finger:number;triangle:number;point:Vec3;bary:Vec3;normal:Vec3;normalForce:number;tangentialForce:number;penetration:number}
export interface DynamicFrame {
  time:number;phase:Phase;positions:Vec3[];tips:Vec3[];targets:Vec3[];contacts:ContactSample[]
  centre:Vec3;centreRise:number;maxLinkStrain:number;maxStructuralStrain:number;minFaceAreaRatio:number;minGroundGap:number;springEnergy:number;kineticEnergy:number
  maxPenetration:number;maxNormalForce:number;normalForces:number[];contactFingers:number;groundNodes:number;clipsActive:boolean
  finite:boolean;message?:string;attempted?:{time:number;maxPenetration:number;maxStructuralStrain:number;minFaceAreaRatio:number}
}
export interface GraspPreset {id:MaterialObjectId;name:string;english:string;description:string;springLabel:string;mass:number;gripStiffness:number;friction:number;bite:number;dimensionsMm:[number,number,number]}
export const MATERIAL_PRESETS:GraspPreset[]=[
  {id:'screwdriver',name:'螺丝刀',english:'SCREWDRIVER',description:'长柄及细杆，高刚度近刚性弹簧网络；不是精确刚体',springLabel:'近刚性结构 12000 N/m / 连杆',mass:.085,gripStiffness:400,friction:1.3,bite:.008,dimensionsMm:[28,147,26.629582456]},
  {id:'egg',name:'鸡蛋',english:'EGG',description:'椭球形弹性壳与径向弹簧；不模拟蛋壳破裂或液体',springLabel:'壳体 800 N/m / 连杆',mass:.055,gripStiffness:220,friction:1,bite:.007,dimensionsMm:[44,60,44]},
  {id:'bottle-cap',name:'瓶盖',english:'BOTTLE CAP',description:'带顶面与侧壁的薄壳环；不含螺纹及内壁接触',springLabel:'薄壳 4000 N/m / 连杆',mass:.005,gripStiffness:300,friction:1.2,bite:.005,dimensionsMm:[32,32,12]},
  {id:'cloth',name:'衣物布片',english:'CLOTH PATCH',description:'柔性三角布片，带拉伸、剪切与弯曲弹簧；不含自碰撞',springLabel:'结构 18 N/m / 连杆',mass:.018,gripStiffness:120,friction:1,bite:.003,dimensionsMm:[90,0,100]},
]
export function defaultMaterialGraspParams(id:MaterialObjectId='egg'):GraspParams{
  const preset=MATERIAL_PRESETS.find(p=>p.id===id);if(!preset)throw Error('未知物体')
  return {id,scale:1,stiffnessScale:1,gripStiffness:preset.gripStiffness,friction:preset.friction,bite:preset.bite,dt:1/240,iterations:40,duration:1.6,lift:.055}
}
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const norm=(x:Vec3)=>Math.hypot(x[0],x[1],x[2])
export const MAX_DISCRETE_PENETRATION=.00025
/** This heuristic closure schedule was tuned for these example geometries, not learned from measurements. */
export function effectiveBite(params:GraspParams){const s=params.scale,exponent=params.id==='cloth'?2:params.id==='screwdriver'?1.35:params.id==='bottle-cap'&&s<1?1.5:1;return params.bite*Math.pow(s,exponent)}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x))
function faceArea(a:Vec3,b:Vec3,c:Vec3){const u=sub(b,a),v=sub(c,a);return .5*Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])}

/** Mesh topology and actual spring stiffnesses, not a visual-only shape. */
export function makeMaterialObject(params:GraspParams):ObjectMesh{
  const {id,scale:s,stiffnessScale:ks}=params,preset=MATERIAL_PRESETS.find(p=>p.id===id)
  if(!preset||!Number.isFinite(s)||s<.7||s>1.3||!Number.isFinite(ks)||ks<.25||ks>4)throw Error('无效物体或材料倍率')
  const p:Vec3[]=[],triangles:[number,number,number][]=[],faceMaterial:number[]=[],surfaceNodes:number[]=[],radii:number[]=[],springs:Spring[]=[],clipNodes:number[]=[],edgeKeys=new Set<string>()
  const add=(x:number,y:number,z:number,r:number,surface=true)=>{const i=p.length;p.push([x,y,z]);radii.push(r);if(surface)surfaceNodes.push(i);return i}
  const face=(a:number,b:number,c:number,material=0)=>{triangles.push([a,b,c]);faceMaterial.push(material)}
  const edge=(a:number,b:number,k:number,kind:Spring['kind'])=>{if(a===b)return;const lo=Math.min(a,b),hi=Math.max(a,b),key=`${lo}:${hi}`;if(edgeKeys.has(key))return;edgeKeys.add(key);springs.push({a:lo,b:hi,rest:norm(sub(p[lo],p[hi])),k:k*ks,kind})}
  if(id==='screwdriver'){
    // The handle has four sampled circumferential rings; the shaft is long and
    // narrow. A complete distance graph makes this near-rigid, not exact rigid.
    const N=10,rings:[number,number][]=[[-.032,.0125],[-.021,.014],[-.007,.014],[0,.014],[.007,.014],[.021,.014],[.032,.0125],[.039,.0025],[.115,.0025]]
    const z0=(.014+.0038)*s,ringIds:number[][]=[]
    for(const [y,r] of rings){const row:number[]=[];for(let j=0;j<N;j++){const t=2*Math.PI*j/N;row.push(add(r*s*Math.cos(t),y*s,z0+r*s*Math.sin(t),(r>.01?.0038:.0014)*s))}ringIds.push(row)}
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){const n=(j+1)%N,a=ringIds[i][j],b=ringIds[i][n],c=ringIds[i+1][j],d=ringIds[i+1][n];face(a,c,b,i>=5?1:0);face(b,c,d,i>=5?1:0)}
    const start=add(0,rings[0][0]*s,z0,.003*s),end=add(0,rings.at(-1)![0]*s,z0,.0014*s)
    for(let j=0;j<N;j++){const n=(j+1)%N;face(start,ringIds[0][n],ringIds[0][j]);face(end,ringIds.at(-1)![j],ringIds.at(-1)![n],1)}
    for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)edge(i,j,12000,'rigid')
  }else if(id==='egg'){
    const N=12,L=6,rx=.022*s,ry=.03*s,rz=.022*s,z0=rz+.003*s,rings:number[][]=[]
    const north=add(0,ry,z0,.003*s)
    for(let k=1;k<L;k++){const theta=Math.PI*k/L,row:number[]=[];for(let j=0;j<N;j++){const phi=2*Math.PI*j/N;row.push(add(rx*Math.sin(theta)*Math.cos(phi),ry*Math.cos(theta),z0+rz*Math.sin(theta)*Math.sin(phi),.003*s))}rings.push(row)}
    const south=add(0,-ry,z0,.003*s),centre=add(0,0,z0,0,false)
    for(let j=0;j<N;j++){const n=(j+1)%N;face(north,rings[0][j],rings[0][n]);face(south,rings.at(-1)![n],rings.at(-1)![j])}
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){const n=(j+1)%N;face(rings[i][j],rings[i+1][j],rings[i][n]);face(rings[i][n],rings[i+1][j],rings[i+1][n])}
    for(const t of triangles){edge(t[0],t[1],800,'structural');edge(t[1],t[2],800,'structural');edge(t[2],t[0],800,'structural')}
    for(const i of surfaceNodes)edge(i,centre,1000,'radial')
  }else if(id==='bottle-cap'){
    const N=24,r=.016*s,h=.012*s,z0=h/2+.0022*s,bottom:number[]=[],top:number[]=[]
    for(let j=0;j<N;j++){const t=2*Math.PI*j/N;bottom.push(add(r*Math.cos(t),r*Math.sin(t),z0-h/2,.0022*s));top.push(add(r*Math.cos(t),r*Math.sin(t),z0+h/2,.0022*s))}
    const centre=add(0,0,z0+h/2,.0022*s)
    for(let j=0;j<N;j++){const n=(j+1)%N;face(bottom[j],bottom[n],top[j]);face(bottom[n],top[n],top[j]);face(centre,top[j],top[n]);edge(bottom[j],bottom[n],4000,'structural');edge(top[j],top[n],4000,'structural');edge(bottom[j],top[j],4000,'structural');edge(bottom[j],top[n],2000,'shear');edge(centre,top[j],4000,'radial');edge(bottom[j],bottom[(j+N/2)%N],1800,'radial')}
  }else{
    // A hanging fabric patch; temporary clips on the upper hem release at
    // 0.70 s. No fictitious rigid object under the displayed cloth.
    const nx=13,nz=13,width=.09*s,height=.10*s,base=.025*s,row:number[][]=[]
    for(let iz=0;iz<nz;iz++){const line:number[]=[];for(let ix=0;ix<nx;ix++)line.push(add(-width/2+width*ix/(nx-1),0,base+height*iz/(nz-1),.0014*s));row.push(line)}
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      if(x+1<nx)edge(row[z][x],row[z][x+1],18,'structural');if(z+1<nz)edge(row[z][x],row[z+1][x],18,'structural')
      if(x+1<nx&&z+1<nz){edge(row[z][x],row[z+1][x+1],9,'shear');edge(row[z][x+1],row[z+1][x],9,'shear');face(row[z][x],row[z][x+1],row[z+1][x]);face(row[z][x+1],row[z+1][x+1],row[z+1][x])}
      if(x+2<nx)edge(row[z][x],row[z][x+2],.35,'bend');if(z+2<nz)edge(row[z][x],row[z+2][x],.35,'bend')
    }
    clipNodes.push(...row[nz-1])
  }
  return {positions:p,triangles,faceMaterial,surfaceNodes,radii,springs,mass:preset.mass*(id==='cloth'?s*s:s*s*s),clipNodes,dimensionsMm:preset.dimensionsMm.map(x=>x*s) as Vec3,description:preset.description}
}

/** Scalar XPBD distance multiplier update; C=length-rest, compliance=1/k. */
export function xpbdDistanceDelta(length:number,rest:number,inverseMassSum:number,lambda:number,stiffness:number,dt:number):number{
  if(![length,rest,inverseMassSum,lambda,stiffness,dt].every(Number.isFinite)||length<=0||rest<=0||inverseMassSum<0||stiffness<=0||dt<=0)throw Error('Invalid XPBD distance data')
  const alpha=1/(stiffness*dt*dt)
  return (-(length-rest)-alpha*lambda)/(inverseMassSum+alpha)
}

/** Project the accumulated tangential position multiplier into the Coulomb disk.
 * Unit normal, SI displacement and inverse mass are required. */
export function projectCoulombTangent(relative:Vec3,normal:Vec3,old:Vec3,inverseMassSum:number,normalLambda:number,mu:number):Vec3{
  if(![...relative,...normal,...old,inverseMassSum,normalLambda,mu].every(Number.isFinite)||Math.abs(norm(normal)-1)>1e-8||inverseMassSum<=0||normalLambda<0||mu<0)throw Error('Invalid Coulomb projection data')
  const normalPart=relative[0]*normal[0]+relative[1]*normal[1]+relative[2]*normal[2],oldNormal=old[0]*normal[0]+old[1]*normal[1]+old[2]*normal[2]
  const t:Vec3=[0,0,0];for(let d=0;d<3;d++)t[d]=old[d]-oldNormal*normal[d]-(relative[d]-normalPart*normal[d])/inverseMassSum
  const length=norm(t),limit=mu*normalLambda,ratio=length>limit&&length>0?limit/length:1
  return [ratio*t[0],ratio*t[1],ratio*t[2]]
}

/** Apply one vector multiplier to a pad and barycentric triangle. The mass-
 * weighted coordinate change is equal and opposite, preserving linear momentum. */
export function applyTriangleMultiplier(q:Float64Array,weight:Float64Array,tip:number,nodes:[number,number,number],bary:Vec3,change:Vec3){
  for(let d=0;d<3;d++){q[3*tip+d]+=weight[tip]*change[d];for(let k=0;k<3;k++)q[3*nodes[k]+d]-=weight[nodes[k]]*bary[k]*change[d]}
}

/** Isolated friction impulse. Equal and opposite linear impulses are applied;
 * as node/pad particles have no spin, exact angular momentum is not guaranteed. */
export function frictionImpulse(relativeVelocity:Vec3,normal:Vec3,inverseMassSum:number,normalImpulse:number,mu:number):Vec3{
  if(![...relativeVelocity,...normal,inverseMassSum,normalImpulse,mu].every(Number.isFinite)||inverseMassSum<=0||normalImpulse<0||mu<0)throw Error('Invalid friction input')
  const vn=relativeVelocity[0]*normal[0]+relativeVelocity[1]*normal[1]+relativeVelocity[2]*normal[2]
  const t:Vec3=[relativeVelocity[0]-vn*normal[0],relativeVelocity[1]-vn*normal[1],relativeVelocity[2]-vn*normal[2]],v=norm(t)
  if(v<1e-14)return [0,0,0]
  const magnitude=Math.min(v/inverseMassSum,mu*normalImpulse)
  return [-magnitude*t[0]/v,-magnitude*t[1]/v,-magnitude*t[2]/v]
}

export class MaterialGrasp3D {
  readonly params:GraspParams;readonly mesh:ObjectMesh;readonly count:number;readonly tipStart:number;readonly q:Float64Array;readonly v:Float64Array;readonly inverseMass:Float64Array
  readonly starts:Vec3[];readonly closes:Vec3[];readonly tipRadius=.0075;readonly releaseTime=.70;readonly liftStart=.85
  readonly initialCentre:Vec3;readonly restFaceAreas:number[];time=0;last:DynamicFrame
  constructor(params:GraspParams=defaultMaterialGraspParams()){
    if(![params.scale,params.stiffnessScale,params.gripStiffness,params.friction,params.bite,params.dt,params.iterations,params.duration,params.lift].every(Number.isFinite)||params.gripStiffness<5||params.gripStiffness>1000||params.friction<0||params.friction>1.5||params.bite<.001||params.bite>.015||params.dt<1/1000||params.dt>1/60||!Number.isInteger(params.iterations)||params.iterations<2||params.iterations>80||params.duration<1||params.duration>4||params.lift<0||params.lift>.1)throw Error('无效仿真参数')
    this.params={...params};this.mesh=makeMaterialObject(params);this.count=this.mesh.positions.length;this.tipStart=this.count
    this.q=new Float64Array(3*(this.count+5));this.v=new Float64Array(this.q.length);this.inverseMass=new Float64Array(this.count+5)
    this.mesh.positions.forEach((p,i)=>{this.q.set(p,3*i);this.inverseMass[i]=this.count/this.mesh.mass})
    for(let i=0;i<5;i++)this.inverseMass[this.tipStart+i]=1/.012
    const open=.018,s=params.scale,bit=effectiveBite(params)
    this.starts=[];this.closes=[]
    if(params.id==='cloth'){
      const z=(.025+.10-.008)*s,spacing=.015*s
      this.closes.push([0,-(this.tipRadius+.0014*s-bit),z]);this.starts.push([0,-(this.tipRadius+.0014*s+open),z])
      for(const u of [-1.5,-.5,.5,1.5]){this.closes.push([u*spacing,this.tipRadius+.0014*s-bit,z]);this.starts.push([u*spacing,this.tipRadius+.0014*s+open,z])}
    }else{
      const radius=(params.id==='egg'?.022:params.id==='bottle-cap'?.016:.014)*s,ry=(params.id==='egg'?.03:params.id==='bottle-cap'?.016:.035)*s,z=params.id==='egg'?(.022+.003)*s:params.id==='bottle-cap'?(.006+.0022)*s:(.014+.0038)*s
      const objectRadius=(params.id==='egg'?.003:params.id==='bottle-cap'?.0022:.0038)*s
      this.closes.push([-(radius+this.tipRadius+objectRadius-bit),0,z]);this.starts.push([-(radius+this.tipRadius+objectRadius+open),0,z])
      for(const f of [-.6,-.2,.2,.6]){
        const y=f*ry,localRadius=params.id==='screwdriver'?radius:radius*Math.sqrt(1-f*f)
        this.closes.push([localRadius+this.tipRadius+objectRadius-bit,y,z]);this.starts.push([localRadius+this.tipRadius+objectRadius+open,y,z])
      }
    }
    this.starts.forEach((p,i)=>this.q.set(p,3*(this.tipStart+i)))
    this.restFaceAreas=this.mesh.triangles.map(t=>faceArea(this.mesh.positions[t[0]],this.mesh.positions[t[1]],this.mesh.positions[t[2]]));this.initialCentre=this.centre();this.last=this.makeFrame([],0,0)
  }
  private centre():Vec3{const c:Vec3=[0,0,0];for(let i=0;i<this.count;i++)for(let d=0;d<3;d++)c[d]+=this.q[3*i+d]/this.count;return c}
  targets(time:number):Vec3[]{
    const t=clamp(time/.55,0,1),smooth=t*t*(3-2*t),up=clamp((time-this.liftStart)/.55,0,1),rise=this.params.lift*up*up*(3-2*up)
    return this.starts.map((p,i)=>[p[0]+smooth*(this.closes[i][0]-p[0]),p[1]+smooth*(this.closes[i][1]-p[1]),p[2]+smooth*(this.closes[i][2]-p[2])+rise])
  }
  private makeFrame(contacts:ContactSample[],maxPenetration:number,groundNodes:number):DynamicFrame{
    const positions=Array.from({length:this.count},(_,i)=>[this.q[3*i],this.q[3*i+1],this.q[3*i+2]] as Vec3),tips=Array.from({length:5},(_,i)=>[this.q[3*(this.tipStart+i)],this.q[3*(this.tipStart+i)+1],this.q[3*(this.tipStart+i)+2]] as Vec3)
    let maxLinkStrain=0,maxStructuralStrain=0,springEnergy=0,kineticEnergy=0
    for(const e of this.mesh.springs){const d=norm(sub(positions[e.a],positions[e.b])),strain=(d-e.rest)/e.rest;maxLinkStrain=Math.max(maxLinkStrain,Math.abs(strain));if(e.kind!=='bend')maxStructuralStrain=Math.max(maxStructuralStrain,Math.abs(strain));springEnergy+=.5*e.k*(d-e.rest)**2}
    for(let i=0;i<this.count+5;i++)kineticEnergy+=.5/this.inverseMass[i]*(this.v[3*i]**2+this.v[3*i+1]**2+this.v[3*i+2]**2)
    const minFaceAreaRatio=Math.min(...this.mesh.triangles.map((t,i)=>faceArea(positions[t[0]],positions[t[1]],positions[t[2]])/this.restFaceAreas[i])),minGroundGap=Math.min(...positions.map((p,i)=>p[2]-this.mesh.radii[i]))
    const normalForces=Array.from({length:5},(_,i)=>contacts.filter(c=>c.finger===i).reduce((v,c)=>v+c.normalForce,0)),centre=this.centre()
    return {time:this.time,phase:this.time>=this.params.duration-1e-12?'finished':this.time<.55?'closing':this.time<this.liftStart?'holding':'lifting',positions,tips,targets:this.targets(this.time),contacts,centre,centreRise:centre[2]-this.initialCentre[2],maxLinkStrain,maxStructuralStrain,minFaceAreaRatio,minGroundGap,springEnergy,kineticEnergy,maxPenetration,maxNormalForce:Math.max(0,...normalForces),normalForces,contactFingers:normalForces.filter(v=>v>1e-6).length,groundNodes,clipsActive:this.mesh.clipNodes.length>0&&this.time<this.releaseTime,finite:true}
  }
  /** One dynamic substep. Invalid geometry/overflow rolls back coordinates,
   * velocity and time rather than inserting a corrupt frame into history. */
  step():DynamicFrame{
    if(this.time>=this.params.duration-1e-12)return this.last
    const dt=Math.min(this.params.dt,this.params.duration-this.time),oldQ=this.q.slice(),oldV=this.v.slice(),oldTime=this.time,n=this.count+5,weight=this.inverseMass.slice(),clipsActive=this.time+dt<=this.releaseTime+1e-12
    for(const i of this.mesh.clipNodes)if(clipsActive)weight[i]=0
    let attempted:DynamicFrame['attempted']
    try{
      const damping=Math.exp(-1.6*dt)
      for(let i=0;i<n;i++)if(weight[i]){this.v[3*i]*=damping;this.v[3*i+1]*=damping;this.v[3*i+2]=this.v[3*i+2]*damping-9.81*dt;for(let d=0;d<3;d++)this.q[3*i+d]+=dt*this.v[3*i+d]}
      const target=this.targets(this.time+dt),linkLambda=new Float64Array(this.mesh.springs.length),anchorLambda=new Float64Array(15),contactLambda=new Float64Array(5*this.mesh.triangles.length),contactTangent=new Float64Array(15*this.mesh.triangles.length),groundLambda=new Float64Array(n)
      const alphaGrip=1/(this.params.gripStiffness*dt*dt),alphaContact=1/(60000*dt*dt)
      for(let iter=0;iter<this.params.iterations;iter++){
        for(let e=0;e<this.mesh.springs.length;e++){
          const l=this.mesh.springs[e],ia=3*l.a,ib=3*l.b,dx=this.q[ib]-this.q[ia],dy=this.q[ib+1]-this.q[ia+1],dz=this.q[ib+2]-this.q[ia+2],len=Math.hypot(dx,dy,dz)
          if(!(len>1e-12))throw Error('物体弹簧退化')
          const dl=xpbdDistanceDelta(len,l.rest,weight[l.a]+weight[l.b],linkLambda[e],l.k,dt);linkLambda[e]+=dl
          const nx=dx/len,ny=dy/len,nz=dz/len,wa=weight[l.a]*dl,wb=weight[l.b]*dl
          this.q[ia]-=wa*nx;this.q[ia+1]-=wa*ny;this.q[ia+2]-=wa*nz;this.q[ib]+=wb*nx;this.q[ib+1]+=wb*ny;this.q[ib+2]+=wb*nz
        }
        for(let i=0;i<5;i++){const id=this.tipStart+i,w=weight[id];for(let d=0;d<3;d++){const j=3*i+d,q=3*id+d,dl=(-(this.q[q]-target[i][d])-alphaGrip*anchorLambda[j])/(w+alphaGrip);anchorLambda[j]+=dl;this.q[q]+=w*dl}}
        for(let f=0;f<5;f++)for(let j=0;j<this.mesh.triangles.length;j++){
          const tip=this.tipStart+f,a=3*tip,nodes=this.mesh.triangles[j],idx=f*this.mesh.triangles.length+j,radius=this.tipRadius+.0005*this.params.scale
          // AABB is a conservative lower bound on point-to-face distance.
          if(contactLambda[idx]===0&&contactTangent[3*idx]===0&&contactTangent[3*idx+1]===0&&contactTangent[3*idx+2]===0&&[0,1,2].some(d=>{const x=this.q[a+d],u=this.q[3*nodes[0]+d],v=this.q[3*nodes[1]+d],w=this.q[3*nodes[2]+d];return x<Math.min(u,v,w)-radius||x>Math.max(u,v,w)+radius}))continue
          const point:Vec3=[this.q[a],this.q[a+1],this.q[a+2]],tri=nodes.map(i=>[this.q[3*i],this.q[3*i+1],this.q[3*i+2]] as Vec3) as [Vec3,Vec3,Vec3]
          const hit=closestPointTriangle(point,...tri),distance=hit.distance
          if(!Number.isFinite(distance)||!(distance>1e-12))throw Error('指垫中心与物体表面重合或三角面退化')
          if(distance>radius&&contactLambda[idx]===0&&contactTangent[3*idx]===0&&contactTangent[3*idx+1]===0&&contactTangent[3*idx+2]===0)continue
          const normal:Vec3=[(point[0]-hit.point[0])/distance,(point[1]-hit.point[1])/distance,(point[2]-hit.point[2])/distance],gap=distance-radius,old=contactLambda[idx]
          let denominator=weight[tip]+alphaContact;for(let k=0;k<3;k++)denominator+=weight[nodes[k]]*hit.bary[k]**2
          const lambda=Math.max(0,old+(-gap-alphaContact*old)/denominator),dl=lambda-old;contactLambda[idx]=lambda
          applyTriangleMultiplier(this.q,weight,tip,nodes,hit.bary,[dl*normal[0],dl*normal[1],dl*normal[2]])
          // Tangential displacement-level Coulomb projection. The accumulated
          // multiplier is bounded by mu*lambda_n at every iteration. Barycentric
          // interpolation distributes equal/opposite linear impulses to the face.
          const relative:Vec3=[0,0,0],oldT:Vec3=[0,0,0]
          for(let d=0;d<3;d++){relative[d]=this.q[a+d]-oldQ[a+d];for(let k=0;k<3;k++)relative[d]-=hit.bary[k]*(this.q[3*nodes[k]+d]-oldQ[3*nodes[k]+d]);oldT[d]=contactTangent[3*idx+d]}
          const next=projectCoulombTangent(relative,normal,oldT,denominator-alphaContact,lambda,this.params.friction),change:Vec3=[next[0]-oldT[0],next[1]-oldT[1],next[2]-oldT[2]]
          contactTangent.set(next,3*idx);applyTriangleMultiplier(this.q,weight,tip,nodes,hit.bary,change)
        }
        for(let i=0;i<n;i++){
          const radius=i<this.count?this.mesh.radii[i]:this.tipRadius,gap=this.q[3*i+2]-radius
          if(gap>=0&&groundLambda[i]===0)continue
          if(!weight[i])continue
          const old=groundLambda[i],lambda=Math.max(0,old-gap/weight[i]),dl=lambda-old;groundLambda[i]=lambda;this.q[3*i+2]+=weight[i]*dl
        }
      }
      for(let i=0;i<n;i++)if(weight[i])for(let d=0;d<3;d++)this.v[3*i+d]=(this.q[3*i+d]-oldQ[3*i+d])/dt
      // Re-evaluate *all* potentially nearby faces at the final coordinates,
      // not only the faces with a positive multiplier. Later Gauss–Seidel
      // updates can create residual penetration in an otherwise inactive face.
      const contacts:ContactSample[]=[];let maxPenetration=0,groundNodes=0
      for(let f=0;f<5;f++)for(let j=0;j<this.mesh.triangles.length;j++){
        const tip=this.tipStart+f,a=3*tip,nodes=this.mesh.triangles[j],idx=f*this.mesh.triangles.length+j,lambda=contactLambda[idx],radius=this.tipRadius+.0005*this.params.scale
        if(lambda<=0&&[0,1,2].some(d=>{const x=this.q[a+d],u=this.q[3*nodes[0]+d],v=this.q[3*nodes[1]+d],w=this.q[3*nodes[2]+d];return x<Math.min(u,v,w)-radius||x>Math.max(u,v,w)+radius}))continue
        const point:Vec3=[this.q[a],this.q[a+1],this.q[a+2]],tri=nodes.map(i=>[this.q[3*i],this.q[3*i+1],this.q[3*i+2]] as Vec3) as [Vec3,Vec3,Vec3],hit=closestPointTriangle(point,...tri),distance=hit.distance
        if(!Number.isFinite(distance)||!(distance>1e-12))throw Error('接触方向退化')
        const penetration=Math.max(0,radius-distance);maxPenetration=Math.max(maxPenetration,penetration)
        if(lambda>0){const normal:Vec3=[(point[0]-hit.point[0])/distance,(point[1]-hit.point[1])/distance,(point[2]-hit.point[2])/distance],tangentialForce=Math.hypot(contactTangent[3*idx],contactTangent[3*idx+1],contactTangent[3*idx+2])/(dt*dt);contacts.push({finger:f,triangle:j,point:hit.point,bary:hit.bary,normal,normalForce:lambda/(dt*dt),tangentialForce,penetration})}
      }
      for(let i=0;i<n;i++)if(groundLambda[i]>0){if(i<this.count)groundNodes++;const k=3*i,rel:Vec3=[this.v[k],this.v[k+1],this.v[k+2]],impulse=frictionImpulse(rel,[0,0,1],weight[i],groundLambda[i]/dt,.5);this.v[k]+=weight[i]*impulse[0];this.v[k+1]+=weight[i]*impulse[1]}
      if(!this.q.every(Number.isFinite)||!this.v.every(Number.isFinite)||this.v.some(x=>Math.abs(x)>10))throw Error('运动状态非有限或速度超出保护范围')
      this.time+=dt;const frame=this.makeFrame(contacts,maxPenetration,groundNodes)
      attempted={time:frame.time,maxPenetration:frame.maxPenetration,maxStructuralStrain:frame.maxStructuralStrain,minFaceAreaRatio:frame.minFaceAreaRatio}
      if(![frame.minFaceAreaRatio,frame.maxLinkStrain,frame.springEnergy,frame.kineticEnergy].every(Number.isFinite)||frame.minFaceAreaRatio<1e-5)throw Error('物体三角面退化或能量非有限')
      if(frame.maxPenetration>MAX_DISCRETE_PENETRATION)throw Error(`离散接触穿透 ${(frame.maxPenetration*1000).toFixed(3)} mm 超过保护阈值 ${(MAX_DISCRETE_PENETRATION*1000).toFixed(2)} mm`)
      if(frame.maxStructuralStrain>1)throw Error('结构弹簧应变超过 100% 数值保护阈值')
      this.last=frame;return frame
    }catch(error){this.q.set(oldQ);this.v.set(oldV);this.time=oldTime;return {...this.last,finite:false,attempted,message:`动力学步失败，已回滚：${error instanceof Error?error.message:String(error)}`}}
  }
}
