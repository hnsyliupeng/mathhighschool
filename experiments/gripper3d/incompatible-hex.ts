/** Experimental statically condensed incompatible quadratic displacement modes.
 * For investigation only: global nodal variables remain Q1; 9 local DOFs are
 * minimized out of the full Neo-Hookean energy. Not validated for production. */
import type {Vec3} from '../../src/engine/gripper3d'
import type {Hex3D} from '../../src/engine/hexahedron'

// SPD solver used only for the 9 by 9 element-local Hessian.
function factor(H:Float64Array){
  const n=9,L=new Float64Array(n*n)
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let a=H[n*i+j];for(let k=0;k<j;k++)a-=L[n*i+k]*L[n*j+k]
    if(i===j){if(!(a>1e-14)||!Number.isFinite(a))throw Error('Indefinite incompatible-mode Hessian');L[n*i+j]=Math.sqrt(a)}
    else L[n*i+j]=a/L[n*j+j]
  }
  return (r:Float64Array)=>{
    const x=new Float64Array(r)
    for(let i=0;i<n;i++){for(let j=0;j<i;j++)x[i]-=L[n*i+j]*x[j];x[i]/=L[n*i+i]}
    for(let i=n-1;i>=0;i--){for(let j=i+1;j<n;j++)x[i]-=L[n*j+i]*x[j];x[i]/=L[n*i+i]}
    return x
  }
}
export function neoHookeanHexEnhanced(positions:readonly Vec3[],hex:Hex3D,E:number,nu:number,withHessian=true){
  if(!Number.isFinite(E)||E<=0||!Number.isFinite(nu)||nu<0||nu>=.49||hex.nodes.length!==8||hex.gradients.length!==8)throw Error('Invalid research element')
  const mu=E/(2*(1+nu)),lam=E*nu/((1+nu)*(1-2*nu)),weight=hex.weight,z=1/Math.sqrt(3),base:Float64Array[]=[],modes:Vec3[][]=[]
  // A structured brick's first Q1 corner gradient encodes its three side lengths.
  const size=[0,1,2].map(k=>-((1+z)*(1+z)/4)/hex.gradients[0][0][k])
  if(size.some(v=>!(v>0)||!Number.isFinite(v)))throw Error('Invalid research brick')
  let gauss=0
  for(const xi of [-z,z])for(const eta of [-z,z])for(const zeta of [-z,z]){
    const F=new Float64Array(9),grads=hex.gradients[gauss++]
    for(let a=0;a<8;a++){const x=positions[hex.nodes[a]],g=grads[a];for(let i=0;i<3;i++)for(let j=0;j<3;j++)F[3*i+j]+=x[i]*g[j]}
    base.push(F);modes.push([[-4*xi/size[0],0,0],[0,-4*eta/size[1],0],[0,0,-4*zeta/size[2]]])
  }
  const evaluate=(alpha:Float64Array,wantGlobal:boolean)=>{
    let energy=0,minJ=Infinity,stress=0
    const ga=new Float64Array(9),kaa=new Float64Array(81),gq=new Float64Array(24),Hqq=wantGlobal?new Float64Array(576):null,Hqa=wantGlobal?new Float64Array(216):null
    for(let k=0;k<8;k++){
      const hs=modes[k],F=base[k].slice()
      for(let m=0;m<3;m++)for(let i=0;i<3;i++)F[3*i+m]+=alpha[3*m+i]*hs[m][m]
      const [a,b,c,d,e,f,g,h,i]=F,J=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g)
      if(!(J>1e-8)||!Number.isFinite(J))throw Error('Inverted enhanced hexahedron')
      minJ=Math.min(minJ,J)
      const inv=[(e*i-f*h)/J,(c*h-b*i)/J,(b*f-c*e)/J,(f*g-d*i)/J,(a*i-c*g)/J,(c*d-a*f)/J,(d*h-e*g)/J,(b*g-a*h)/J,(a*e-b*d)/J],it=[inv[0],inv[3],inv[6],inv[1],inv[4],inv[7],inv[2],inv[5],inv[8]],ln=Math.log(J),co=lam*ln-mu,P=Array.from(F,(v,j)=>mu*v+co*it[j])
      energy+=weight*(.5*mu*(F.reduce((s,v)=>s+v*v,0)-3)-mu*ln+.5*lam*ln*ln)
      const sigma=new Float64Array(9);for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let l=0;l<3;l++)sigma[3*x+y]+=P[3*x+l]*F[3*y+l]/J
      const mean=(sigma[0]+sigma[4]+sigma[8])/3;let dev2=0;for(let x=0;x<3;x++)for(let y=0;y<3;y++){const v=sigma[3*x+y]-(x===y?mean:0);dev2+=v*v};stress+=Math.sqrt(1.5*dev2)/8
      const all=[...hex.gradients[k],...hs],u=all.map(v=>[0,1,2].map(x=>it[3*x]*v[0]+it[3*x+1]*v[1]+it[3*x+2]*v[2]))
      for(let n=0;n<11;n++)for(let x=0;x<3;x++){
        const v=all[n],g=weight*(P[3*x]*v[0]+P[3*x+1]*v[1]+P[3*x+2]*v[2]);if(n<8){if(wantGlobal)gq[3*n+x]+=g}else ga[3*(n-8)+x]+=g
        // Local-local and nodal-local tangent blocks.
        for(let m=8;m<11;m++)for(let y=0;y<3;y++){
          const w=all[m],prod=v[0]*w[0]+v[1]*w[1]+v[2]*w[2],H=weight*(mu*(x===y?prod:0)+(mu-lam*ln)*u[m][x]*u[n][y]+lam*u[n][x]*u[m][y])
          if(n<8){if(Hqa)Hqa[(3*n+x)*9+3*(m-8)+y]+=H}else kaa[(3*(n-8)+x)*9+3*(m-8)+y]+=H
        }
        if(n<8&&Hqq)for(let m=0;m<8;m++)for(let y=0;y<3;y++){
          const w=all[m],prod=v[0]*w[0]+v[1]*w[1]+v[2]*w[2]
          Hqq[(3*n+x)*24+3*m+y]+=weight*(mu*(x===y?prod:0)+(mu-lam*ln)*u[m][x]*u[n][y]+lam*u[n][x]*u[m][y])
        }
      }
    }
    return {energy,minJ,stress,ga,kaa,gq,Hqq,Hqa}
  }
  let alpha=new Float64Array(9),A=evaluate(alpha,false),iterations=0
  for(;iterations<12;iterations++){
    const grad=Math.hypot(...A.ga);if(grad<2e-10)break
    const solve=factor(A.kaa),step=solve(Float64Array.from(A.ga,v=>-v)),slope=A.ga.reduce((sum,v,i)=>sum+v*step[i],0)
    let ok=false,stepLength=1
    for(let line=0;line<16;line++){
      try{const trial=Float64Array.from(alpha,(v,i)=>v+stepLength*step[i]),B=evaluate(trial,false);if(B.energy<=A.energy+1e-4*stepLength*slope+1e-16){alpha=trial;A=B;ok=true;break}}catch{/* reject */}
      stepLength*=.5
    }
    if(!ok)throw Error('Enhanced local energy line search failed')
  }
  if(Math.hypot(...A.ga)>1e-8)throw Error('Enhanced local stationarity failed')
  const B=evaluate(alpha,true),H=B.Hqq!
  if(withHessian){
    const solve=factor(B.kaa),solutions=Array.from({length:24},(_,i)=>solve(B.Hqa!.slice(i*9,(i+1)*9)))
    for(let i=0;i<24;i++)for(let j=0;j<24;j++)for(let k=0;k<9;k++)H[i*24+j]-=B.Hqa![i*9+k]*solutions[j][k]
  }
  return {energy:B.energy,gradient:B.gq,hessian:withHessian?H:new Float64Array(0),minJ:B.minJ,vonMises:B.stress,alpha,iterations,localResidual:Math.hypot(...A.ga)}
}
