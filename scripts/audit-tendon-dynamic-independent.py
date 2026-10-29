#!/usr/bin/env python3
"""Recompute sampled actual finger/object states and contact geometry.

Run audit-tendon-dynamic.ts with --snapshots /tmp/tendon-dynamic-egg-snapshots.json,
then PYTHONPATH=/tmp/tendon-python OPENBLAS_NUM_THREADS=1 python3
scripts/audit-tendon-dynamic-independent.py /tmp/tendon-dynamic-egg-snapshots.json
The finite samples do not establish continuous safety or convergence.
"""
import hashlib, itertools, json, math, os, sys
import numpy as np

snap=json.load(open(sys.argv[1]));data=json.load(open('src/data/tendon-grasp-manifold.json'));mesh=snap['mesh'];frames=snap['frames'];params=snap['params']
files=['src/engine/tendon-dynamic-grasp.ts','src/engine/material-grasp3d.ts','src/engine/segment-triangle.ts','src/engine/continuous-collision.ts','src/engine/bionic-hand3d.ts','src/data/tendon-grasp-manifold.json','scripts/audit-tendon-dynamic.ts']
h=hashlib.sha256()
for name in files:h.update(name.encode());h.update(open(name,'rb').read())
if snap['sourceHash']!=h.hexdigest() or snap['referenceHash']!=data['sourceHash']:raise SystemExit('stale source or reference hash')
F=[(.78,[-.052,-.005,.010],[0,1,0],[.5,0,math.sqrt(.75)],[math.sqrt(.75),0,-.5]),(.9,[-.027,-.003,0],[0,1,0],[0,0,1],[1,0,0]),(1,[-.009,0,0],[0,1,0],[0,0,1],[1,0,0]),(.92,[.009,-.002,0],[0,1,0],[0,0,1],[1,0,0]),(.78,[.027,-.007,0],[0,1,0],[0,0,1],[1,0,0])]

def qp_dist(a,b):
    # Independent convex QP; both triangle barycentric vectors are nonnegative
    # and sum to one. Enumerating all nonempty active vertex sets is exact for
    # this small convex problem, up to floating-point tolerance.
    a=np.asarray(a)*100;b=np.asarray(b)*100;best=float('inf')
    for na in range(1,4):
      for ia in itertools.combinations(range(3),na):
       for nb in range(1,4):
        for ib in itertools.combinations(range(3),nb):
         M=np.column_stack((a[list(ia)].T,-b[list(ib)].T));n=na+nb;E=np.zeros((2,n));E[0,:na]=1;E[1,na:]=1
         K=np.block([[M.T@M,E.T],[E,np.zeros((2,2))]]);x=np.linalg.lstsq(K,np.r_[np.zeros(n),[1.,1.]],rcond=1e-12)[0][:n]
         if np.min(x)>=-1e-9 and np.linalg.norm(E@x-[1,1])<1e-8:best=min(best,np.linalg.norm(M@x)/100)
    return best

