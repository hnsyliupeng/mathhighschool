import { PlanarBeam, type BeamExternalForce, type NewtonResult, type Vec2 } from './planar'

export type SoftRobotKind = 'magnetic'|'swimmer'
export interface SoftRobotParams {nodes:number;stiffness:number;load:number;damping:number}
export interface LocalForce {force:number[];jacobian:number[][]}

/**
 * The upstream planar magnetic term, expressed as a scalar energy in its sign
 * convention: U=A L0 [(t0·Br)(t·Ba)+(n0·Br)(n·Ba)].
 * Force is -dU/dq. Br, Ba are the source code's numerical field parameters;
 * they are not automatically interpreted as calibrated SI magnetic units.
 */
export function magneticEdge(a:Vec2,b:Vec2,rest:number,area:number,referenceTangent:Vec2,br:Vec2,ba:Vec2):LocalForce & {energy:number} {
  const ex=b[0]-a[0],ey=b[1]-a[1],l=Math.hypot(ex,ey)
  if(l<1e-12||rest<=0)throw Error('Degenerate magnetic edge')
  const t=[ex/l,ey/l],n0=[-referenceTangent[1],referenceTangent[0]]
  const along=referenceTangent[0]*br[0]+referenceTangent[1]*br[1],normal=n0[0]*br[0]+n0[1]*br[1]
  // n=R t; Ba·R t=(R^T Ba)·t.
  const h=[along*ba[0]+normal*ba[1],along*ba[1]-normal*ba[0]]
  const ht=h[0]*t[0]+h[1]*t[1],c=area*rest
  const g=t.map((x,i)=>c*(h[i]-ht*x)/l)
  const H=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>c/(l*l)*(-ht*(i===j?1:0)-t[i]*h[j]-h[i]*t[j]+3*ht*t[i]*t[j])))
  // F_a=+dU/de, F_b=-dU/de.
  const force=[g[0],g[1],-g[0],-g[1]]
  const jacobian=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>H[i%2][j%2]*((i<2)===(j<2)?-1:1)))
  return {energy:c*ht,force,jacobian}
}

/**
 * Quadratic anisotropic drag from soft_robot/case_2/getFd.m. Deliberately
 * preserves the original's duplicated endpoint-1 velocity for both endpoints.
 * The default Jacobian differentiates that actual force, including geometry and
 * cross-node dependence. `sourceJacobian` reproduces the source's approximate
 * block-diagonal Jacobian solely for a separately identified reference replay.
 */
export function sourceDragEdge(a:Vec2,b:Vec2,oldA:Vec2,dt:number,radius:number,sourceJacobian=false):LocalForce {
  const ex=b[0]-a[0],ey=b[1]-a[1],l=Math.hypot(ex,ey)
  if(l<1e-12||dt<=0)throw Error('Degenerate drag edge or time step')
  const t=[ex/l,ey/l],n=[-t[1],t[0]],v=[(a[0]-oldA[0])/dt,(a[1]-oldA[1])/dt]
  const vt=t[0]*v[0]+t[1]*v[1],vn=n[0]*v[0]+n[1]*v[1],ct=.01,cn=1
  const c=1000*(2*radius)/4
  const g=t.map((x,i)=>ct*Math.abs(vt)*vt*x+cn*Math.abs(vn)*vn*n[i])
  const f=g.map(x=>-c*l*x),force=[f[0],f[1],f[0],f[1]]
  const jacobian=Array.from({length:4},()=>new Array<number>(4).fill(0))
  if(sourceJacobian){
    // Upstream assumes each end depends on its own velocity and neglects the
    // geometry derivatives, although both force values use endpoint 1.
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
      const value=-2*c*l/dt*(ct*Math.abs(vt)*t[row]*t[col]+cn*Math.abs(vn)*n[row]*n[col])
      jacobian[row][col]=value;jacobian[row+2][col+2]=value
    }
  } else {
    for(let j=0;j<4;j++) {
      const axis=j%2,edgeSign=j<2?-1:1,dl=t[axis]*edgeSign
      const dAngle=n[axis]*edgeSign/l,dtan=[n[0]*dAngle,n[1]*dAngle],dn=[-t[0]*dAngle,-t[1]*dAngle]
      const dv=[j===0?1/dt:0,j===1?1/dt:0]
      const dvt=dtan[0]*v[0]+dtan[1]*v[1]+t[0]*dv[0]+t[1]*dv[1]
      const dvn=dn[0]*v[0]+dn[1]*v[1]+n[0]*dv[0]+n[1]*dv[1]
      for(let i=0;i<2;i++){
        const dg=ct*(2*Math.abs(vt)*dvt*t[i]+Math.abs(vt)*vt*dtan[i])+cn*(2*Math.abs(vn)*dvn*n[i]+Math.abs(vn)*vn*dn[i])
        const value=-c*(dl*g[i]+l*dg)
        jacobian[i][j]=value;jacobian[i+2][j]=value
      }
    }
  }
  return {force,jacobian}
}

