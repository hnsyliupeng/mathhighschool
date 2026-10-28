/**
 * A single two-edge spatial-rod geometry, following the DDG tutorial's
 * InitialBendingElement/material-frame conventions. This is NOT a spatial
 * rod time integrator: referenceTwist is supplied by the caller and no forces,
 * Hessians, history transport or boundary conditions are assembled here.
 */
export type Vector3 = [number,number,number]
export interface SpatialRodInput {
  points: [Vector3,Vector3,Vector3]
  theta: [number,number]
  referenceTwist?: number
  restTwist?: number
  restKappa?: [number,number]
  restVoronoi?: number
  bendingStiffness?: number
  torsionalStiffness?: number
  /** Optional world axis used to initialize d1; defaults to the source's z axis. */
  referenceAxis?: Vector3
}
const add=(a:Vector3,b:Vector3):Vector3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const sub=(a:Vector3,b:Vector3):Vector3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const mul=(a:Vector3,s:number):Vector3=>[s*a[0],s*a[1],s*a[2]]
const dot=(a:Vector3,b:Vector3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross=(a:Vector3,b:Vector3):Vector3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const norm=(a:Vector3)=>Math.hypot(...a)
const unit=(a:Vector3,label:string):Vector3=>{const n=norm(a);if(!Number.isFinite(n)||n<1e-12)throw Error(`${label} is degenerate`);return mul(a,1/n)}

/** Shortest-arc parallel transport; antiparallel tangents are undefined. */
export function parallelTransport(u:Vector3,t1:Vector3,t2:Vector3):Vector3 {
  if(u.some(x=>!Number.isFinite(x)))throw Error('Non-finite transported vector')
  const a=unit(t1,'first tangent'),b=unit(t2,'second tangent'),c=dot(a,b),axis=cross(a,b),s=norm(axis)
  if(c<-1+1e-12)throw Error('Antiparallel tangents make parallel transport ambiguous')
  if(s<1e-14)return [...u]
  const k=mul(axis,1/s)
  // Rodrigues' shortest rotation maps the entire frame from a to b.
  return add(add(mul(u,c),mul(cross(k,u),s)),mul(k,dot(k,u)*(1-c)))
}

export function spatialRodGeometry(input:SpatialRodInput) {
  const {points,theta}=input,referenceTwist=input.referenceTwist??0,restTwist=input.restTwist??0,restKappa=input.restKappa??[0,0]
  const all=[...points.flat(),...theta,referenceTwist,restTwist,...restKappa,...(input.referenceAxis??[])];if(all.some(v=>!Number.isFinite(v)))throw Error('Non-finite rod input')
  const e=sub(points[1],points[0]),f=sub(points[2],points[1]),le=norm(e),lf=norm(f),te=unit(e,'first edge'),tf=unit(f,'second edge')
  const chi=1+dot(te,tf);if(chi<1e-12)throw Error('Antiparallel edges make discrete curvature singular')
  let trial=cross(te,input.referenceAxis??[0,0,1])
  // The original initialization falls back to the y axis when the tangent is parallel to z.
  if(norm(trial)<1e-6)trial=cross(te,[0,1,0])
  if(norm(trial)<1e-6)trial=cross(te,[1,0,0]) // for a caller-provided axis parallel to y
  const d1e=unit(trial,'reference frame'),d2e=unit(cross(te,d1e),'reference frame')
  const d1f=unit(parallelTransport(d1e,te,tf),'transported frame'),d2f=unit(cross(tf,d1f),'transported frame')
  const material=(d1:Vector3,d2:Vector3,angle:number):[Vector3,Vector3]=>[add(mul(d1,Math.cos(angle)),mul(d2,Math.sin(angle))),add(mul(d2,Math.cos(angle)),mul(d1,-Math.sin(angle)))]
  const [m1e,m2e]=material(d1e,d2e,theta[0]),[m1f,m2f]=material(d1f,d2f,theta[1])
  const kb=mul(cross(te,tf),2/chi),kappa:[number,number]=[.5*dot(kb,add(m2e,m2f)),-.5*dot(kb,add(m1e,m1f))]
  const twist=theta[1]-theta[0]+referenceTwist,voronoi=input.restVoronoi??(le+lf)/2,ei=input.bendingStiffness??1,gj=input.torsionalStiffness??1
  if(!Number.isFinite(voronoi)||voronoi<=0||!Number.isFinite(ei)||ei<0||!Number.isFinite(gj)||gj<0)throw Error('Invalid reference length or stiffness')
  const bendingEnergy=ei/(2*voronoi)*((kappa[0]-restKappa[0])**2+(kappa[1]-restKappa[1])**2)
  const twistingEnergy=gj/(2*voronoi)*(twist-restTwist)**2
  return {te,tf,d1e,d2e,d1f,d2f,m1e,m2e,m1f,m2f,kb,kappa,twist,voronoi,bendingEnergy,twistingEnergy}
}

/** Energy derivatives with respect to the two material angles only. */
export function spatialRodAngleGradient(input:SpatialRodInput) {
  const g=spatialRodGeometry(input),rest=input.restKappa??[0,0],restTwist=input.restTwist??0,ei=input.bendingStiffness??1,gj=input.torsionalStiffness??1
  const curvatureGradient=(m1:Vector3,m2:Vector3)=>[-.5*dot(g.kb,m1),-.5*dot(g.kb,m2)]
  const ge=curvatureGradient(g.m1e,g.m2e),gf=curvatureGradient(g.m1f,g.m2f)
  const bendAt=(v:number[])=>ei/g.voronoi*((g.kappa[0]-rest[0])*v[0]+(g.kappa[1]-rest[1])*v[1])
  const t=gj/g.voronoi*(g.twist-restTwist)
  return {bending:[bendAt(ge),bendAt(gf)] as [number,number],twisting:[-t,t] as [number,number]}
}
