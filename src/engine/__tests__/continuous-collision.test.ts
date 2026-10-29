import {describe,it,expect} from 'vitest'
import {movingSegmentTriangle,movingTriangles,triangleTriangleDistance} from '../continuous-collision'
import {segmentTriangleClosest} from '../segment-triangle'
import type {Vec3} from '../gripper3d'
type Tri=[Vec3,Vec3,Vec3];type Seg=[Vec3,Vec3]
const tri:Tri=[[0,0,0],[1,0,0],[0,1,0]]
describe('conservative time-of-motion collision checks',()=>{
  it('rejects a tendon that tunnels through a surface between safe endpoints',()=>{
    const start:Seg=[[.1,.2,1],[.3,.2,1]],end:Seg=[[.1,.2,-1],[.3,.2,-1]]
    expect(segmentTriangleClosest(...start,...tri).distance).toBe(1);expect(segmentTriangleClosest(...end,...tri).distance).toBe(1)
    const result=movingSegmentTriangle(start,end,tri,tri,.1);expect(result.safe).toBe(false);expect(result.time).toBeLessThan(.5)
  })
  it('rejects moving triangle tunnelling and detects a coplanar overlap',()=>{
    const start:Tri=[[.1,.1,1],[.4,.1,1],[.1,.4,1]],end:Tri=[[.1,.1,-1],[.4,.1,-1],[.1,.4,-1]]
    expect(triangleTriangleDistance(start,tri)).toBeCloseTo(1,12);expect(triangleTriangleDistance(end,tri)).toBeCloseTo(1,12)
    expect(movingTriangles(start,end,tri,tri).safe).toBe(false)
    expect(triangleTriangleDistance([[.1,.1,0],[.4,.1,0],[.1,.4,0]],tri)).toBe(0)
  })
  it('certifies common translation and separated relative motion',()=>{
    const start:Seg=[[.1,.2,.5],[.3,.2,.5]],move=(p:Vec3):Vec3=>[p[0]+10,p[1]-4,p[2]+3]
    const end=start.map(move) as Seg,moved=tri.map(move) as Tri
    const same=movingSegmentTriangle(start,end,tri,moved,.1);expect(same.safe).toBe(true);expect(same.iterations).toBe(1)
    const away:Seg=[[.1,.2,1],[.3,.2,1]];expect(movingSegmentTriangle(start,away,tri,tri,.1).safe).toBe(true)
  })
  it('fails closed on invalid clearances, motion data, or iteration budgets',()=>{
    const overlapping:Seg=[[.1,.1,0],[.2,.2,0]],separated:Seg=[[.1,.1,1],[.2,.2,1]]
    for(const clearance of [-1,NaN,Infinity])expect(movingSegmentTriangle(overlapping,overlapping,tri,tri,clearance).safe).toBe(false)
    expect(movingSegmentTriangle(separated,separated,tri,tri,.1,0).safe).toBe(false)
    const invalid:Seg=[[NaN,.1,1],[.2,.2,1]]
    expect(movingSegmentTriangle(invalid,invalid,tri,tri,.1).safe).toBe(false)
  })
  it('never reports a barely grazing trajectory as safe',()=>{
    const start:Seg=[[-1,.2,.099],[2,.2,.099]],end:Seg=[[-1,.3,.099],[2,.3,.099]]
    expect(movingSegmentTriangle(start,end,tri,tri,.1).safe).toBe(false)
    const limited=movingSegmentTriangle([[.1,.2,.11],[.3,.2,.11]],[[.2,.2,.11],[.4,.2,.11]],tri,tri,.1,1)
    expect(limited.safe).toBe(false);expect(limited.reason).toBe('indeterminate')
  })
})
