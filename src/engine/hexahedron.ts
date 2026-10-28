/** Trilinear eight-node hexahedron with full 2x2x2 integration. */
import type {Mesh3D,Vec3} from './gripper3d'
export interface Hex3D {nodes:number[];gradients:Vec3[][];weight:number}
export function hexesFromStructuredTets(mesh:Mesh3D):Hex3D[]{
  if(mesh.tets.length%6)throw Error('Expected six tetrahedra per structured cell')
  const hexes:Hex3D[]=[]
  for(let n=0;n<mesh.tets.length;n+=6){
    const ids=[...new Set(mesh.tets.slice(n,n+6).flatMap(t=>t.nodes))]
    if(ids.length!==8)throw Error('Invalid structured hexahedron')
    const p=ids.map(i=>mesh.reference[i]),lo=[0,1,2].map(k=>Math.min(...p.map(x=>x[k]))),hi=[0,1,2].map(k=>Math.max(...p.map(x=>x[k]))),nodes=Array<number>(8)
    for(const id of ids){const x=mesh.reference[id],index=(x[0]>(lo[0]+hi[0])/2?1:0)+(x[1]>(lo[1]+hi[1])/2?2:0)+(x[2]>(lo[2]+hi[2])/2?4:0);nodes[index]=id}
    const h=hi.map((v,i)=>v-lo[i]),gradients:Vec3[][]=[],z=1/Math.sqrt(3)
    for(const xi of [-z,z])for(const eta of [-z,z])for(const zeta of [-z,z]){
      gradients.push(Array.from({length:8},(_,i)=>{const sx=(i&1)?1:-1,sy=(i&2)?1:-1,sz=(i&4)?1:-1;return [sx*(1+sy*eta)*(1+sz*zeta)/(4*h[0]),sy*(1+sx*xi)*(1+sz*zeta)/(4*h[1]),sz*(1+sx*xi)*(1+sy*eta)/(4*h[2])] as Vec3}))
    }
    hexes.push({nodes,gradients,weight:h[0]*h[1]*h[2]/8})
  }
  return hexes
}
export function neoHookeanHex(positions:readonly Vec3[],hex:Hex3D,E:number,nu:number,withHessian=true){
  const mu=E/(2*(1+nu)),lambda=E*nu/((1+nu)*(1-2*nu)),gradient=new Float64Array(24),hessian=withHessian?new Float64Array(24*24):new Float64Array(0)
  let energy=0,minJ=Infinity,stress=0
  for(const gradients of hex.gradients){
    const F=new Float64Array(9)
    for(let a=0;a<8;a++){const x=positions[hex.nodes[a]],g=gradients[a];for(let i=0;i<3;i++)for(let j=0;j<3;j++)F[3*i+j]+=x[i]*g[j]}
    const [a,b,c,d,e,f,g,h,i]=F,J=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g)
    if(!(J>1e-8)||!Number.isFinite(J))throw Error('Inverted hexahedral integration point')
    minJ=Math.min(minJ,J)
    const inv=[(e*i-f*h)/J,(c*h-b*i)/J,(b*f-c*e)/J,(f*g-d*i)/J,(a*i-c*g)/J,(c*d-a*f)/J,(d*h-e*g)/J,(b*g-a*h)/J,(a*e-b*d)/J],invT=[inv[0],inv[3],inv[6],inv[1],inv[4],inv[7],inv[2],inv[5],inv[8]],ln=Math.log(J),coefficient=lambda*ln-mu,P=Array.from(F,(v,k)=>mu*v+coefficient*invT[k]),weight=hex.weight
    energy+=weight*(.5*mu*(F.reduce((s,v)=>s+v*v,0)-3)-mu*ln+.5*lambda*ln*ln)
    const u=gradients.map(x=>[0,1,2].map(i=>invT[3*i]*x[0]+invT[3*i+1]*x[1]+invT[3*i+2]*x[2]))
    for(let n=0;n<8;n++)for(let x=0;x<3;x++){
      const q=gradients[n];gradient[3*n+x]+=weight*(P[3*x]*q[0]+P[3*x+1]*q[1]+P[3*x+2]*q[2])
      if(withHessian)for(let m=0;m<8;m++)for(let y=0;y<3;y++){
        const z=gradients[m],product=q[0]*z[0]+q[1]*z[1]+q[2]*z[2]
        hessian[(3*n+x)*24+3*m+y]+=weight*(mu*(x===y?product:0)+(mu-lambda*ln)*u[m][x]*u[n][y]+lambda*u[n][x]*u[m][y])
      }
    }
    const sigma=new Float64Array(9);for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++)sigma[3*x+y]+=P[3*x+z]*F[3*y+z]/J
    const mean=(sigma[0]+sigma[4]+sigma[8])/3;let dev2=0;for(let x=0;x<3;x++)for(let y=0;y<3;y++){const z=sigma[3*x+y]-(x===y?mean:0);dev2+=z*z}
    stress+=Math.sqrt(1.5*dev2)/8
  }
  return {energy,gradient,hessian,minJ,vonMises:stress}
}
