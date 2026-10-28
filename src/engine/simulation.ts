import type { CaseDefinition } from '../data/cases'
import { chainStep, oscillatorStep } from './linear'
import { PlanarBeam } from './planar'
import { PrescribedBeam, type PrescribedBeamState } from './planar-cases'
import { SoftRobot } from './soft-robot'
import { AxisymmetricMembrane } from './axisymmetric-membrane'
import { AxisymmetricShell } from './axisymmetric-shell'
import { AXIS_SHELL_DISPLAY_SEGMENTS } from './axis-shell-guides'
import { GravityNet } from './net-gravity'

export type Vec3 = [number,number,number]
export type Edge = { a:number; b:number; rest:number; kind:'stretch'|'bend'; visible:boolean; growth?:number }
export type Face = [number,number,number]
export interface SimulationParams { load:number; stiffness:number; damping:number; nodes:number }
export interface LoadCurveValue {x:number; y:number; xLabel:string; yLabel:string; xUnit:string; yUnit:string}
export interface Frame {
  positions:Vec3[]; edges:Edge[]; faces:Face[]; fixed:number[]; time:number; displacement:number; energy:number|null
  residual:number|null; converged:boolean; unit:string; isApproximation:boolean; phase?:string; numericalNodes?:number; numericalEdges?:number; loadCurve?:LoadCurveValue; meridionalStrain?:number; netStrain?:number
}
type Particle = { p:Vec3; v:Vec3; base:Vec3; fixed:boolean }
export type Snapshot = { time:number; positions:Vec3[]; velocities:Vec3[]; residual:number|null; converged:boolean; beamQ?:number[]; beamV?:number[]; axisQ?:number[]; axisV?:number[]; axisReaction?:number; axisBranches?:number; netQ?:number[]; netV?:number[]; prescribedBeam?:PrescribedBeamState; q?:number[]; v?:number[]; x?:number; scalarV?:number }

const copy=(v:Vec3):Vec3=>[v[0],v[1],v[2]]
const length=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
export function defaultsFor(item:CaseDefinition):SimulationParams {
  if(item.id==='beam-gravity') return {load:10,stiffness:100,damping:.1,nodes:40}
  if(item.id==='beam-buckling'||item.id==='beam-snap') return {load:1,stiffness:10,damping:.1,nodes:40}
  if(item.id==='hyper-cable') return {load:1,stiffness:1,damping:1,nodes:40}
  if(item.id==='net-gravity') return {load:50,stiffness:1,damping:.1,nodes:631}
  if(item.id==='axis-inflate') return {load:1,stiffness:1,damping:.1,nodes:40}
  if(item.id==='axis-snap') return {load:1,stiffness:1000,damping:.1,nodes:40}
  if(item.id==='hyper-membrane') return {load:1,stiffness:1,damping:1,nodes:60}
  if(item.id==='robot-magnetic') return {load:1,stiffness:100,damping:.1,nodes:40}
  if(item.id==='robot-swim') return {load:1,stiffness:.1,damping:0,nodes:40}
  if(item.id==='mass-single') return {load:1,stiffness:10,damping:.1,nodes:2}
  if(item.id==='mass-multi') return {load:1,stiffness:1,damping:.1,nodes:4}
  return {load:1,stiffness:.85,damping:.12,nodes:24}
}

/**
 * Exact linear implicit systems and a planar DDG beam coexist with a deliberately
 * lower fidelity distance-constraint explorer for the other scenarios.
 */
