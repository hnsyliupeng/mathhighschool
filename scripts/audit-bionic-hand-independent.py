#!/usr/bin/env python3
"""Independent NumPy/SciPy reassembly of five saved finger equilibria.

Run: npx vite-node scripts/snapshot-bionic-hand.ts [steps]
     PYTHONPATH=/tmp/ddg-scipy python3 scripts/audit-bionic-hand-independent.py
Uses independent Q1 integration, SciPy feature QPs for tendon-to-triangle and
sphere-to-triangle closest points, and reconstructs all forces and energies.
It validates only the supplied snapshots, not a path or physical grasp.
"""
import hashlib, json, sys
import numpy as np
from scipy.optimize import minimize

FILES=['src/engine/bionic-hand3d.ts','src/engine/sphere-finger3d.ts','src/engine/hand-object-contact.ts','src/engine/continuous-gripper3d.ts','src/engine/gripper3d.ts','src/engine/hexahedron.ts','src/engine/hex-jacobian-bound.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/gripper3d-safety.ts']
h=hashlib.sha256()
for name in FILES:
    h.update(name.encode());h.update(open(name,'rb').read())
source_hash=h.hexdigest()
data=json.load(open(sys.argv[1] if len(sys.argv)>1 else '/tmp/bionic-hand-independent-snapshots.json'))
if data['codeHash']!=source_hash or len(data['snapshots'])!=5 or any(s['codeHash']!=source_hash for s in data['snapshots']):raise SystemExit('Stale or incomplete five-finger snapshot')

