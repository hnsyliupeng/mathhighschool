#!/usr/bin/env python3
"""Independently reassemble the reduced gripper equations with NumPy/SciPy.

Input is a snapshot exported by `npx vite-node scripts/audit-gripper.ts --snapshot
/tmp/gripper-snapshot.json`. The formulation is implemented independently in
vectorized NumPy, including force balance through rotating/deforming guides. The
SciPy minimization is deliberately started near the TS solution: it checks a
local equilibrium, NOT a fully independent trajectory or experimental truth.
Requires numpy and scipy; writes docs/screenshots/gripper-independent-audit.json.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from scipy.optimize import minimize

parser=argparse.ArgumentParser()
parser.add_argument('snapshot',type=Path)
parser.add_argument('--output',type=Path,default=Path('docs/screenshots/gripper-independent-audit.json'))
args=parser.parse_args()
data=json.loads(args.snapshot.read_text())
p=data['params']; mesh=data['mesh']; q_reference=np.asarray(data['q'],dtype=float)
n=len(mesh['reference']); coords=np.asarray(mesh['reference'],dtype=float)
tris=np.array([t['nodes'] for t in mesh['triangles']],dtype=int)
grads=np.array([t['gradients'] for t in mesh['triangles']],dtype=float)
volumes=np.array([t['area']*p['thickness'] for t in mesh['triangles']])
walls=mesh['guideWalls'];spans=mesh['guideSpans'];station_ids=data['stationDofs'];act=data['actuatorDof'];tip=mesh['tip']
rest=np.asarray(data['restLengths']);L0=float(rest.sum());free=np.asarray(data['free'],dtype=int)
mu=p['young']/(2*(1+p['poisson']));lam=p['young']*p['poisson']/((1+p['poisson'])*(1-2*p['poisson']))
rotation=np.array([[0.,-1.],[1.,0.]])

def evaluate(q):
    X=q[:2*n].reshape(n,2); values=np.zeros_like(q);g=values[:2*n].reshape(n,2)
    F=np.einsum('eai,eaj->eij',X[tris],grads)
    J=F[:,0,0]*F[:,1,1]-F[:,0,1]*F[:,1,0]
    if np.any(J<=1e-8): raise ValueError('inverted element')
    logJ=np.log(J); invT=np.empty_like(F)
    invT[:,0,0]=F[:,1,1]/J;invT[:,0,1]=-F[:,1,0]/J;invT[:,1,0]=-F[:,0,1]/J;invT[:,1,1]=F[:,0,0]/J
    W=.5*mu*(np.sum(F*F,axis=(1,2))-2)-mu*logJ+.5*lam*logJ*logJ
    energy=float(volumes@W)
    P=mu*F+(-mu+lam*logJ)[:,None,None]*invT
    local=volumes[:,None,None]*np.einsum('eij,eaj->eai',P,grads)
    np.add.at(g,tris.reshape(-1),local.reshape(-1,2))

    points=[q[act:act+2].copy()]; guides=[]
    for i,((a,b),(lower,upper)) in enumerate(zip(walls,spans)):
        v=X[b]-X[a];length=np.linalg.norm(v);t=v/length;nrm=rotation@t
        dn=rotation@(np.eye(2)-np.outer(t,t))/length
        s=q[station_ids[i]];point=(X[a]+X[b])/2+s*nrm;points.append(point)
        h0=coords[upper,1]-coords[lower,1];scale=p['clearance']/h0
        span=X[upper]-X[lower];clearance=scale*float(span@nrm)
        penetration=max(0.,abs(s)-clearance);force=p['contactStiffness']*penetration
        energy+=.5*p['contactStiffness']*penetration**2
        if force:
            dc_dw=scale*dn.T@span
            g[a]+=force*dc_dw;g[b]-=force*dc_dw
            g[lower]+=force*scale*nrm;g[upper]-=force*scale*nrm
            values[station_ids[i]]+=force*np.sign(s)
        guides.append((a,b,s,nrm,dn))
    points.append(X[tip]);points=np.array(points)
    edges=np.diff(points,axis=0);lengths=np.linalg.norm(edges,axis=1);tangents=edges/lengths[:,None]
    extension=max(0.,float(lengths.sum())-L0);tension=p['cableEA']/L0*extension
    energy+=.5*(p['cableEA']/L0)*extension**2
    cable_g=np.zeros_like(points);cable_g[:-1]-=tension*tangents;cable_g[1:]+=tension*tangents
    for i in range(1,len(points)-1):
        h=(rest[i-1]+rest[i])/2;k=p['cableB']/h**3;curv=points[i-1]-2*points[i]+points[i+1]
        energy+=.5*k*float(curv@curv)
        cable_g[i-1]+=k*curv;cable_g[i]-=2*k*curv;cable_g[i+1]+=k*curv
    values[act:act+2]+=cable_g[0];g[tip]+=cable_g[-1]
    for i,(a,b,s,nrm,dn) in enumerate(guides):
        gc=cable_g[i+1];orient=dn.T@gc
        g[a]+=.5*gc-s*orient;g[b]+=.5*gc+s*orient;values[station_ids[i]]+=float(gc@nrm)
    return energy,values

energy,gradient=evaluate(q_reference)
expected=data['expected'];delta_energy=abs(energy-expected['energy']);delta_grad=float(np.max(np.abs(gradient-np.asarray(expected['gradient']))))
free_residual=float(np.linalg.norm(gradient[free]))
rng=np.random.default_rng(5831)
probe=q_reference.copy();probe[free]+=rng.normal(size=len(free))*2e-6
_,probe_gradient=evaluate(probe);direction_errors=[]
for _ in range(6):
    direction=np.zeros_like(probe);direction[free]=rng.normal(size=len(free));direction/=np.linalg.norm(direction)
    h=2e-8;fd=(evaluate(probe+h*direction)[0]-evaluate(probe-h*direction)[0])/(2*h)
    direction_errors.append(abs(fd-float(probe_gradient@direction)))

# Start from a perturbed TS configuration. Scaling x by 1 mm and energy by
# 1 mJ keeps the optimizer's gradient magnitudes close to SI newtons.
x0=(probe[free]-q_reference[free])/1e-3
def objective(x):
    trial=q_reference.copy();trial[free]+=x*1e-3
    try:
        value,grad=evaluate(trial)
        return value/1e-3,grad[free]
    except ValueError:
        return 1e20,np.zeros_like(x)
result=minimize(objective,x0,jac=True,method='L-BFGS-B',options={'maxiter':10000,'maxcor':60,'ftol':1e-15,'gtol':1e-8,'maxls':50})
optimized=q_reference.copy();optimized[free]+=result.x*1e-3
opt_energy,opt_gradient=evaluate(optimized)
position_error=float(np.max(np.abs(optimized[:2*n]-q_reference[:2*n])))
relaxed_residual=float(np.linalg.norm(opt_gradient[free]))
checks={'independent_energy':delta_energy<1e-11,'independent_gradient':delta_grad<2e-9,'independent_free_residual':free_residual<2e-7,'directional_derivatives':max(direction_errors)<2e-7,'local_scipy_residual':relaxed_residual<2e-5,'local_scipy_shape':position_error<5e-5}
checks={key:bool(value) for key,value in checks.items()}
report={'date':datetime.now(timezone.utc).date().isoformat(),'checks':checks,'energy_difference_J':delta_energy,'max_gradient_difference_N':delta_grad,'free_residual_N':free_residual,'max_directional_derivative_error_N':max(direction_errors),'scipy_local_relaxation':{'success':bool(result.success),'message':str(result.message),'iterations':int(result.nit),'max_solid_node_coordinate_difference_m':position_error,'energy_difference_J':abs(opt_energy-energy),'free_residual_N':relaxed_residual},'scope':'Independent NumPy assembly and SciPy local relaxation from a perturbed TypeScript solution; not an independent full trajectory, 3-D bore, or experimental validation.'}
args.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if not all(checks.values()):raise SystemExit(1)
