#!/usr/bin/env python3
"""Independent convex segment/triangle distance check against SciPy SLSQP.

Run:
  npx vite-node scripts/generate-segment-triangle-cases.ts /tmp/segments.json
  python3 scripts/audit-segment-triangle-independent.py /tmp/segments.json
Requires numpy and scipy. This tests static geometry, not the full solver.
"""
import json, sys
import numpy as np
from scipy.optimize import minimize

cases=json.load(open(sys.argv[1] if len(sys.argv)>1 else '/tmp/segments.json'))
worst=0.0
for index,case in enumerate(cases):
    p,q,a,b,c=(np.array(case[k],dtype=float) for k in ('p','q','a','b','c'))
    origin=p-a
    matrix=np.column_stack((q-p,a-b,a-c))
    def f(x):
        d=origin+matrix@x
        return float(d@d)
    def jac(x): return 2*matrix.T@(origin+matrix@x)
    result=minimize(f,[.5,1/3,1/3],jac=jac,bounds=[(0,1),(0,1),(0,1)],constraints=[{'type':'ineq','fun':lambda x:1-x[1]-x[2],'jac':lambda x:np.array([0.,-1.,-1.])}],method='SLSQP',options={'ftol':1e-13,'maxiter':200})
    if not result.success:
        raise SystemExit(f'Independent optimizer failed at {index}: {result.message}')
    delta=abs(np.sqrt(max(0.,result.fun))-case['distance'])
    worst=max(worst,delta)
    if delta>2e-6:
        raise SystemExit(f'Case {index} mismatch {delta:g}')
print(json.dumps({'cases':len(cases),'max_absolute_distance_difference':worst,'threshold':2e-6,'passed':True},indent=2))
