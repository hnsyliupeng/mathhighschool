#!/usr/bin/env python3
"""Independent active-set convex QP triangle-distance check (sampled cases only)."""
import hashlib, itertools, json, os
import numpy as np

cases=json.load(open('/tmp/tendon-triangle-cases.json'))
max_dist=max_reconstruction=max_bary=0.;intersections=0
for case in cases:
    # Rescale to order one to avoid mixing metres and equality constraints.
    a=np.array(case['a'],float)*100;b=np.array(case['b'],float)*100;best=float('inf')
    for na in range(1,4):
      for ia in itertools.combinations(range(3),na):
       for nb in range(1,4):
        for ib in itertools.combinations(range(3),nb):
         M=np.column_stack((a[list(ia)].T,-b[list(ib)].T));n=na+nb
         E=np.zeros((2,n));E[0,:na]=1;E[1,na:]=1
         K=np.block([[M.T@M,E.T],[E,np.zeros((2,2))]])
         rhs=np.r_[np.zeros(n),[1.,1.]]
         x=np.linalg.lstsq(K,rhs,rcond=1e-12)[0][:n]
         if np.min(x)<-1e-9 or np.linalg.norm(E@x-[1,1])>1e-8:continue
         best=min(best,np.linalg.norm(M@x)/100)
    r=case['result'];reported=float(r['distance']);max_dist=max(max_dist,abs(reported-best))
    fb=np.array(r['fingerBary']);ob=np.array(r['objectBary']);fp=np.array(r['fingerPoint']);op=np.array(r['objectPoint'])
    max_bary=max(max_bary,abs(sum(fb)-1),abs(sum(ob)-1),max(0,-min(fb)),max(0,-min(ob)))
    max_reconstruction=max(max_reconstruction,np.linalg.norm(fb@(a/100)-fp),np.linalg.norm(ob@(b/100)-op),abs(np.linalg.norm(fp-op)-reported))
    if best<1e-10:intersections+=1
    if abs(best-reported)>1e-9 or max_bary>1e-8 or max_reconstruction>1e-9:
      raise SystemExit(f'QP mismatch: {best} vs {reported}; bary={max_bary}; reconstruction={max_reconstruction}')
files=['src/engine/tendon-dynamic-grasp.ts','src/engine/segment-triangle.ts','scripts/audit-tendon-triangle-cases.ts','scripts/audit-tendon-triangle-independent.py']
h=hashlib.sha256()
for name in files:h.update(name.encode());h.update(open(name,'rb').read())
report={'cases':len(cases),'intersections':intersections,'maxDistanceDifference_m':max_dist,'maxBaryError':max_bary,'maxReconstructionError_m':max_reconstruction,'sourceFiles':files,'sourceHash':h.hexdigest(),'scope':'Independent static triangle-distance QP on sampled cases only; not a dynamics, friction or continuous-collision proof.'}
os.makedirs('docs/screenshots',exist_ok=True);open('docs/screenshots/tendon-triangle-independent.json','w').write(json.dumps(report,indent=2)+'\n');print('PASS',json.dumps(report))
