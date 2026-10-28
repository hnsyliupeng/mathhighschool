import {describe,it,expect} from 'vitest'
import {hexesFromStructuredTets,neoHookeanHex} from '../hexahedron'
import {makeGripper3DMesh} from '../gripper3d'
describe('trilinear integrated three-dimensional hexahedra',()=>{
  const mesh=makeGripper3DMesh(1),hex=hexesFromStructuredTets(mesh)[10]
  it('preserves cell volume and has zero energy under rigid rotation',()=>{
    const hs=hexesFromStructuredTets(mesh);expect(hs).toHaveLength(mesh.tets.length/6)
    expect(hs.reduce((s,h)=>s+8*h.weight,0)).toBeCloseTo(mesh.tets.reduce((s,t)=>s+t.volume,0),15)
    const p=mesh.reference.map(([x,y,z]):[number,number,number]=>[-y+.1,x-.2,z+.03]),e=neoHookeanHex(p,hex,250000,.35)
    expect(Math.abs(e.energy)).toBeLessThan(1e-15);expect(e.minJ).toBeCloseTo(1,12);expect(Math.hypot(...e.gradient)).toBeLessThan(1e-10)
  })
  it('has energy gradient and consistent tangent matching central differences',()=>{
    const p=mesh.reference.map(([x,y,z]):[number,number,number]=>[1.02*x+.02*y,-.01*x+.98*y,.03*y+1.01*z]),e=neoHookeanHex(p,hex,250000,.35,true),h=1e-7
    let eg=0,eh=0
    for(let j=0;j<24;j++){
      const node=hex.nodes[Math.floor(j/3)],dim=j%3,x=p.map(v=>[...v] as [number,number,number]),y=p.map(v=>[...v] as [number,number,number]);x[node][dim]+=h;y[node][dim]-=h
      const up=neoHookeanHex(x,hex,250000,.35,false),down=neoHookeanHex(y,hex,250000,.35,false)
      eg=Math.max(eg,Math.abs((up.energy-down.energy)/(2*h)-e.gradient[j]))
      for(let i=0;i<24;i++)eh=Math.max(eh,Math.abs((up.gradient[i]-down.gradient[i])/(2*h)-e.hessian[24*i+j]))
    }
    expect(eg).toBeLessThan(1e-8);expect(eh).toBeLessThan(.01)
  })
})
