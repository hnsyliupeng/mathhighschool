"""Independent NumPy reassembly of the final TS 3-D state.

No project solver is imported. Triangle distance is recomputed using projected
face and three segment candidates, not the TS closest-point region algorithm.
This checks one final configuration, not the entire loading path or experiment.

    PYTHONPATH=/path/to/numpy python3 scripts/audit-gripper3d-independent.py /tmp/gripper3d-snapshot.json
"""
import json, sys
from pathlib import Path
import numpy as np

snapshot=json.loads(Path(sys.argv[1]).read_text())
mesh=snapshot['mesh'];params=snapshot['params'];q=np.array(snapshot['q'],dtype=float)
positions0=np.array(mesh['reference']);nsolid=len(positions0);nodes=np.array([t['nodes'] for t in mesh['tets']],dtype=int)
grads=np.array([t['gradients'] for t in mesh['tets']]);vol=np.array([t['volume'] for t in mesh['tets']])
faces=np.array([f['nodes'] for f in mesh['walls']],dtype=int);sides=np.array([f['wall'] for f in mesh['walls']],dtype=int)
anchor=np.array(mesh['anchor'],dtype=int);N=24;eps=1e-16
restx=np.array([-.012+i*.004 for i in range(N)]);rest=np.diff(restx)

def closest_triangles(p,a,b,c):
    """Closest points to every closed triangle via plane + boundary candidates."""
    ab=b-a;ac=c-a;raw=np.cross(ab,ac);normal=raw/np.linalg.norm(raw,axis=1)[:,None]
    ap=p-a;gap=np.einsum('ij,ij->i',ap,normal);proj=p-gap[:,None]*normal;v=proj-a
    aa=np.einsum('ij,ij->i',ab,ab);bb=np.einsum('ij,ij->i',ab,ac);cc=np.einsum('ij,ij->i',ac,ac)
    d=np.einsum('ij,ij->i',v,ab);e=np.einsum('ij,ij->i',v,ac);den=aa*cc-bb*bb
    u1=(cc*d-bb*e)/den;u2=(aa*e-bb*d)/den;u0=1-u1-u2
    inside=(u0>=0)&(u1>=0)&(u2>=0)
    points=[proj];barys=[np.column_stack((u0,u1,u2))];distances=[np.where(inside,np.sum((p-proj)**2,axis=1),np.inf)]
    for X,Y,edge in [(a,b,0),(b,c,1),(c,a,2)]:
        v=Y-X;t=np.clip(np.einsum('ij,ij->i',p-X,v)/np.einsum('ij,ij->i',v,v),0,1);z=X+t[:,None]*v
        bary=np.zeros((len(a),3))
        if edge==0:bary[:,0]=1-t;bary[:,1]=t
        elif edge==1:bary[:,1]=1-t;bary[:,2]=t
        else:bary[:,2]=1-t;bary[:,0]=t
        points.append(z);barys.append(bary);distances.append(np.sum((p-z)**2,axis=1))
    choice=np.argmin(np.stack(distances),axis=0);idx=np.arange(len(a))
    projection=np.stack(points)[choice,idx];bary=np.stack(barys)[choice,idx];delta=p-projection;distance=np.linalg.norm(delta,axis=1)
    sign=np.where(np.einsum('ij,ij->i',delta,normal)<0,-1.,1.)
    direction=np.where((distance>1e-14)[:,None],sign[:,None]*delta/np.maximum(distance[:,None],eps),normal)
    return projection,bary,distance,sign*distance,direction