def audit(s):
    params=s['params']; mesh=s['mesh']; ref=np.array(mesh['reference']); q=np.array(s['q']).reshape(-1,3); n=len(ref); x=q[:n]; tendon=q[n:]; gradient=np.zeros_like(q); energy=0.
    E=params['young'];nu=params['poisson'];mu=E/(2*(1+nu));lam=E*nu/((1+nu)*(1-2*nu));z=1/np.sqrt(3)
    for k in range(0,len(mesh['tets']),6):
        ids=sorted({i for t in mesh['tets'][k:k+6] for i in t['nodes']})
        lo=np.min(ref[ids],axis=0);hi=np.max(ref[ids],axis=0);h=hi-lo;nodes=[None]*8
        for j in ids:
            code=sum((1<<i) for i in range(3) if ref[j,i]>(lo[i]+hi[i])/2);nodes[code]=j
        signs=np.array([[1 if i&(1<<j) else -1 for j in range(3)] for i in range(8)])
        for xi in (-z,z):
          for eta in (-z,z):
            for zeta in (-z,z):
              sx,sy,sz=signs.T
              G=np.column_stack((sx*(1+sy*eta)*(1+sz*zeta)/(4*h[0]),sy*(1+sx*xi)*(1+sz*zeta)/(4*h[1]),sz*(1+sx*xi)*(1+sy*eta)/(4*h[2])))
              F=x[nodes].T@G;J=np.linalg.det(F);ln=np.log(J);invT=np.linalg.inv(F).T;w=np.prod(h)/8
              piola=mu*F+(lam*ln-mu)*invT
              energy+=w*(mu/2*(np.sum(F*F)-3)-mu*ln+lam/2*ln*ln)
              np.add.at(gradient,nodes,w*(G@piola.T))
    resolution=params['tendonResolution'];h=.004/resolution;L0=np.linalg.norm(np.diff(np.array([[-.012+i*h,.0105,.004] for i in range(len(tendon))]),axis=0),axis=1)
    for i in range(len(tendon)-1):
        d=tendon[i+1]-tendon[i];length=np.linalg.norm(d);extension=max(0.,length-L0[i]);k=params['EA']/L0[i];f=k*extension*d/length
        energy+=.5*k*extension**2;gradient[n+i]-=f;gradient[n+i+1]+=f
    for i in range(1,len(tendon)-1):
        ell=(L0[i-1]+L0[i])/2;k=params['bending']/ell**3;v=tendon[i-1]-2*tendon[i]+tendon[i+1]
        energy+=.5*k*(v@v);gradient[n+i-1]+=k*v;gradient[n+i]-=2*k*v;gradient[n+i+1]+=k*v
    anchor=np.mean(x[mesh['anchor']],axis=0);delta=tendon[-1]-anchor;f=10000*delta;energy+=.5*10000*(delta@delta);gradient[-1]+=f
    for i in mesh['anchor']:gradient[i]-=f/4

    kinds=['start-face','end-face','edge-ab','edge-bc','edge-ca'];faces=mesh['surface'];multipliers=np.array(s['multipliers']).reshape(len(tendon)-1,len(faces),5)
    face_lookup={tuple(face['nodes']):i for i,face in enumerate(faces)}
    reported={(c['segment'],face_lookup[tuple(c['triangle'])],kinds.index(c['feature'])):c for c in s['contactInfo']}
    if len(reported)!=len(s['contactInfo']):raise SystemExit('Duplicate feature identity')
    face_xyz=x[np.array([f['nodes'] for f in faces])];face_lo=face_xyz.min(axis=1);face_hi=face_xyz.max(axis=1)
    max_distance_error=max_force_law_error=0.;force_sum=np.zeros(3);moment_sum=np.zeros(3);candidate_pairs=0;candidate_features=0;omitted_force=0.;optimizer_failures=[];checked_reported=set()

    def feature_qp(p0,p1,a,b,c,feature,initial=None):
        # Scaled to millimetres; variables are segment and face/edge parameters.
        if feature<2:
            point=(p0,p1)[feature];r=1000*(point-a);D=-1000*np.column_stack((b-a,c-a))
            start=initial if initial is not None else [.3,.3]
            constraints=[{'type':'ineq','fun':lambda y:1-y[0]-y[1],'jac':lambda y:np.array([-1.,-1.])}]
        else:
            u,v=((a,b),(b,c),(c,a))[feature-2];r=1000*(p0-u);D=1000*np.column_stack((p1-p0,-(v-u)))
            start=initial if initial is not None else [.5,.5];constraints=[]
        fun=lambda y:float((r+D@y)@(r+D@y));jac=lambda y:2*D.T@(r+D@y)
        opt=minimize(fun,start,jac=jac,bounds=[(0,1),(0,1)],constraints=constraints,method='SLSQP',options={'ftol':1e-13,'maxiter':200})
        return opt,np.sqrt(max(0.,opt.fun))/1000

    # The same mathematical bounding-box lower bound is independently calculated
    # here. It is conservative for all five subfeatures and for any old lambda.
    for seg,(p0,p1) in enumerate(zip(tendon[:-1],tendon[1:])):
        seglo=np.minimum(p0,p1);seghi=np.maximum(p0,p1)
        d=np.maximum(0.,np.maximum(seglo-face_hi,face_lo-seghi));lower=np.linalg.norm(d,axis=1)
        k=params['contactPerLength']*L0[seg]/5
        candidates=np.where(lower<=params['radius']+np.max(multipliers[seg],axis=1)/k+1e-12)[0]
        for j in candidates:
            candidate_pairs+=1;a,b,c=face_xyz[j]
            for feature in range(5):
                candidate_features+=1;key=(seg,j,feature);contact=reported.get(key);initial=None
                if contact:
                    checked_reported.add(key)
                    point=np.array(contact['point']);surface=np.array(contact['wallPoint'])
                    t=float(np.dot(point-p0,p1-p0)/np.dot(p1-p0,p1-p0))
                    u,v=np.linalg.lstsq(np.column_stack((b-a,c-a)),surface-a,rcond=None)[0];bary=np.array([1-u-v,u,v])
                    initial=[u,v] if feature<2 else [t, (bary[1] if feature==2 else bary[2] if feature==3 else bary[0])]
                    initial=np.clip(initial,0,1)
                opt,distance=feature_qp(p0,p1,a,b,c,feature,initial)
                if not opt.success:optimizer_failures.append({'key':key,'message':opt.message})
                old=multipliers[seg,j,feature];new=max(0.,old-k*(distance-params['radius']))
                if not contact:
                    omitted_force=max(omitted_force,new);continue
                actual=np.linalg.norm(point-surface);max_distance_error=max(max_distance_error,abs(distance-actual))
                force=np.array(contact['force']);magnitude=np.linalg.norm(force)
                max_force_law_error=max(max_force_law_error,abs(magnitude-max(0.,old-k*(actual-params['radius']))),abs(magnitude-contact['lambda']))
                if magnitude and actual:max_force_law_error=max(max_force_law_error,np.linalg.norm(force-magnitude*(point-surface)/actual))
                energy+=magnitude*magnitude/(2*k);gradient[n+seg]-=(1-t)*force;gradient[n+seg+1]-=t*force
                ids=faces[j]['nodes']
                for node,weight in zip(ids,bary):gradient[node]+=weight*force
                fs=[-(1-t)*force,-t*force,*[weight*force for weight in bary]];pos=[p0,p1,a,b,c]
                for ff,pp in zip(fs,pos):force_sum+=ff;moment_sum+=np.cross(pp,ff)
    if optimizer_failures:raise SystemExit('Independent feature optimizer failed: '+str(optimizer_failures[:3]))
    if checked_reported!=set(reported):raise SystemExit('Reported feature missed by independent candidate enumeration')

    # Independently solve every potentially active sphere-triangle distance QP.
    sphere=s['sphere'];center=np.array(sphere['center']);radius=sphere['radius'];old_lambda=np.array(s['sphereMultipliers'])
    sphere_reported={face_lookup[tuple(c['triangle'])]:c for c in s['sphereContacts']}
    if len(sphere_reported)!=len(s['sphereContacts']):raise SystemExit('Duplicate sphere triangle')
    sphere_omitted=sphere_distance_error=sphere_force_error=sphere_normal_torque=0.;sphere_force=np.zeros(3);seen_sphere=set();sphere_candidates=0
    for j,face in enumerate(faces):
        a,b,c=face_xyz[j];reftri=ref[face['nodes']];area=np.linalg.norm(np.cross(reftri[1]-reftri[0],reftri[2]-reftri[0]))/2;k=sphere['stiffnessPerArea']*area
        lower=np.linalg.norm(np.maximum(0.,np.maximum(center-face_hi[j],face_lo[j]-center)))
        if lower>radius+old_lambda[j]/k+1e-12:continue
        sphere_candidates+=1;r=1000*(a-center);D=1000*np.column_stack((b-a,c-a));contact=sphere_reported.get(j)
        start=np.array([.3,.3])
        if contact:
            seen_sphere.add(j);point=np.array(contact['point']);start=np.clip(np.linalg.lstsq(np.column_stack((b-a,c-a)),point-a,rcond=None)[0],0,1)
        objective=lambda y:float((r+D@y)@(r+D@y));jac=lambda y:2*D.T@(r+D@y)
        opt=minimize(objective,start,jac=jac,bounds=[(0,1),(0,1)],constraints=[{'type':'ineq','fun':lambda y:1-y[0]-y[1],'jac':lambda y:np.array([-1.,-1.])}],method='SLSQP',options={'ftol':1e-10,'maxiter':200})
        if not opt.success:raise SystemExit(f'Sphere QP failed: {s["case"]} {j} {opt.message}')
        distance=np.sqrt(max(0.,opt.fun))/1000;new=max(0.,old_lambda[j]-k*(distance-radius))
        if contact is None:sphere_omitted=max(sphere_omitted,new);continue
        point=np.array(contact['point']);actual=np.linalg.norm(point-center);force=np.array(contact['force']);magnitude=np.linalg.norm(force)
        sphere_distance_error=max(sphere_distance_error,abs(actual-distance));sphere_force_error=max(sphere_force_error,abs(new-magnitude),abs(magnitude-contact['lambda']),np.linalg.norm(force-magnitude*(point-center)/actual))
        # Use the reported physical closest point to reconstruct the exact
        # assembled gradient; QP above independently checks optimal distance.
        u,v=np.linalg.lstsq(np.column_stack((b-a,c-a)),point-a,rcond=None)[0];bary=[1-u-v,u,v]
        energy+=magnitude*magnitude/(2*k)
        for node,weight in zip(face['nodes'],bary):gradient[node]-=weight*force
        sphere_force+=force;sphere_normal_torque=max(sphere_normal_torque,np.linalg.norm(np.cross(point-center,force)))
    if seen_sphere!=set(sphere_reported):raise SystemExit('Reported sphere feature omitted by independent candidate scan')
    sphere_force_error=max(sphere_force_error,np.linalg.norm(sphere_force-np.array(s['sphereForce'])))
    reference=np.array(s['gradient']).reshape(-1,3);de=abs(energy-s['energy']);dg=np.max(np.abs(gradient-reference));balance=np.linalg.norm(force_sum);torque=np.linalg.norm(moment_sum)
    report={'finger':s['case'],'normalizedPullMm':s['frame']['pull']*1000,'tendonActiveFeatures':len(reported),'sphereActiveTriangles':len(sphere_reported),'tendonCandidatePairs':candidate_pairs,'sphereCandidates':sphere_candidates,'energyDifferenceJ':de,'maxGradientDifferenceN':dg,'maxTendonDistanceErrorM':max_distance_error,'maxTendonForceErrorN':max_force_law_error,'maxOmittedTendonForceN':omitted_force,'maxSphereDistanceErrorM':sphere_distance_error,'maxSphereForceErrorN':sphere_force_error,'maxOmittedSphereForceN':sphere_omitted,'tendonForceBalanceN':balance,'tendonTorqueBalanceNm':torque,'sphereNormalTorqueNm':sphere_normal_torque}
    report['passed']=bool(de<1e-12 and dg<1e-8 and max_distance_error<1e-8 and max_force_law_error<1e-8 and omitted_force<1e-7 and sphere_distance_error<1e-8 and sphere_force_error<1e-8 and sphere_omitted<1e-7 and balance<1e-10 and torque<1e-10 and sphere_normal_torque<1e-10)
    return report

reports=[audit(s) for s in data['snapshots']]
result={'codeHash':source_hash,'normalizedPullMm':data['normalizedPullMm'],'reports':reports,'passed':all(r['passed'] for r in reports),'scope':'Independent solid/tendon/object reassembly for five specified snapshots only; not a full trajectory, force closure, continuum CCD, mesh convergence or physical experiment.'}
print(json.dumps(result,indent=2));open('docs/screenshots/bionic-hand-independent-audit.json','w').write(json.dumps(result,indent=2)+'\n')
if not result['passed']:raise SystemExit(1)
