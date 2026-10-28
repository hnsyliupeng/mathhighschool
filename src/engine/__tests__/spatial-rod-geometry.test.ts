import {describe,expect,it} from 'vitest'
import {parallelTransport,spatialRodGeometry,spatialRodAngleGradient,type SpatialRodInput,type Vector3} from '../spatial-rod-geometry'
import reference from '../../data/references/spatial-rod-geometry-reference.json'

const dot=(a:Vector3,b:Vector3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross=(a:Vector3,b:Vector3):Vector3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const close=(a:number,b:number,tol=2e-12)=>expect(Math.abs(a-b)).toBeLessThan(tol)
const closeVec=(a:number[],b:number[],tol=2e-12)=>{expect(a).toHaveLength(b.length);a.forEach((x,i)=>close(x,b[i],tol))}
const input=(value:unknown)=>value as SpatialRodInput

describe('spatial-rod material frames and local geometry (not a solver)',()=>{
  it.each(reference.fixtures)('matches upstream Octave local initialization: $input.name',({input:fixture,expected})=>{
    const actual=spatialRodGeometry(input(fixture))
    for(const key of ['te','tf','d1e','d2e','d1f','d2f','m1e','m2e','m1f','m2f','kb','kappa'] as const)closeVec(actual[key],expected[key])
    close(actual.twist,expected.twist);close(actual.bendingEnergy,expected.bendingEnergy);close(actual.twistingEnergy,expected.twistingEnergy)
    const gradient=spatialRodAngleGradient(input(fixture));closeVec(gradient.bending,expected.bendingGradient);closeVec(gradient.twisting,expected.twistingGradient)
    const h=1e-6
    for(let i=0;i<2;i++){
      const plus=input(fixture),minus=input(fixture),tp:[number,number]=[...plus.theta],tm:[number,number]=[...minus.theta];tp[i]+=h;tm[i]-=h
      const a=spatialRodGeometry({...plus,theta:tp}),b=spatialRodGeometry({...minus,theta:tm})
      close((a.bendingEnergy-b.bendingEnergy)/(2*h),gradient.bending[i],1e-8)
      close((a.twistingEnergy-b.twistingEnergy)/(2*h),gradient.twisting[i],1e-8)
    }
    for(const [t,m1,m2] of [[actual.te,actual.m1e,actual.m2e],[actual.tf,actual.m1f,actual.m2f]] as [Vector3,Vector3,Vector3][]){
      close(dot(t,m1),0);close(dot(t,m2),0);close(dot(m1,m2),0);close(dot(m1,m1),1);close(dot(m2,m2),1);closeVec(cross(m1,m2),t)
    }
  })
  it('recovers the integrated curvature of a planar quarter turn',()=>{
    const a=spatialRodGeometry({points:[[-1,0,0],[0,0,0],[0,1,0]],theta:[0,0]})
    closeVec(a.kb,[0,0,2]);closeVec(a.kappa,[-2,0]);close(a.twist,0)
  })
  it('gives zero local energy when the natural curvature and twist match',()=>{
    const spec:SpatialRodInput={points:[[-1,0,.1],[0,0,0],[.7,.5,.2]],theta:[.2,-.3],referenceTwist:.14}
    const x=spatialRodGeometry(spec),natural=spatialRodGeometry({...spec,restKappa:x.kappa,restTwist:x.twist})
    close(natural.bendingEnergy,0);close(natural.twistingEnergy,0)
  })
  it('is covariant under a rigid rotation when the initialization axis rotates too',()=>{
    const p:SpatialRodInput={points:[[-1,-.2,.3],[0,.1,0],[.8,.7,.4]],theta:[.3,-.4],referenceTwist:.15,referenceAxis:[0,0,1]}
    const rotate=([x,y,z]:Vector3):Vector3=>[x,-z,y]
    const a=spatialRodGeometry(p),b=spatialRodGeometry({...p,points:p.points.map(rotate) as [Vector3,Vector3,Vector3],referenceAxis:rotate(p.referenceAxis!)})
    for(const key of ['te','tf','d1e','d2e','d1f','d2f','m1e','m2e','m1f','m2f','kb'] as const)closeVec(b[key],rotate(a[key]))
    closeVec(a.kappa,b.kappa);close(a.twist,b.twist);close(a.bendingEnergy,b.bendingEnergy)
  })
  it('preserves vectors through parallel transport and its inverse',()=>{
    const t1:Vector3=[1,0,0],t2:Vector3=[0,1,0],u:Vector3=[0,0,1]
    const v=parallelTransport(u,t1,t2);closeVec(v,u);closeVec(parallelTransport(v,t2,t1),u);closeVec(parallelTransport(u,t1,t1),u)
  })
  it('rejects zero-length, antiparallel and non-finite configurations',()=>{
    expect(()=>spatialRodGeometry({points:[[0,0,0],[0,0,0],[1,0,0]],theta:[0,0]})).toThrow(/degenerate/)
    expect(()=>spatialRodGeometry({points:[[-1,0,0],[0,0,0],[-1,0,0]],theta:[0,0]})).toThrow(/Antiparallel/)
    expect(()=>parallelTransport([0,1,0],[1,0,0],[-1,0,0])).toThrow(/Antiparallel/)
    expect(()=>parallelTransport([0,NaN,0],[1,0,0],[1,0,0])).toThrow(/Non-finite/)
    expect(()=>spatialRodGeometry({points:[[-1,0,0],[0,0,0],[NaN,0,0]],theta:[0,0]})).toThrow(/Non-finite/)
  })
})