def evaluate(q):
    allpos=q.reshape(-1,3);pos=allpos[:nsolid];tendon=allpos[nsolid:];g=np.zeros_like(allpos)
    E=params['young'];nu=params['poisson'];mu=E/(2*(1+nu));lam=E*nu/((1+nu)*(1-2*nu))
    F=np.einsum('eai,eaj->eij',pos[nodes],grads);J=np.linalg.det(F)
    if np.min(J)<=0:raise ValueError('inverted tetrahedron')
    ln=np.log(J);invt=np.linalg.inv(F).transpose(0,2,1);P=mu*F+(lam*ln-mu)[:,None,None]*invt
    solid=np.sum(vol*(.5*mu*(np.sum(F*F,axis=(1,2))-3)-mu*ln+.5*lam*ln*ln))
    ge=np.einsum('eij,eaj,e->eai',P,grads,vol);np.add.at(g,nodes.ravel(),ge.reshape(-1,3))
    delta=np.diff(tendon,axis=0);length=np.linalg.norm(delta,axis=1);extension=np.maximum(0,length-rest);T=params['EA']*extension/rest
    axial=np.sum(params['EA']/(2*rest)*extension**2);edgeforce=T[:,None]*delta/length[:,None];g[nsolid:-1]-=edgeforce;g[nsolid+1:]+=edgeforce
    h=(rest[:-1]+rest[1:])/2;k=params['bending']/h**3;second=tendon[:-2]-2*tendon[1:-1]+tendon[2:]
    bending=np.sum(.5*k*np.sum(second*second,axis=1));v=k[:,None]*second;g[nsolid:-2]+=v;g[nsolid+1:-1]-=2*v;g[nsolid+2:]+=v
    offset=tendon[-1]-np.mean(pos[anchor],axis=0);anchor_energy=.5*10000*np.dot(offset,offset);g[-1]+=10000*offset;np.add.at(g,anchor,np.tile(-2500*offset,(4,1)))
    a,b,c=pos[faces[:,0]],pos[faces[:,1]],pos[faces[:,2]];xmin=np.minimum(np.minimum(a[:,0],b[:,0]),c[:,0])-.004;xmax=np.maximum(np.maximum(a[:,0],b[:,0]),c[:,0])+.004
    contact=0.;active=0;S=params['samples'];radius=params['radius']
    for i in range(N-1):
      for j in range(S):
        t=(j+.5)/S;p=tendon[i]*(1-t)+tendon[i+1]*t
        chosen=np.flatnonzero((p[0]>=xmin)&(p[0]<=xmax))
        if not len(chosen):continue
        proj,bary,dist,gap,direction=closest_triangles(p,a[chosen],b[chosen],c[chosen]);used=[]
        for side in range(4):
            group=np.flatnonzero(sides[chosen]==side)
            if not len(group):continue
            ix=group[np.argmin(dist[group])]
            if dist[ix]>3*radius or any(np.linalg.norm(proj[ix]-u)<1e-10 for u in used):continue
            pen=max(0.,radius-gap[ix])
            if not pen:continue
            used.append(proj[ix]);stiffness=params['contactPerLength']*rest[i]/S;force=stiffness*pen*direction[ix]
            contact+=.5*stiffness*pen**2;active+=1
            np.add.at(g,faces[chosen[ix]],bary[ix,:,None]*force);g[nsolid+i]-=(1-t)*force;g[nsolid+i+1]-=t*force
    return float(solid+axial+bending+anchor_energy+contact),g.ravel(),{'solid':float(solid),'axial':float(axial),'bending':float(bending),'anchor':float(anchor_energy),'contact':float(contact),'active':active}

energy,gradient,parts=evaluate(q);reference=np.array(snapshot['gradient']);free=np.array(snapshot['fixed'])==0
energy_error=abs(energy-snapshot['energy']);grad_error=np.max(np.abs(gradient-reference));residual=np.linalg.norm(gradient[free])
rng=np.random.default_rng(81273);direction_errors=[]
for i in range(4):
    direction=rng.normal(size=q.size);direction/=np.linalg.norm(direction);step=2e-8
    fd=(evaluate(q+step*direction)[0]-evaluate(q-step*direction)[0])/(2*step)
    direction_errors.append(abs(fd-np.dot(gradient,direction)))
assert energy_error<2e-11,(energy_error,parts)
assert grad_error<5e-8,grad_error
assert residual<2e-5,residual
assert max(direction_errors)<1e-6,direction_errors
assert parts['active']==len(snapshot['frame']['contacts']),(parts['active'],len(snapshot['frame']['contacts']))
report={'scope':'Independent NumPy energy and force reconstruction of one TypeScript final state; no experimental comparison or independent full loading solve.',
        'energyJ':energy,'energyAbsDifferenceJ':energy_error,'maxGradientDifferenceN':float(grad_error),'freeResidualN':float(residual),
        'directionalDerivativeErrorsN':direction_errors,'parts':parts,'checksPassed':True}
Path('docs/screenshots/gripper3d-independent-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS',json.dumps(report))