pulls=np.array([f['pull'] for f in data['frames']]);surface=np.array([x['nodes'] for x in data['mesh']['surface']],int);object_faces=np.array(mesh['triangles'],int)
max_shape=max_tendon=max_contact=max_lambda_ratio=max_modal=max_sample_pen=max_recorded_gap=0.;contact_checks=potential_pairs=0;frame_stats=[]
for frame in frames:
    obj=np.array(frame['objectPositions'],float);object_tri=obj[object_faces];o_lo=object_tri.min(axis=1);o_hi=object_tri.max(axis=1);jacs=[];fp=[]
    for i,finger in enumerate(frame['fingers']):
        p=finger['pull'];k=min(len(pulls)-2,max(0,int(np.searchsorted(pulls,p,side='right')-1)));dp=pulls[k+1]-pulls[k];theta=(p-pulls[k])/dp
        a=data['frames'][k];b=data['frames'][k+1];s,base,ex,ey,ez=F[i];B=np.stack((ex,ey,ez),axis=1)
        def transform(points):
            x=np.asarray(points,float).copy();x[:,2]-=.004;return np.asarray(base)+s*(x@B.T)+[0,0,frame['wristRise']]
        x0=transform(a['positions']);x1=transform(b['positions']);t0=transform(a['tendon']);t1=transform(b['tendon'])
        actual=np.array(finger['positions']);tendon=np.array(finger['tendon']);max_shape=max(max_shape,float(np.max(np.abs(actual-(x0+theta*(x1-x0))))));max_tendon=max(max_tendon,float(np.max(np.abs(tendon-(t0+theta*(t1-t0))))));jacs.append((x1-x0)/dp);fp.append(actual)
    for c in frame['contacts']:
        i=c['finger'];fi=c['fingerFace'];oi=c['objectFace'];fa=fp[i][surface[fi]];ob=obj[object_faces[oi]];fb=np.array(c['fingerBary']);bb=np.array(c['objectBary']);cf=fb@fa;co=bb@ob;d=np.linalg.norm(cf-co)
        expected=qp_dist(fa,ob);contact_checks+=1
        max_contact=max(max_contact,abs(expected-d),np.linalg.norm((cf+co)/2-np.array(c['point'])),np.linalg.norm((cf-co)/d-np.array(c['normal'])))
        max_lambda_ratio=max(max_lambda_ratio,max(0,c['tangentialForce']-params['friction']*c['normalForce']))
        jac=fb@jacs[i][surface[fi]];expected_modal=c['normalForce']*float(jac@np.array(c['normal']));max_modal=max(max_modal,abs(expected_modal-c['modalForce']))
    # Audit every triangle pair whose AABB lower bound is within the skin.
    # This is independent static checking at the selected frames only.
    sample_pen=0.
    for i in range(5):
      for fa in fp[i][surface]:
        delta=np.maximum(0,np.maximum(fa.min(axis=0)-o_hi,o_lo-fa.max(axis=0)));lower=np.linalg.norm(delta,axis=1)
        for j in np.where(lower<=.0005+1e-12)[0]:
            potential_pairs+=1;d=qp_dist(fa,object_tri[j]);sample_pen=max(sample_pen,max(0,.0005-d))
    max_sample_pen=max(max_sample_pen,sample_pen);max_recorded_gap=max(max_recorded_gap,max(0,sample_pen-frame['maxPenetration']))
    frame_stats.append({'time':frame['time'],'contacts':len(frame['contacts']),'maxSamplePenetration_m':sample_pen,'recordedMaxPenetration_m':frame['maxPenetration'],'fixtureActive':frame['fixtureActive']})
if max_shape>1e-10 or max_tendon>1e-10 or max_contact>1e-7 or max_lambda_ratio>1e-9 or max_modal>1e-8 or max_recorded_gap>1e-9:raise SystemExit(f'independent mismatch: {max_shape=} {max_tendon=} {max_contact=} {max_lambda_ratio=} {max_modal=} {max_recorded_gap=}')
report={'id':params['id'],'frames':len(frames),'contactPairs':contact_checks,'candidatePairs':potential_pairs,'maxFingerPositionError_m':max_shape,'maxTendonPositionError_m':max_tendon,'maxContactReconstructionError':max_contact,'maxFrictionCapExcess_N':max_lambda_ratio,'maxModalForceError_N':max_modal,'maxSamplePenetration_m':max_sample_pen,'maxUnreportedPenetration_m':max_recorded_gap,'sampleFrames':frame_stats,'sourceHash':snap['sourceHash'],'scope':'Independent QP and manifold reconstruction at recorded samples only. Not a proof of CCD, object self-collision, physical accuracy, or full-DOF finger equilibrium.'}
label=sys.argv[2] if len(sys.argv)>2 else params['id']
if not label or any(ch not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for ch in label):raise SystemExit('invalid report label')
os.makedirs('docs/screenshots',exist_ok=True);path=f"docs/screenshots/tendon-dynamic-{label}-independent.json";open(path,'w').write(json.dumps(report,indent=2)+'\n');print('PASS',json.dumps(report))
