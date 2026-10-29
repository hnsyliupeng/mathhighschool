#!/usr/bin/env python3
"""Check TypeScript Bernstein J bounds against independently evaluated NumPy
trilinear maps at deterministic 4-D samples, including an inversion missed by
Gauss/tetra tests and a positive field requiring subdivision.

  npx vite-node scripts/generate-hex-jacobian-cases.ts /tmp/hex-jac-cases.json
  python3 scripts/audit-hex-jacobian-independent.py /tmp/hex-jac-cases.json

Sampling is a cross-check, not a formal floating-point proof or a test of
solid-solid / tendon-curved-face CCD. Requires NumPy.
"""
import itertools, json, sys
import numpy as np

source=json.load(open(sys.argv[1] if len(sys.argv)>1 else '/tmp/hex-jac-cases.json'))
random=np.random.default_rng(0x9a4c2026)
# Include the exact 3x3x3x4 interpolation grid and independently generated
# interior points; vectorized determinant and shape derivatives are NumPy.
grid=np.array(list(itertools.product([0.,.5,1.],[0.,.5,1.],[0.,.5,1.],[0.,1/3,2/3,1.])))
parameters=np.concatenate((grid,random.random((512,4))),axis=0)
u,v,w,t=parameters.T
bits=np.array([[(n>>k)&1 for k in range(3)] for n in range(8)])
G=np.zeros((len(parameters),8,3))
for n in range(8):
    b=bits[n];coords=(u,v,w)
    for k in range(3):
        component=np.full(len(parameters),1. if b[k] else -1.)
        for j in range(3):
            if j!=k:component*=coords[j] if b[j] else 1-coords[j]
        G[:,n,k]=component
safe_count=sample_rejections=indeterminate=refined=exact_singular=0
worst_bound_over_sample=-np.inf;errors=[]
for case in source['cases']:
    start=np.array(case['from'],float);end=np.array(case['to'],float)
    x=start[None,:,:]+t[:,None,None]*(end-start)[None,:,:]
    # Translation is removed, as it cancels exactly in the derivative.
    F=np.einsum('sni,snj->sij',x-x[:,0:1,:],G)
    determinants=np.linalg.det(F)/case.get('referenceVolume',source['referenceVolume'])
    minimum=float(np.min(determinants));grid_min=float(np.min(determinants[:len(grid)]))
    c=case['certificate']
    if case['name'].startswith('exact-singular-cancellation-'):
        # Node coordinates are integers < 2^53. Python integers calculate the
        # determinant exactly, without relying on NumPy's floating-point LU.
        A=[[int(start[1<<j,i]-start[0,i]) for j in range(3)] for i in range(3)]
        a,b,d=A;exact=a[0]*(b[1]*d[2]-b[2]*d[1])-a[1]*(b[0]*d[2]-b[2]*d[0])+a[2]*(b[0]*d[1]-b[1]*d[0])
        if exact!=0 or c['safe']:errors.append({'case':case['name'],'exactDeterminant':exact,'certificate':c})
        else:exact_singular+=1
    if c['safe']:
        safe_count+=1;refined+=int(c['subdivisions']>0)
        difference=c['lowerBound']-minimum;worst_bound_over_sample=max(worst_bound_over_sample,difference)
        if minimum<=1e-8 or difference>1e-9:errors.append({'case':case['name'],'bound':c['lowerBound'],'minSample':minimum})
    elif c['reason']=='nonpositive-sample':
        sample_rejections+=1
        if not case['name'].startswith('exact-singular-cancellation-') and grid_min>1e-8+2e-9:errors.append({'case':case['name'],'claimedNonpositive':c['minimumSample'],'numpyGridMinimum':grid_min})
    else:indeterminate+=1
special={x['name']:x['certificate'] for x in source['cases'] if x['name'] in ('positive-requires-subdivision','corner-inversion-missed-by-gauss-and-tets')}
if not special['positive-requires-subdivision']['safe'] or not special['positive-requires-subdivision']['subdivisions']:errors.append({'case':'subdivision not certified'})
if special['corner-inversion-missed-by-gauss-and-tets']['safe']:errors.append({'case':'corner inversion not rejected'})
report={'codeHash':source['codeHash'],'cases':len(source['cases']),'samplesPerCase':len(parameters),'safeBoundsCrossChecked':safe_count,'sampleRejectionsCrossChecked':sample_rejections,'indeterminate':indeterminate,'safeCasesNeedingSubdivision':refined,'exactSingularCasesRejected':exact_singular,'largestBoundMinusSample':worst_bound_over_sample,'errors':errors,'passed':not errors and safe_count>0 and sample_rejections>0 and refined>0 and exact_singular==20,'scope':'Independent numerical sampling and exact checks of 20 integer affine degeneracies only; not a general exact-arithmetic proof or a contact/self-collision audit.'}
print(json.dumps(report,indent=2));open('docs/screenshots/gripper3d-hex-jacobian-independent.json','w').write(json.dumps(report,indent=2)+'\n')
if not report['passed']:raise SystemExit(1)
