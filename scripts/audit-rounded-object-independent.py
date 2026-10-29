#!/usr/bin/env python3
"""Independent NumPy convex-QP check of core/triangle distances and sampled CCD.

Generate input with `npx vite-node scripts/sample-rounded-object-cases.ts`, then
run `PYTHONPATH=/tmp/ddg-scipy python3 scripts/audit-rounded-object-independent.py`.
CCD sampling can reveal a missed collision, but is NOT a continuous certificate.
"""
import hashlib, json, sys
import numpy as np
from rounded_object_qp import core_triangle_distance,segment_segment_distance

data=json.load(open('/tmp/rounded-object-geometry-cases.json'))
h=hashlib.sha256()
for path in data['sourceFiles']:
    h.update(path.encode());h.update(open(path,'rb').read())
if h.hexdigest()!=data['codeHash']:raise SystemExit('Stale geometry samples')

def closest(primitive,triangle):
    return core_triangle_distance(primitive,triangle)

max_error=0.;max_bary_error=0.;failures=[]
for i,case in enumerate(data['staticCases']):
    d,_=closest(case['primitive'],case['triangle']);hit=case['hit'];error=abs(d-hit['distance']);max_error=max(max_error,error)
    tri=np.asarray(case['triangle']);bary=np.asarray(hit['bary']);point=np.asarray(hit['point']);core=np.asarray(hit['corePoint'])
    bary_error=max(abs(bary.sum()-1),max(0.,-float(np.min(bary))),np.linalg.norm(bary@tri-point),abs(np.linalg.norm(point-core)-hit['distance']))
    max_bary_error=max(max_bary_error,bary_error)
    if error>1e-8 or bary_error>1e-9:failures.append({'case':i,'errorM':error,'baryError':bary_error})

segment_error=0.;segment_failures=[]
for i,case in enumerate(data['segmentCases']):
    d=segment_segment_distance(case['p0'],case['p1'],case['q0'],case['q1']);error=abs(d-case['distance']);segment_error=max(segment_error,error)
    if error>1e-8:segment_failures.append({'case':i,'errorM':error})

safe=collision=indeterminate=0;sampled_misses=[];samples=0
for i,case in enumerate(data['motionCases']):
    reason=case['result']['reason'];safe+=int(case['result']['safe']);indeterminate+=int('indeterminate' in reason);collision+=int(not case['result']['safe'] and 'indeterminate' not in reason)
    start=np.asarray(case['from']);end=np.asarray(case['to']);minimum=float('inf')
    for t in np.linspace(0,1,21):
        d,_=closest(case['primitive'],start+t*(end-start));minimum=min(minimum,d);samples+=1
    if case['result']['safe'] and minimum<=case['clearance']-1e-9:sampled_misses.append({'case':i,'minDistanceM':minimum,'clearanceM':case['clearance']})
report={'codeHash':data['codeHash'],'sourceFiles':data['sourceFiles'],'seed':data['seed'],'staticCases':len(data['staticCases']),'maxDistanceErrorM':max_error,'maxPointOrBaryError':max_bary_error,'staticFailures':failures,'motionCases':len(data['motionCases']),'motionSafe':safe,'motionRejectedCollision':collision,'motionRejectedIndeterminate':indeterminate,'motionSamples':samples,'sampledMisses':sampled_misses,'segmentCases':len(data['segmentCases']),'maxSegmentDistanceErrorM':segment_error,'segmentFailures':segment_failures,'scope':'Independent active-set convex-QP distances and 21 samples per linear motion. Sampling cannot prove continuous separation, mesh convergence, or free grasp.'}
report['passed']=bool(not failures and not sampled_misses and not segment_failures and safe>0 and collision+indeterminate>0)
encoded=json.dumps(report,indent=2,default=lambda x:x.item() if isinstance(x,np.generic) else str(x))
open('docs/screenshots/rounded-object-geometry-independent.json','w').write(encoded+'\n')
print(encoded)
if not report['passed']:sys.exit(1)
