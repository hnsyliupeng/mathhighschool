import {describe,it,expect} from 'vitest'
import {segmentTriangleClosest,segmentTriangleFeatures,closestSegments,boxDistance} from '../segment-triangle'
import type {Vec3} from '../gripper3d'

const minus=(a:Vec3,b:Vec3):Vec3=>a.map((v,i)=>v-b[i]) as Vec3
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const a:Vec3=[0,0,0],b:Vec3=[2,0,0],c:Vec3=[0,2,0]
describe('exact segment–triangle closest pair',()=>{
  it('detects a crossing between sparse sample points and coplanar crossing',()=>{
    const r=segmentTriangleClosest([.27,.44,-3],[.27,.44,7],a,b,c);expect(r.distance).toBe(0);expect(r.segmentT).toBeCloseTo(.3,12);expect(r.intersects).toBe(true)
    const coplanar=segmentTriangleClosest([-1,.7,0],[2,.7,0],a,b,c);expect(coplanar.distance).toBeLessThan(1e-12);expect(coplanar.intersects).toBe(true)
  })
  it('finds the segment-to-face, edge, endpoint, parallel and vertex minima',()=>{
    const cases:[Vec3,Vec3,number][]=[[[.2,.2,1],[.4,.4,1],1],[[1,-1,1],[1,-1,2],Math.sqrt(2)],[[3,3,2],[4,4,2],Math.sqrt(12)],[[.3,.4,1],[.3,.4,2],1]]
    for(const [p,q,d] of cases)expect(segmentTriangleClosest(p,q,a,b,c).distance).toBeCloseTo(d,10)
    expect(closestSegments([0,0,0],[2,0,0],[1,1,0],[3,1,0]).distance).toBeCloseTo(1,12)
    expect(closestSegments([0,0,0],[0,0,0],[1,0,0],[2,0,0]).distance).toBeCloseTo(1,12)
  })
  it('returns the distance gradient and balanced, torque-free forces',()=>{
    const data=[.31,.19,.31,.55,.43,.41,0,0,0, 1,0,.04, 0,1,-.02],p=(x:number[],n:number):Vec3=>[x[n],x[n+1],x[n+2]],f=(x:number[])=>segmentTriangleClosest(p(x,0),p(x,3),p(x,6),p(x,9),p(x,12))
    const g=f(data),weights=[1-g.segmentT,g.segmentT,-g.bary[0],-g.bary[1],-g.bary[2]],gradient=weights.flatMap(w=>g.normal.map(x=>w*x));let err=0
    for(let i=0;i<data.length;i++){const x=[...data],y=[...data],h=1e-6;x[i]+=h;y[i]-=h;err=Math.max(err,Math.abs((f(x).distance-f(y).distance)/(2*h)-gradient[i]))}
    expect(err).toBeLessThan(1e-6)
    const total=[0,0,0],torque=[0,0,0];for(let i=0;i<5;i++){const force=gradient.slice(3*i,3*i+3) as Vec3,moment=cross(p(data,3*i),force);for(let j=0;j<3;j++){total[j]+=force[j];torque[j]+=moment[j]}}
    expect(Math.hypot(...total)).toBeLessThan(1e-12);expect(Math.hypot(...torque)).toBeLessThan(1e-12)
    expect(Math.hypot(...minus(g.point,g.surface))).toBeCloseTo(g.distance,12)
  })
  it('covers all five separated features while still rejecting an interior piercing',()=>{
    const ordinary=segmentTriangleFeatures([.5,-.2,.3],[.5,-.2,1],a,b,c)
    expect(ordinary.map(f=>f.kind)).toEqual(['start-face','end-face','edge-ab','edge-bc','edge-ca'])
    // The first endpoint/face and segment/edge constraints coincide here:
    // duplicates are retained as redundant constraints, not extra geometry.
    expect(ordinary[0].distance).toBeCloseTo(ordinary[2].distance,12)
    expect(Math.min(...ordinary.map(f=>f.distance))).toBeCloseTo(segmentTriangleClosest([.5,-.2,.3],[.5,-.2,1],a,b,c).distance,12)
    const piercing=segmentTriangleFeatures([.4,.4,-1],[.4,.4,1],a,b,c)
    expect(Math.min(...piercing.map(f=>f.distance))).toBeGreaterThan(.3)
    expect(segmentTriangleClosest([.4,.4,-1],[.4,.4,1],a,b,c).distance).toBe(0)
    const point=segmentTriangleFeatures([.4,.3,1],[.4,.3,1],a,b,c)
    expect(point.every(f=>Number.isFinite(f.distance))).toBe(true)
    expect(Math.min(...point.map(f=>f.distance))).toBeCloseTo(1,12)
    // Degenerate boundary faces must fail closed rather than manufacture a normal.
    expect(()=>segmentTriangleClosest([.4,.3,1],[.4,.3,2],a,a,a)).toThrow('Degenerate contact triangle')
  })
  it('matches feature-distance derivatives and individually conserves force and moment',()=>{
    const data=[.31,.19,.31,.55,.43,.41,0,0,0,1,0,.04,0,1,-.02],p=(x:number[],n:number):Vec3=>[x[n],x[n+1],x[n+2]]
    const features=(x:number[])=>segmentTriangleFeatures(p(x,0),p(x,3),p(x,6),p(x,9),p(x,12))
    for(let feature=0;feature<5;feature++){
      const h=features(data)[feature],normal=minus(h.point,h.surface).map(x=>x/h.distance),weights=[1-h.segmentT,h.segmentT,-h.bary[0],-h.bary[1],-h.bary[2]],gradient=weights.flatMap(w=>normal.map(x=>w*x))
      let err=0;for(let i=0;i<data.length;i++){const x=[...data],y=[...data],eps=1e-6;x[i]+=eps;y[i]-=eps;err=Math.max(err,Math.abs((features(x)[feature].distance-features(y)[feature].distance)/(2*eps)-gradient[i]))}
      expect(err).toBeLessThan(1e-6)
      const total=[0,0,0],torque=[0,0,0];for(let i=0;i<5;i++){const force=gradient.slice(3*i,3*i+3) as Vec3,moment=cross(p(data,3*i),force);for(let j=0;j<3;j++){total[j]+=force[j];torque[j]+=moment[j]}}
      expect(Math.hypot(...total)).toBeLessThan(1e-12);expect(Math.hypot(...torque)).toBeLessThan(1e-12)
    }
  })
  it('uses an orientation-independent broad-phase lower bound',()=>{
    expect(boxDistance([[0,0,0],[1,1,1]],[[2,2,2],[3,3,3]])).toBeCloseTo(Math.sqrt(3),12)
    expect(boxDistance([[0,0,0],[1,1,1]],[[.3,.5,.6],[4,4,4]])).toBe(0)
  })
})