export class Simulation {
  readonly item:CaseDefinition; readonly params:SimulationParams
  readonly particles:Particle[]=[]; readonly edges:Edge[]=[]; readonly faces:Face[]=[]
  private beam?:PlanarBeam; private prescribedBeam?:PrescribedBeam; private softRobot?:SoftRobot; private axisMembrane?:AxisymmetricMembrane; private axisShell?:AxisymmetricShell; private net?:GravityNet; private x=1; private scalarV=0; private q=[0,0,0]; private velocities=[0,0,0]
  private probe=0; private isPlanar=true; private initialProbe:Vec3=[0,0,0]
  time=0; converged=true; residual:number|null=null
  constructor(item:CaseDefinition, params:SimulationParams) {
    this.item=item; this.params={...params}
    if(item.id==='beam-gravity') {
      this.beam=new PlanarBeam({nodes:params.nodes,length:1,young:params.stiffness*1e6,radius:.01,density:1000,gravity:params.load,damping:params.damping})
      for(let i=0;i<params.nodes;i++) this.add([this.beam.q[i*2]*4,0,0],i<2)
      for(let i=0;i<params.nodes-1;i++) this.connect(i,i+1)
      this.probe=params.nodes-1
    } else if(item.id==='beam-buckling'||item.id==='beam-snap') {
      this.prescribedBeam=new PrescribedBeam(item.id==='beam-buckling'?'buckling':'snap',params);this.beam=this.prescribedBeam.beam
      for(let i=0;i<params.nodes;i++)this.add([this.beam.q[2*i]*4,this.beam.q[2*i+1]*4,0],i<2||i>=params.nodes-2)
      for(let i=0;i<params.nodes-1;i++)this.connect(i,i+1)
      this.probe=Math.floor((params.nodes-1)/2)
    } else if(item.id==='hyper-cable') {
      const n=params.nodes,dx=1/(n-1)
      const referenceNodes=Array.from({length:n},(_,i):[number,number]=>[n===40?Math.round((-0.5+i*dx)*10000)/10000:-0.5+i*dx,0])
      this.beam=new PlanarBeam({nodes:n,length:1,young:params.stiffness*1e6,radius:.01,density:100,gravity:0,damping:params.damping,fixedNodes:[0,n-1],referenceNodes,material:'mooney-rivlin',bending:false})
      for(let i=0;i<n;i++)this.add([this.beam.q[2*i]*4,0,0],i===0||i===n-1)
      for(let i=0;i<n-1;i++)this.connect(i,i+1)
      this.probe=Math.floor((n-1)/2)
    } else if(item.id==='net-gravity') {
      this.net=new GravityNet(params);this.isPlanar=false
      // Numerical coordinates are (x,y,z), z up; Three.js uses y up.
      const net=this.net,scale=1.65
      for(let i=0;i<net.n;i++)this.add([scale*net.q[3*i],scale*net.q[3*i+2],scale*net.q[3*i+1]],net.fixedNodes.has(i))
      for(const edge of net.edges)this.connect(edge.a,edge.b)
      this.probe=0
    } else if(item.id==='axis-inflate'||item.id==='axis-snap') {
      const inflation=item.id==='axis-inflate'
      this.axisShell=new AxisymmetricShell(inflation?'inflation':'eversion',params);this.isPlanar=false
      const shell=this.axisShell,n=shell.n,segments=AXIS_SHELL_DISPLAY_SEGMENTS,ids:number[][]=[],scale=inflation?1.65:2.35,offset=inflation?0:shell.initial.at(-1)!
      // This 3D surface is only a revolution of the numerical 1D meridian.
      for(let i=0;i<n;i++){
        ids[i]=[];const r=shell.q[2*i],z=shell.q[2*i+1]
        for(let j=0;j<segments;j++){const a=2*Math.PI*j/segments;ids[i][j]=this.add([scale*r*Math.cos(a),scale*(z-offset),scale*r*Math.sin(a)],inflation&&i===n-1)}
      }
      for(let i=0;i<n;i++)for(let j=0;j<segments;j++){
        const nj=(j+1)%segments;this.connect(ids[i][j],ids[i][nj])
        if(i<n-1){this.connect(ids[i][j],ids[i+1][j]);this.faces.push([ids[i][j],ids[i+1][j],ids[i][nj]],[ids[i][nj],ids[i+1][j],ids[i+1][nj]])}
      }
      this.probe=0
    } else if(item.id==='hyper-membrane') {
      this.axisMembrane=new AxisymmetricMembrane(params);this.isPlanar=false
      const n=this.axisMembrane.n,segments=24,ids:number[][]=[]
      for(let i=0;i<n;i++){
        ids[i]=[];const r=this.axisMembrane.q[2*i],z=this.axisMembrane.q[2*i+1]
        for(let j=0;j<segments;j++){const a=2*Math.PI*j/segments;ids[i][j]=this.add([1.4*r*Math.cos(a),1.4*z,1.4*r*Math.sin(a)])}
      }
      for(let i=0;i<n;i++)for(let j=0;j<segments;j++){
        const ni=(i+1)%n,nj=(j+1)%segments
        this.connect(ids[i][j],ids[ni][j]);this.connect(ids[i][j],ids[i][nj])
        this.faces.push([ids[i][j],ids[ni][j],ids[i][nj]],[ids[i][nj],ids[ni][j],ids[ni][nj]])
      }
      this.probe=0
    } else if(item.id==='robot-magnetic'||item.id==='robot-swim') {
      const swimmer=item.id==='robot-swim',n=params.nodes
      this.softRobot=new SoftRobot(swimmer?'swimmer':'magnetic',params);this.beam=this.softRobot.beam
      for(let i=0;i<n;i++)this.add([(this.beam.q[2*i]-(swimmer?.05:0))*(swimmer?36:4),this.beam.q[2*i+1]*(swimmer?36:4),0],!swimmer&&i<2)
      for(let i=0;i<n-1;i++)this.connect(i,i+1)
      this.probe=n-1
    } else if(item.id==='mass-single') {
      this.add([-1.9,0,0],true); this.add([.7,0,0]); this.connect(0,1); this.probe=1
    } else if(item.id==='mass-multi') {
      for(let i=0;i<4;i++) this.add([-1.95+i*1.15,0,0],i===0)
      for(let i=0;i<3;i++) this.connect(i,i+1)
      this.probe=3
    } else this.buildProxy()
    this.initialProbe=copy(this.particles[this.probe].base)
  }
  private add(p:Vec3, fixed=false) { this.particles.push({p:copy(p),base:copy(p),v:[0,0,0],fixed}); return this.particles.length-1 }
  private connect(a:number,b:number,kind:'stretch'|'bend'='stretch',visible=true,growth?:number) {
    if(a===b) return
    this.edges.push({a,b,rest:length(this.particles[a].p,this.particles[b].p),kind,visible,growth})
  }
  private chain(points:Vec3[], fixed:(i:number)=>boolean, closed=false) {
    const ids=points.map((p,i)=>this.add(p,fixed(i)))
    for(let i=0;i<ids.length-1;i++) this.connect(ids[i],ids[i+1])
    if(closed) this.connect(ids.at(-1)!,ids[0])
    for(let i=0;i<ids.length-2;i++) this.connect(ids[i],ids[i+2],'bend',false)
    if(closed) {this.connect(ids.at(-2)!,ids[0],'bend',false);this.connect(ids.at(-1)!,ids[1],'bend',false)}
    return ids
  }
  private grid(nx:number,nz:number, point:(i:number,j:number)=>Vec3, fixed:(i:number,j:number)=>boolean, faces=true) {
    const ids:number[][]=[]
    for(let j=0;j<nz;j++) {ids[j]=[]; for(let i=0;i<nx;i++) ids[j][i]=this.add(point(i,j),fixed(i,j))}
    for(let j=0;j<nz;j++) for(let i=0;i<nx;i++) {
      const a=ids[j][i]
      if(i<nx-1) this.connect(a,ids[j][i+1])
      if(j<nz-1) this.connect(a,ids[j+1][i])
      if(i<nx-1&&j<nz-1) {
        this.connect(a,ids[j+1][i+1],'bend',false); this.connect(ids[j][i+1],ids[j+1][i],'bend',false)
        if(faces) {this.faces.push([a,ids[j+1][i],ids[j][i+1]],[ids[j][i+1],ids[j+1][i],ids[j+1][i+1]])}
      }
      if(i<nx-2) this.connect(a,ids[j][i+2],'bend',false)
      if(j<nz-2) this.connect(a,ids[j+2][i],'bend',false)
    }
    this.probe=ids[Math.floor((nz-1)/2)][Math.floor((nx-1)/2)]
    return ids
  }
  private radial(cap=false) {
    const seg=24,rings=7, center=this.add([0,cap?.9:0,0]), rows:number[][]=[]
    for(let j=1;j<=rings;j++) {
      const r=1.65*j/rings; rows[j]=[]
      for(let i=0;i<seg;i++) {const a=2*Math.PI*i/seg; rows[j][i]=this.add([r*Math.cos(a),cap?.9*(1-(r/1.65)**2):0,r*Math.sin(a)],j===rings)}
    }
    for(let i=0;i<seg;i++) {const next=(i+1)%seg;this.connect(center,rows[1][i]);this.faces.push([center,rows[1][next],rows[1][i]])}
    for(let j=1;j<=rings;j++) for(let i=0;i<seg;i++) {
      const n=(i+1)%seg; this.connect(rows[j][i],rows[j][n]); if(j<rings) {
        this.connect(rows[j][i],rows[j+1][i]);this.connect(rows[j][i],rows[j+1][n],'bend',false)
        this.faces.push([rows[j][i],rows[j][n],rows[j+1][i]],[rows[j][n],rows[j+1][n],rows[j+1][i]])
      }
      if(j<rings-1) this.connect(rows[j][i],rows[j+2][i],'bend',false)
    }
    this.probe=center; this.isPlanar=false
  }
  private buildProxy() {
    const model=this.item.model
    if(model==='arch') {
      const snap=this.item.id==='beam-snap', n=27
      this.chain(Array.from({length:n},(_,i)=>{const s=i/(n-1);return [-1.8+3.6*s,(snap?.62:.16)*Math.sin(Math.PI*s),0]}),i=>i<2||i>=n-2)
      this.probe=Math.floor(n/2)
    } else if(model==='helix') {
      this.isPlanar=false; const n=55
      this.chain(Array.from({length:n},(_,i)=>{const s=i/(n-1),a=7*Math.PI*s;return [0.66*Math.cos(a),1.5-3*s,0.66*Math.sin(a)]}),i=>i<2)
      this.probe=n-1
    } else if(model==='ribbon') {
      this.isPlanar=false;const n=25
      const left=this.chain(Array.from({length:n},(_,i)=>{const s=i/(n-1);return [-1.8+3.6*s,.55*Math.sin(Math.PI*s),-.14]}),i=>i<2||i>=n-2)
      const right=this.chain(Array.from({length:n},(_,i)=>{const s=i/(n-1);return [-1.8+3.6*s,.55*Math.sin(Math.PI*s),.14]}),i=>i<2||i>=n-2)
      for(let i=0;i<n;i++){this.connect(left[i],right[i]);if(i<n-1)this.faces.push([left[i],right[i],left[i+1]],[right[i],right[i+1],left[i+1]])}
      this.probe=left[Math.floor(n/2)]
    } else if(model==='ring') {
      this.isPlanar=false;const n=42,inner:number[]=[],outer:number[]=[]
      for(let i=0;i<n;i++){const a=i*2*Math.PI/n;inner.push(this.add([1.05*Math.cos(a),.08*Math.sin(4*a),1.05*Math.sin(a)]));outer.push(this.add([1.52*Math.cos(a),.12*Math.sin(4*a),1.52*Math.sin(a)]))}
      for(let i=0;i<n;i++){const j=(i+1)%n;this.connect(inner[i],inner[j],'stretch',true,.15);this.connect(outer[i],outer[j],'stretch',true,1);this.connect(inner[i],outer[i]);this.connect(inner[i],outer[j],'bend',false);this.faces.push([inner[i],outer[i],inner[j]],[inner[j],outer[i],outer[j]])}
      // Fix one reference point only to prevent drift in this illustration.
      this.particles[inner[0]].fixed=true;this.probe=outer[10]
    } else if(model==='disk'||model==='cap') this.radial(model==='cap')
    else if(model==='plate'||model==='wrinkle'||model==='net'||model==='dome') {
      this.isPlanar=false; const n=model==='net'?13:15
      const ids=this.grid(n,n,(i,j)=>{
        const x=-1.6+3.2*i/(n-1),z=-1.4+2.8*j/(n-1)
        let y=0
        if(model==='wrinkle') y=.08*Math.sin(i*1.8)*Math.sin(Math.PI*j/(n-1))
        if(model==='dome') y=.85*Math.max(0,1-(x*x/3+z*z/2.4))
        return [x,y,z]
      },(i,j)=>model==='net'?(i===0||i===n-1)&&(j===0||j===n-1):model==='dome'?(i===0||j===0||i===n-1||j===n-1):i===0,model!=='net'&&model!=='dome')
      if(model==='plate'||model==='wrinkle') this.probe=ids[Math.floor(n/2)][n-1]
    } else if(model==='cylinder') {
      this.isPlanar=false; const nx=17, nt=28, rows:number[][]=[]
      for(let i=0;i<nx;i++){rows[i]=[];for(let j=0;j<nt;j++){const a=2*Math.PI*j/nt;rows[i][j]=this.add([-1.7+3.4*i/(nx-1),.82*Math.sin(a),.82*Math.cos(a)],i===0||i===nx-1)}}
      for(let i=0;i<nx;i++)for(let j=0;j<nt;j++){const k=(j+1)%nt;this.connect(rows[i][j],rows[i][k]);if(i<nx-1){this.connect(rows[i][j],rows[i+1][j]);this.connect(rows[i][j],rows[i+1][k],'bend',false);this.faces.push([rows[i][j],rows[i+1][j],rows[i][k]],[rows[i][k],rows[i+1][j],rows[i+1][k]])}}
      this.probe=rows[Math.floor(nx/2)][Math.floor(nt/4)]
    } else if(model==='lattice') {
      this.isPlanar=false; const n=10,rows:number[][]=[]
      for(let i=0;i<n;i++){rows[i]=[];for(let j=0;j<4;j++)rows[i][j]=this.add([-1.8+3.6*i/(n-1),j<2?-.35:.35,j%2?-.4:.4],i===0)}
      for(let i=0;i<n;i++){for(let j=0;j<4;j++){this.connect(rows[i][j],rows[i][(j+1)%4]);if(i<n-1){this.connect(rows[i][j],rows[i+1][j]);this.connect(rows[i][j],rows[i+1][(j+1)%4],'bend',true)}}}
      this.probe=rows[n-1][2]
    } else if(model==='torus') {
      this.isPlanar=false; const n=30,m=12,ids:number[][]=[]
      for(let i=0;i<n;i++){ids[i]=[];const a=2*Math.PI*i/n;for(let j=0;j<m;j++){const b=2*Math.PI*j/m,r=1.05+.38*Math.cos(b);ids[i][j]=this.add([r*Math.cos(a),.38*Math.sin(b),r*Math.sin(a)],i===0&&j===0)}}
      for(let i=0;i<n;i++)for(let j=0;j<m;j++){const ni=(i+1)%n,nj=(j+1)%m;this.connect(ids[i][j],ids[ni][j]);this.connect(ids[i][j],ids[i][nj]);this.connect(ids[i][j],ids[ni][nj],'bend',false);this.faces.push([ids[i][j],ids[ni][j],ids[i][nj]],[ids[i][nj],ids[ni][j],ids[ni][nj]])}
      this.probe=ids[7][3]
    } else {
      // Cable and the three soft-body examples use chains with different loads/boundaries.
      const n=30, cable=model==='cable', crawler=model==='crawler', swimmer=model==='swimmer'
      this.chain(Array.from({length:n},(_,i)=>{const s=i/(n-1);return [-1.8+3.6*s,cable?-.4*Math.sin(Math.PI*s):crawler?-.55+.06*Math.sin(2*Math.PI*s):swimmer?.1*Math.sin(2*Math.PI*s):0,0]}),i=>cable?(i===0||i===n-1):model==='magnetic'?i<2:false)
      this.probe=cable?Math.floor(n/2):n-1
    }
  }
  private proxyStep(dt:number) {
    const model=this.item.model, t=this.time, load=this.params.load
    const before=this.particles.map(p=>copy(p.p))
    // Prescribed boundary motion is distinct from applied nodal force.
    if(this.item.id==='rod-bifurcation') {
      const shear=.25*Math.min(t/5,1)*load, half=this.particles.length/2
      this.particles.forEach((p,i)=>{if(p.fixed){const local=i%half;p.p[2]=p.base[2]+(local<2?shear:-shear)}})
    } else if(this.item.id==='net-form') {
      const scale=1-.12*Math.min(t/5,1)*load
      this.particles.forEach(p=>{if(p.fixed){p.p[0]=p.base[0]*scale;p.p[2]=p.base[2]*scale}})
    }
    for(let i=0;i<this.particles.length;i++) {
      const p=this.particles[i]; if(p.fixed) continue
      let ax=0,ay=0,az=0
      const s=this.particles.length>1?i/(this.particles.length-1):0
      if(['plate','wrinkle','net','lattice','helix'].includes(model)) ay=-.65*load
      else if(model==='dome') ay=.12*load
      else if(model==='disk') ay=.8*load
      else if(model==='cap') ay=-.9*load*Math.exp(-(p.p[0]**2+p.p[2]**2)/.3)
      else if(model==='cylinder') ay=-1.5*load*Math.exp(-(p.p[0]**2)/.3)*Math.max(0,p.p[1])
      else if(model==='arch') ay=(this.item.id==='beam-snap'?-.6:.1)*load*Math.sin(Math.PI*s)
      else if(model==='ribbon') az=.5*load*Math.sin(Math.PI*s)
      else if(model==='ring') ay=.2*load*Math.sin(4*Math.atan2(p.p[2],p.p[0])+t*.5)
      else if(model==='cable') ay=-.85*load*Math.exp(-(p.p[0]**2)/.65)
      else if(model==='magnetic') ay=.8*load*Math.sin(t*1.6)*s
      else if(model==='swimmer') {ay=.9*load*Math.sin(3.5*t-6*s);ax=.05*load*Math.cos(3.5*t-6*s)}
      else if(model==='crawler') {ay=.8*load*Math.sin(3*t-5*s)-.25;ax=.18*load*Math.cos(3*t-5*s)}
      else if(model==='torus') ay=.3*load*Math.sin(t*.7)
      p.v[0]+=ax*dt;p.v[1]+=ay*dt;p.v[2]+=az*dt
      for(let a=0;a<3;a++) p.p[a]+=p.v[a]*dt
    }
    // PBD projection: a stable, visual approximation rather than the paper's implicit DER solver.
    const strength=clamp(this.params.stiffness,.05,1)
    for(let it=0;it<6;it++) for(const e of this.edges) {
      const a=this.particles[e.a], b=this.particles[e.b], dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],dz=b.p[2]-a.p[2],l=Math.hypot(dx,dy,dz)
      if(l<1e-9)continue
      const wa=a.fixed?0:1,wb=b.fixed?0:1;if(wa+wb===0)continue
      const target=e.rest*(1+(e.growth??0)*.11*Math.min(t/5,1)*load)
      const correction=(l-target)/l/(wa+wb)*(e.kind==='stretch'?strength:strength*.28)
      if(wa) {a.p[0]+=dx*correction;a.p[1]+=dy*correction;a.p[2]+=dz*correction}
      if(wb) {b.p[0]-=dx*correction;b.p[1]-=dy*correction;b.p[2]-=dz*correction}
    }
    const damping=Math.exp(-(.25+this.params.damping*3)*dt)
    for(let i=0;i<this.particles.length;i++) {
      const p=this.particles[i];if(p.fixed)continue
      if(model==='crawler'&&p.p[1]<-.6) p.p[1]=-.6
      for(let a=0;a<3;a++)p.v[a]=clamp((p.p[a]-before[i][a])/dt*damping,-5,5)
      if(model==='crawler'&&p.p[1]<=-.599) p.v[0]*=.85
    }
    this.time+=dt
  }
  step(dt:number) {
    if(this.net){
      const net=this.net,result=net.step(dt);this.converged=result.converged;this.residual=result.residual
      if(result.converged){
        this.time=net.time;const scale=1.65
        for(let i=0;i<net.n;i++)this.particles[i].p=[scale*net.q[3*i],scale*net.q[3*i+2],scale*net.q[3*i+1]]
      }
    } else if(this.axisShell){
      const shell=this.axisShell,inflation=this.item.id==='axis-inflate'
      // The original cap uses 5 ms load increments; the UI advances 10 ms.
      const originalStep=inflation?.01:.005,substeps=Math.max(1,Math.ceil(dt/originalStep-1e-9)),h=dt/substeps
      const oldQ=[...shell.q],oldV=[...shell.v],oldTime=shell.time,oldReaction=shell.reaction,oldBranches=shell.branchSwitches
      let result=shell.last
      for(let i=0;i<substeps;i++){
        result=shell.step(h)
        if(!result.converged){shell.q=oldQ;shell.v=oldV;shell.time=oldTime;shell.reaction=oldReaction;shell.branchSwitches=oldBranches;break}
      }
      this.converged=result.converged;this.residual=result.residual
      if(result.converged){
        this.time=shell.time;const segments=AXIS_SHELL_DISPLAY_SEGMENTS,scale=inflation?1.65:2.35,offset=inflation?0:shell.initial.at(-1)!
        for(let i=0;i<shell.n;i++)for(let j=0;j<segments;j++){
          const a=2*Math.PI*j/segments,r=shell.q[2*i],z=shell.q[2*i+1]
          this.particles[i*segments+j].p=[scale*r*Math.cos(a),scale*(z-offset),scale*r*Math.sin(a)]
        }
      }
    } else if(this.axisMembrane){
      const m=this.axisMembrane,result=m.step(dt);this.converged=result.converged;this.residual=result.residual
      if(result.converged){
        this.time=m.time;const segments=24
        for(let i=0;i<m.n;i++)for(let j=0;j<segments;j++){
          const a=2*Math.PI*j/segments,r=m.q[2*i],z=m.q[2*i+1]
          this.particles[i*segments+j].p=[1.4*r*Math.cos(a),1.4*z,1.4*r*Math.sin(a)]
        }
      }
    } else if(this.beam) {
      this.beam.gravity=this.params.load;this.beam.damping=this.params.damping
      const b=this.beam
      let result
      if(this.prescribedBeam)result=this.prescribedBeam.step(dt)
      else if(this.softRobot)result=this.softRobot.step(dt)
      else if(this.item.id==='hyper-cable') {
        // Original uses 1 ms implicit steps and a per-node force ramp, not
        // mass-scaled gravity. Preserve total force for other node counts.
        const oldQ=[...b.q],oldV=[...b.v],oldTime=b.time
        const substeps=Math.max(1,Math.ceil(dt/.001-1e-9)),h=dt/substeps
        result=b.last
        for(let step=0;step<substeps;step++) {
          const load=new Array<number>(2*b.n).fill(0),force=-10*(b.time+h)*this.params.load*38/(b.n-2)
          for(let i=1;i<b.n-1;i++)load[2*i+1]=force
          result=b.solve(load,h)
          if(!result.converged){b.q=oldQ;b.v=oldV;b.time=oldTime;b.last=result;break}
        }
      } else result=b.step(dt)
      this.residual=result.residual;this.converged=result.converged
      if(result.converged){
        this.time=b.time
        const swimmer=this.item.id==='robot-swim',scale=swimmer?36:4,offset=swimmer?.05:0
        for(let i=0;i<this.particles.length;i++)this.particles[i].p=[(b.q[2*i]-offset)*scale,b.q[2*i+1]*scale,0]
      }
    } else if(this.item.id==='mass-single') {
      ;[this.x,this.scalarV]=oscillatorStep(this.x,this.scalarV,this.time,dt,this.params.load,this.params.stiffness,this.params.damping)
      this.time+=dt;this.particles[1].p=[.7+(this.x-1)*2.6,0,0]
    } else if(this.item.id==='mass-multi') {
      const next=chainStep(this.q,this.velocities,this.time,dt,this.params.load,this.params.stiffness,this.params.damping)
      this.q=next.q;this.velocities=next.v;this.time+=dt
      for(let i=1;i<4;i++)this.particles[i].p=[this.particles[i].base[0]+this.q[i-1]*.8,0,0]
    } else this.proxyStep(dt)
  }
  frame():Frame {
    let displacement:number, energy:number|null=null,unit='相对长度',loadCurve:LoadCurveValue|undefined
    const p=this.particles[this.probe].p
    if(this.net){displacement=this.net.q[2]-this.net.initial[2];energy=this.net.energy();unit='m'}
    else if(this.axisShell){
      const shell=this.axisShell,inflation=this.item.id==='axis-inflate',probe=inflation?0:Math.floor((shell.n-1)/2)
      displacement=shell.q[2*probe+1]-shell.initial[2*probe+1];energy=shell.energy();unit='m'
      loadCurve=inflation?{x:displacement,y:10000*shell.time*this.params.load,xLabel:'中心位移',yLabel:'压力',xUnit:'m',yUnit:'Pa'}:{x:shell.initial[1]-shell.q[1],y:shell.reaction,xLabel:'加载位移',yLabel:'约束反力',xUnit:'m',yUnit:'N'}
    }
    else if(this.axisMembrane){displacement=this.axisMembrane.q[0]-1.2;energy=this.axisMembrane.energy();unit='m'}
    else if(this.beam){displacement=this.item.id==='robot-swim'?this.beam.q[2*this.probe]-.1:this.beam.q[2*this.probe+1];energy=this.beam.energy();unit='m'}
    else if(this.item.id==='mass-single'){displacement=this.x-1;energy=.5*this.params.stiffness*(this.x-1)**2;unit='m'}
    else if(this.item.id==='mass-multi'){
      displacement=this.q[2];unit='m'
      const k=[10,20,30].map(x=>x*this.params.stiffness)
      energy=.5*(k[0]*this.q[0]**2+k[1]*(this.q[1]-this.q[0])**2+k[2]*(this.q[2]-this.q[1])**2)
    }
    else {displacement=p[1]-this.initialProbe[1];if(this.item.model==='ribbon')displacement=p[2]-this.initialProbe[2]}
    const axis=this.axisMembrane??this.axisShell
    const shellPhase=this.axisShell?(this.item.id==='axis-inflate'?'压力递增 · 静态平衡':this.axisShell.branchSwitches?'位移控制 · 已切换平衡分支':'位移控制 · 静态平衡'):undefined
    return {positions:this.particles.map(x=>copy(x.p)),edges:this.edges,faces:this.faces,fixed:this.particles.flatMap((p,i)=>p.fixed?[i]:[]),time:this.time,displacement,energy,residual:this.residual,converged:this.converged,unit,isApproximation:this.item.method==='proxy',numericalNodes:axis?.n,numericalEdges:this.axisShell?this.axisShell.n-1:this.axisMembrane?.n,meridionalStrain:this.axisShell?.maxMeridionalStrain(),netStrain:this.net?.maxEdgeStrain(),loadCurve,phase:this.prescribedBeam?.phase()??this.softRobot?.phase()??shellPhase??(this.item.id==='hyper-cable'?'均布节点力递增':this.axisMembrane?'负压力幅值递增 · 轴对称':undefined)}
  }
  snapshot():Snapshot {const axis=this.axisMembrane??this.axisShell;return {time:this.time,positions:this.particles.map(p=>copy(p.p)),velocities:this.particles.map(p=>copy(p.v)),residual:this.residual,converged:this.converged,beamQ:this.beam?[...this.beam.q]:undefined,beamV:this.beam?[...this.beam.v]:undefined,axisQ:axis?[...axis.q]:undefined,axisV:axis?[...axis.v]:undefined,axisReaction:this.axisShell?.reaction,axisBranches:this.axisShell?.branchSwitches,netQ:this.net?[...this.net.q]:undefined,netV:this.net?[...this.net.v]:undefined,prescribedBeam:this.prescribedBeam?.snapshot(),q:[...this.q],v:[...this.velocities],x:this.x,scalarV:this.scalarV}}
  restore(s:Snapshot) {
    this.time=s.time;this.particles.forEach((p,i)=>{p.p=copy(s.positions[i]);p.v=copy(s.velocities[i])})
    if(this.beam&&s.beamQ&&s.beamV){this.beam.q=[...s.beamQ];this.beam.v=[...s.beamV];this.beam.time=s.time}
    if(this.axisMembrane&&s.axisQ&&s.axisV){this.axisMembrane.q=[...s.axisQ];this.axisMembrane.v=[...s.axisV];this.axisMembrane.time=s.time}
    if(this.axisShell&&s.axisQ&&s.axisV){this.axisShell.q=[...s.axisQ];this.axisShell.v=[...s.axisV];this.axisShell.time=s.time;this.axisShell.reaction=s.axisReaction??0;this.axisShell.branchSwitches=s.axisBranches??0}
    if(this.net&&s.netQ&&s.netV){this.net.q=Float64Array.from(s.netQ);this.net.v=Float64Array.from(s.netV);this.net.time=s.time}
    if(this.prescribedBeam&&s.prescribedBeam)this.prescribedBeam.restore(s.prescribedBeam)
    if(s.q)this.q=[...s.q];if(s.v)this.velocities=[...s.v];if(s.x!==undefined)this.x=s.x;if(s.scalarV!==undefined)this.scalarV=s.scalarV
    this.converged=s.converged;this.residual=s.residual
  }
}
