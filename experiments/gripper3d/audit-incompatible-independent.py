#!/usr/bin/env python3
"""Independent reassembly and a SciPy stationary-point solve of the
experimental incompatible-mode element. It does NOT validate global equilibrium, contact,
large deformation or use in the production solver.

  npx vite-node experiments/gripper3d/generate-incompatible-cases.ts /tmp/incompatible-hex-cases.json
  python3 experiments/gripper3d/audit-incompatible-independent.py /tmp/incompatible-hex-cases.json
"""
import json, sys
import numpy as np
from scipy.optimize import root

data=json.load(open(sys.argv[1] if len(sys.argv)>1 else '/tmp/incompatible-hex-cases.json'))
h=np.array(data['size']);E=data['young'];nu=data['poisson'];mu=E/(2*(1+nu));lam=E*nu/((1+nu)*(1-2*nu));z=1/np.sqrt(3);weight=data['weight']
reference=np.array(data['reference']);signs=np.array([[1 if n&(1<<j) else -1 for j in range(3)] for n in range(8)])
samples=[]
for xi in (-z,z):
 for eta in (-z,z):
  for zeta in (-z,z):
   sx,sy,sz=signs.T
   N=np.column_stack((sx*(1+sy*eta)*(1+sz*zeta)/(4*h[0]),sy*(1+sx*xi)*(1+sz*zeta)/(4*h[1]),sz*(1+sx*xi)*(1+sy*eta)/(4*h[2])))
   H=np.diag(-4*np.array([xi,eta,zeta])/h)
   samples.append((N,H))
def reassemble(x,alpha):
    energy=0.;gradient=np.zeros((8,3));local=np.zeros((3,3));minimum_j=np.inf
    alpha=alpha.reshape(3,3)
    for N,H in samples:
        F=x.T@N+alpha.T@H;J=np.linalg.det(F)
        if not np.isfinite(J) or J<=1e-8:return np.inf,np.full(24,np.nan),np.full(9,np.nan),J
        ln=np.log(J);P=mu*F+(lam*ln-mu)*np.linalg.inv(F).T
        energy+=weight*(mu/2*(np.sum(F*F)-3)-mu*ln+lam/2*ln*ln)
        gradient+=weight*(N@P.T);local+=weight*(H@P.T);minimum_j=min(minimum_j,J)
    return energy,gradient.ravel(),local.ravel(),minimum_j

energy_error=gradient_error=local_residual=optimizer_alpha_error=0.;min_local_eigenvalue=np.inf;failures=[]
for index,case in enumerate(data['cases']):
    x=np.array(case['positions']);alpha=np.array(case['alpha']);energy,gradient,local,J=reassemble(x,alpha)
    energy_error=max(energy_error,abs(energy-case['energy']));gradient_error=max(gradient_error,np.max(np.abs(gradient-np.array(case['gradient']))));local_residual=max(local_residual,np.linalg.norm(local))
    # Independently find a stationary point from zero using the local
    # residual, avoiding roundoff in tiny differences of SI-scale energies.
    length_scale=1e-3
    def residual(v):return reassemble(x,v*length_scale)[2]
    opt=root(residual,np.zeros(9),method='hybr',options={'xtol':1e-10,'maxfev':500})
    final_residual=float(np.linalg.norm(residual(opt.x)))
    if not opt.success and final_residual>1e-9:failures.append({'case':index,'optimizer':opt.message,'residualN':final_residual})
    physical=opt.x*length_scale
    optimizer_alpha_error=max(optimizer_alpha_error,float(np.max(np.abs(physical-alpha))))
    # Check a local minimum, not just any stationary point, by an
    # independent finite-difference Hessian of the local residual.
    dh=1e-8;H=np.empty((9,9))
    for j in range(9):
        shift=np.zeros(9);shift[j]=dh
        H[:,j]=(reassemble(x,physical+shift)[2]-reassemble(x,physical-shift)[2])/(2*dh)
    eigen=float(np.linalg.eigvalsh((H+H.T)/2)[0]);min_local_eigenvalue=min(min_local_eigenvalue,eigen)
    if eigen<=0:failures.append({'case':index,'nonpositiveLocalEigenvalue':eigen})
passed=bool(not failures and energy_error<1e-12 and gradient_error<1e-8 and local_residual<1e-8 and optimizer_alpha_error<1e-7 and min_local_eigenvalue>0)
report={'codeHash':data['codeHash'],'cases':len(data['cases']),'maxEnergyDifferenceJ':energy_error,'maxNodalGradientDifferenceN':gradient_error,'maxLocalResidualN':local_residual,'maxOptimizerAlphaDifferenceM':optimizer_alpha_error,'minimumLocalHessianEigenvalueNPerM':min_local_eigenvalue,'optimizerFailures':failures,'passed':passed,'scope':'experimental element-local reassembly, SciPy stationary-point solve and numerical local Hessian on 20 mildly distorted cells; no global or contact-path validation'}
print(json.dumps(report,indent=2));open('docs/screenshots/gripper3d-incompatible-independent-research.json','w').write(json.dumps(report,indent=2)+'\n')
if not passed:raise SystemExit(1)
