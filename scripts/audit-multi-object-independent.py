#!/usr/bin/env python3
"""Independent full Q1/tendon/rounded-object reassembly of five snapshots.

Run after audit-multi-object.ts saved /tmp/multi-object-<id>-snapshot.json:
PYTHONPATH=/tmp/ddg-scipy OPENBLAS_NUM_THREADS=1 python3 scripts/audit-multi-object-independent.py /tmp/multi-object-<id>-snapshot.json
NumPy active-set enumeration solves convex QPs for each candidate primitive/triangle pair. This checks
only those equilibria, not the entire path, force closure, or mesh convergence.
"""
import hashlib, json, sys
import numpy as np
from rounded_object_qp import core_triangle_distance,segment_segment_distance

data=json.load(open(sys.argv[1]))
h=hashlib.sha256()
for name in data['sourceFiles']:
    h.update(name.encode());h.update(open(name,'rb').read())
source_hash=h.hexdigest()
if data['codeHash']!=source_hash or len(data['snapshots'])!=5 or any(s['codeHash']!=source_hash for s in data['snapshots']):raise SystemExit('Stale or incomplete five-finger snapshot')

def core_qp(primitive,triangle):
    return core_triangle_distance(primitive,triangle)

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
    max_distance_error=max_force_law_error=0.;force_sum=np.zeros(3);moment_sum=np.zeros(3);candidate_pairs=0;candidate_features=0;omitted_force=0.;checked_reported=set()

    def feature_qp(p0,p1,a,b,c,feature):
        if feature<2:
            point=(p0,p1)[feature]
            return core_triangle_distance({'kind':'segment','a':point,'b':point},[a,b,c])[0]
        u,v=((a,b),(b,c),(c,a))[feature-2]
        return segment_segment_distance(p0,p1,u,v)

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
                candidate_features+=1;key=(seg,j,feature);contact=reported.get(key)
                if contact:
                    checked_reported.add(key)
                    point=np.array(contact['point']);surface=np.array(contact['wallPoint'])
                    t=float(np.dot(point-p0,p1-p0)/np.dot(p1-p0,p1-p0))
                    u,v=np.linalg.lstsq(np.column_stack((b-a,c-a)),surface-a,rcond=None)[0];bary=np.array([1-u-v,u,v])
                distance=feature_qp(p0,p1,a,b,c,feature)
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
    if checked_reported!=set(reported):raise SystemExit('Reported feature missed by independent candidate enumeration')

    # Independently optimize distance for every candidate rounded primitive /
    # triangle. The rectangle QP uses its two independent core coordinates,
    # not the implementation's two triangles and twelve edge/face features.
    obj=s['object'];primitives=obj['primitives'];old_lambda=np.array(s['objectMultipliers']).reshape(len(primitives),len(faces))
    object_reported={(c['primitive'],face_lookup[tuple(c['triangle'])]):c for c in s['objectContacts']}
    if len(object_reported)!=len(s['objectContacts']):raise SystemExit('Duplicate object constraint')
    object_omitted=object_distance_error=object_force_error=core_validity=normal_torque=0.;object_force=np.zeros(3);seen_object=set();object_candidates=0
    for p,primitive in enumerate(primitives):
      core=np.asarray([primitive['a'],primitive['b']] if primitive['kind']=='segment' else primitive['corners']);radius=primitive['radius']
      core_lo=core.min(axis=0);core_hi=core.max(axis=0)
      for j,face in enumerate(faces):
        a,b,c=face_xyz[j];reftri=ref[face['nodes']];area=np.linalg.norm(np.cross(reftri[1]-reftri[0],reftri[2]-reftri[0]))/2;k=obj['stiffnessPerArea']*area
        lower=np.linalg.norm(np.maximum(0.,np.maximum(core_lo-face_hi[j],face_lo[j]-core_hi)))
        if lower>radius+old_lambda[p,j]/k+1e-12:continue
        object_candidates+=1;distance,_=core_qp(primitive,face_xyz[j]);contact=object_reported.get((p,j))
        if contact is None:
            object_omitted=max(object_omitted,max(0.,old_lambda[p,j]-k*(distance-radius)));continue
        seen_object.add((p,j));point=np.asarray(contact['point']);corepoint=np.asarray(contact['corePoint']);actual=np.linalg.norm(point-corepoint);force=np.asarray(contact['force']);magnitude=np.linalg.norm(force)
        object_distance_error=max(object_distance_error,abs(actual-distance))
        object_force_error=max(object_force_error,abs(magnitude-max(0.,old_lambda[p,j]-k*(actual-radius))),abs(magnitude-contact['lambda']),np.linalg.norm(force-magnitude*(point-corepoint)/actual))
        # Check reported core-point membership independently of its distance.
        if primitive['kind']=='segment':
            v=core[1]-core[0];den=v@v;t=float((corepoint-core[0])@v/den) if den>1e-30 else 0.;reconstructed=core[0]+t*v
            core_validity=max(core_validity,np.linalg.norm(reconstructed-corepoint),max(0.,-t,t-1.))
        else:
            basis=np.column_stack((core[1]-core[0],core[3]-core[0]));uv=np.linalg.lstsq(basis,corepoint-core[0],rcond=None)[0]
            core_validity=max(core_validity,np.linalg.norm(core[0]+basis@uv-corepoint),max(0.,-float(min(uv)),float(max(uv))-1.))
        uv=np.linalg.lstsq(np.column_stack((b-a,c-a)),point-a,rcond=None)[0];bary=[1-uv.sum(),*uv]
        energy+=magnitude*magnitude/(2*k)
        for node,weight in zip(face['nodes'],bary):gradient[node]-=weight*force
        object_force+=force;normal_torque=max(normal_torque,np.linalg.norm(np.cross(point-corepoint,force)))
    if seen_object!=set(object_reported):raise SystemExit('Reported object constraint omitted by independent candidate scan')
    object_force_error=max(object_force_error,np.linalg.norm(object_force-np.asarray(s['objectForce'])))
    reference=np.array(s['gradient']).reshape(-1,3);de=abs(energy-s['energy']);dg=np.max(np.abs(gradient-reference));balance=np.linalg.norm(force_sum);torque=np.linalg.norm(moment_sum)
    report={'finger':s['case'],'normalizedPullMm':s['frame']['pull']*1000,'tendonActiveFeatures':len(reported),'objectActiveConstraints':len(object_reported),'tendonCandidatePairs':candidate_pairs,'objectCandidates':object_candidates,'energyDifferenceJ':de,'maxGradientDifferenceN':dg,'maxTendonDistanceErrorM':max_distance_error,'maxTendonForceErrorN':max_force_law_error,'maxOmittedTendonForceN':omitted_force,'maxObjectDistanceErrorM':object_distance_error,'maxObjectForceErrorN':object_force_error,'maxOmittedObjectForceN':object_omitted,'maxCoreValidityError':core_validity,'tendonForceBalanceN':balance,'tendonTorqueBalanceNm':torque,'objectNormalTorqueNm':normal_torque}
    report['passed']=bool(de<1e-12 and dg<1e-8 and max_distance_error<1e-8 and max_force_law_error<1e-8 and omitted_force<1e-7 and object_distance_error<1e-8 and object_force_error<1e-8 and object_omitted<1e-7 and core_validity<1e-8 and balance<1e-10 and torque<1e-10 and normal_torque<1e-10)
    return report

reports=[audit(s) for s in data['snapshots']]
result={'codeHash':source_hash,'normalizedPullMm':data['normalizedPullMm'],'reports':reports,'passed':all(r['passed'] for r in reports),'objectId':data['id'],'scope':'Independent solid/tendon/rounded-object reassembly for five specified snapshots only; not a full trajectory, force closure, continuum CCD, mesh convergence or physical experiment.'}
print(json.dumps(result,indent=2));open(f'docs/screenshots/multi-object-independent-{data["id"]}.json','w').write(json.dumps(result,indent=2)+'\n')
if not result['passed']:raise SystemExit(1)
