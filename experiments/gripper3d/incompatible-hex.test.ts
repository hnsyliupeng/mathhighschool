import {describe,it,expect} from 'vitest'
import {makeGripper3DMesh,type Vec3} from '../../src/engine/gripper3d'
import {hexesFromStructuredTets,neoHookeanHex} from '../../src/engine/hexahedron'
import {neoHookeanHexEnhanced} from './incompatible-hex'

const mesh=makeGripper3DMesh(),hex=hexesFromStructuredTets(mesh)[0],E=250000,nu=.35
const maxAbs=(v:ArrayLike<number>)=>Math.max(...Array.from(v,Math.abs))
describe('research-only statically condensed incompatible-mode hex',()=>{
  it('preserves affine energy and forces and is objective under a rigid rotation',()=>{
    const p=mesh.reference.map(([x,y,z]):Vec3=>[1.02*x+.03*y,.015*x+1.01*y,z*.99+.01*x]),a=neoHookeanHex(p,hex,E,nu),b=neoHookeanHexEnhanced(p,hex,E,nu)
    expect(Math.abs(a.energy-b.energy)).toBeLessThan(1e-15)
    expect(maxAbs(a.gradient.map((v,i)=>v-b.gradient[i]))).toBeLessThan(1e-9)
    const rotated=p.map(([x,y,z]):Vec3=>[-y+.08,x-.04,z+.03]),r=neoHookeanHexEnhanced(rotated,hex,E,nu)
    expect(Math.abs(r.energy-b.energy)).toBeLessThan(1e-14)
    const rigid=mesh.reference.map(([x,y,z]):Vec3=>[-y+.1,x-.2,z+.03]),q=neoHookeanHexEnhanced(rigid,hex,E,nu)
    expect(Math.abs(q.energy)).toBeLessThan(1e-15);expect(maxAbs(q.gradient)).toBeLessThan(1e-9)
  })
  it('differentiates the minimized energy and condensed tangent on a distorted element',()=>{
    const p=mesh.reference.map(([x,y,z]):Vec3=>[x+.08*x*y,y+.1*x*x,z-.1*y*y]),f=neoHookeanHexEnhanced(p,hex,E,nu),v=Array.from({length:24},(_,i)=>Math.sin(1.23*i)),h=1e-7
    const shifted=(sign:number)=>{const q=p.map(x=>[...x] as Vec3);hex.nodes.forEach((id,j)=>{for(let i=0;i<3;i++)q[id][i]+=sign*h*v[3*j+i]});return neoHookeanHexEnhanced(q,hex,E,nu,false)}
    const up=shifted(1),down=shifted(-1),gradient=v.reduce((s,x,i)=>s+x*f.gradient[i],0),fd=(up.energy-down.energy)/(2*h)
    expect(Math.abs(gradient-fd)).toBeLessThan(1e-7)
    let error=0;for(let i=0;i<24;i++){const hv=v.reduce((s,x,j)=>s+f.hessian[24*i+j]*x,0);error=Math.max(error,Math.abs(hv-(up.gradient[i]-down.gradient[i])/(2*h)))}
    expect(error).toBeLessThan(.01);expect(f.localResidual).toBeLessThan(1e-8)
  })
})
