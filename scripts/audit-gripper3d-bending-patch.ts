/* Manufactured infinitesimal pure-bending patch for the actual Q1 mesh.
 *
 * The analytical displacement has uniaxial strain eps_xx=-k(y-y0),
 * eps_yy=eps_zz=nu*k(y-y0), and zero shear. Evaluate the trilinear
 * interpolant's small-strain energy and compare it with the exact strain
 * energy integrated over the SAME hollow, toothed reference volume.
 * This is a discretization diagnostic, not a loaded gripper solve.
 *
 *   npx vite-node scripts/audit-gripper3d-bending-patch.ts
 */
import {writeFileSync} from 'node:fs'
import {makeGripper3DMesh,type Vec3} from '../src/engine/gripper3d'
import {hexesFromStructuredTets} from '../src/engine/hexahedron'

const E=250_000,nu=.35,curvature=.02,y0=.0035,z0=.004
const mu=E/(2*(1+nu)),lambda=E*nu/((1+nu)*(1-2*nu))
const displacement=([x,y,z]:Vec3):Vec3=>{
  const Y=y-y0,Z=z-z0
  return [-curvature*x*Y,curvature*(x*x+nu*(Y*Y-Z*Z))/2,nu*curvature*Y*Z]
}
const result=[]
for(const level of [1,2,3] as const){
  const mesh=makeGripper3DMesh(level),hexes=hexesFromStructuredTets(mesh),u=mesh.reference.map(displacement)
  type Accumulator={exact:number;normal:number;shear:number}
  const total:Accumulator={exact:0,normal:0,shear:0},bridge:Accumulator={exact:0,normal:0,shear:0}
  for(const hex of hexes){
    const ref=hex.nodes.map(i=>mesh.reference[i]),centerX=ref.reduce((a,p)=>a+p[0],0)/8
    const a=(centerX>.020&&centerX<.08/12*5)||(centerX>.08/12*8&&centerX<.08/12*10)?bridge:null
    let normal=0,shear=0
    for(const gradient of hex.gradients){
    const H=Array.from({length:3},()=>[0,0,0])
    for(let a=0;a<8;a++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)H[i][j]+=u[hex.nodes[a]][i]*gradient[a][j]
    const ex=H[0][0],ey=H[1][1],ez=H[2][2],exy=(H[0][1]+H[1][0])/2,exz=(H[0][2]+H[2][0])/2,eyz=(H[1][2]+H[2][1])/2
    normal+=hex.weight*(mu*(ex*ex+ey*ey+ez*ez)+lambda/2*(ex+ey+ez)**2)
    shear+=hex.weight*2*mu*(exy*exy+exz*exz+eyz*eyz)
    }
    // Analytic integral of 1/2 E k^2 (y-y0)^2 over this reference cell.
    const lo=Math.min(...ref.map(v=>v[1]))-y0,hi=Math.max(...ref.map(v=>v[1]))-y0
    const exact=.5*E*curvature**2*(8*hex.weight)*(lo*lo+lo*hi+hi*hi)/3
    for(const b of a?[total,a]:[total]){b.exact+=exact;b.normal+=normal;b.shear+=shear}
  }
  const values=({exact,normal,shear}:Accumulator)=>({exactEnergyJ:exact,normalEnergyJ:normal,spuriousShearEnergyJ:shear,interpolatedEnergyJ:normal+shear,excessPercent:100*((normal+shear)/exact-1),spuriousShearPercentOfExact:100*shear/exact})
  result.push({level,nodes:mesh.reference.length,hexes:hexes.length,total:values(total),betweenPads:values(bridge)})
}
const report={test:'manufactured small-strain pure bending on the actual three-dimensional hollow reference mesh',parameters:{youngPa:E,poisson:nu,curvaturePerM:curvature,neutralAxisYM:y0,axisZM:z0},result,scope:'fixed manufactured nodal displacement, not equilibrium under the gripper loading or an independent full-trajectory validation'}
console.log(JSON.stringify(report,null,2))
writeFileSync('docs/screenshots/gripper3d-bending-patch-audit.json',JSON.stringify(report,null,2)+'\n')