/** soft_robot/case_1 and case_2 on the shared planar DDG beam. */
export class SoftRobot {
  readonly beam:PlanarBeam
  readonly kind:SoftRobotKind
  readonly params:SoftRobotParams
  readonly referenceCompatibility:boolean
  readonly radius:number
  constructor(kind:SoftRobotKind,params:SoftRobotParams,referenceCompatibility=false){
    this.kind=kind;this.params={...params};this.referenceCompatibility=referenceCompatibility
    const n=params.nodes,length=kind==='magnetic'?1:.1
    this.radius=kind==='magnetic'?.01:.001
    // Four-decimal reference nodes exactly match the 40-node input files.
    const points=Array.from({length:n},(_,i):Vec2=>[Math.round(((kind==='magnetic'?-.5:0)+length*i/(n-1))*1e4)/1e4,0])
    this.beam=new PlanarBeam({nodes:n,length,young:params.stiffness*1e6,radius:this.radius,density:kind==='magnetic'?10:1000,gravity:0,damping:params.damping,
      referenceNodes:points,...(kind==='magnetic'?{fixedNodes:[0,1]}:{fixedDofs:[2*n-1]}),referenceJacobian:referenceCompatibility})
  }
  step(dt:number):NewtonResult {
    const beam=this.beam,n=beam.n,t=beam.time,area=Math.PI*this.radius**2,kind=this.kind,scale=this.params.load
    const ba:Vec2=kind==='magnetic'?[3*scale*Math.cos(t),3*scale*Math.sin(t)]:[scale*Math.sin(20*t),scale*Math.cos(20*t)]
    const compatibility=this.referenceCompatibility
    const externalForce:BeamExternalForce=(q,old,_oldV,h,withJacobian)=>{
      const force=new Array<number>(q.length).fill(0)
      const jacobian=withJacobian?Array.from({length:q.length},()=>new Array<number>(q.length).fill(0)):undefined
      for(let i=0;i<n-1;i++){
        const ids=[2*i,2*i+1,2*i+2,2*i+3],current=kind==='magnetic'?q:old
        const a:Vec2=[current[ids[0]],current[ids[1]]],b:Vec2=[current[ids[2]],current[ids[3]]]
        const angle=2*Math.PI*i/(n-2)
        const br:Vec2=kind==='magnetic'?[1000,0]:[100*Math.cos(angle),100*Math.sin(angle)]
        const mag=magneticEdge(a,b,beam.restLengths[i],area,[1,0],br,ba)
        let drag:LocalForce|undefined
        if(kind==='swimmer')drag=sourceDragEdge([q[ids[0]],q[ids[1]]],[q[ids[2]],q[ids[3]]],[old[ids[0]],old[ids[1]]],h,this.radius,compatibility)
        for(let r=0;r<4;r++){
          force[ids[r]]+=mag.force[r]+(drag?.force[r]??0)
          if(jacobian)for(let c=0;c<4;c++)jacobian[ids[r]][ids[c]]+=(kind==='magnetic'&&!compatibility?mag.jacobian[r][c]:0)+(drag?.jacobian[r][c]??0)
        }
      }
      return {force,jacobian}
    }
    return beam.solve(new Array(2*n).fill(0),dt,{externalForce,referenceIterations:compatibility,tolerance:kind==='swimmer'?1e-10:1e-7})
  }
  phase():string {return this.kind==='magnetic'?'旋转磁场 · 当前构型耦合':'旋转磁场 · 各向异性二次阻力'}
}
