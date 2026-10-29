"""Small convex QP solved by enumerating affine active sets, independently
of the TypeScript segment/triangle feature algorithm. NumPy solves equality-
constrained least squares on each face of the box x triangle parameter domain.
This is a numerical cross-check, not an interval-arithmetic proof.
"""
from functools import lru_cache
from itertools import combinations
import numpy as np

@lru_cache(None)
def constraints(core_variables):
    n=core_variables+2;rows=[];limits=[]
    for j in range(core_variables):
        a=np.zeros(n);a[j]=-1;rows.append(a);limits.append(0.)
        a=np.zeros(n);a[j]=1;rows.append(a);limits.append(1.)
    for j in (n-2,n-1):
        a=np.zeros(n);a[j]=-1;rows.append(a);limits.append(0.)
    a=np.zeros(n);a[-2:]=1;rows.append(a);limits.append(1.)
    active=[c for size in range(n+1) for c in combinations(range(len(rows)),size)]
    return np.asarray(rows),np.asarray(limits),active

def core_triangle_distance(primitive,triangle):
    tri=np.asarray(triangle);a=tri[0]
    if primitive['kind']=='segment':
        origin=np.asarray(primitive['a']);v=np.asarray(primitive['b'])-origin
        # A sphere has no independent segment parameter.
        vectors=[] if np.linalg.norm(v)<1e-15 else [v]
    else:
        c=np.asarray(primitive['corners']);origin=c[0];vectors=[c[1]-origin,c[3]-origin]
    D=np.column_stack([*vectors,-(tri[1]-a),-(tri[2]-a)]);r=origin-a;n=D.shape[1]
    scale=max(np.linalg.norm(D),np.linalg.norm(r),1e-15);D=D/scale;r=r/scale
    A,b,sets=constraints(len(vectors));H=D.T@D;rhs=-D.T@r;best=float('inf');best_y=None
    for active in sets:
        if not active:
            y=np.linalg.lstsq(D,-r,rcond=None)[0]
        else:
            C=A[list(active)];d=b[list(active)];k=len(active)
            K=np.block([[H,C.T],[C,np.zeros((k,k))]])
            solution=np.linalg.lstsq(K,np.r_[rhs,d],rcond=None)[0];y=solution[:n]
            if np.max(np.abs(C@y-d))>1e-8:continue
        if np.max(A@y-b)>1e-8:continue
        residual=r+D@y;objective=float(residual@residual)
        if objective<best:best=objective;best_y=y
        if best<1e-26:break
    if best_y is None:raise RuntimeError('No feasible active-set QP solution')
    return np.sqrt(max(0.,best))*scale,best_y

def segment_segment_distance(p0,p1,q0,q1):
    p0=np.asarray(p0);p1=np.asarray(p1);q0=np.asarray(q0);q1=np.asarray(q1)
    D=np.column_stack((p1-p0,-(q1-q0)));r=p0-q0;scale=max(np.linalg.norm(D),np.linalg.norm(r),1e-15);D=D/scale;r=r/scale
    A=np.array([[-1.,0.],[1.,0.],[0.,-1.],[0.,1.]]);b=np.array([0.,1.,0.,1.]);H=D.T@D;rhs=-D.T@r;best=float('inf')
    for size in range(3):
      for active in combinations(range(4),size):
        if not active:y=np.linalg.lstsq(D,-r,rcond=None)[0]
        else:
            C=A[list(active)];d=b[list(active)];K=np.block([[H,C.T],[C,np.zeros((size,size))]])
            y=np.linalg.lstsq(K,np.r_[rhs,d],rcond=None)[0][:2]
            if np.max(np.abs(C@y-d))>1e-8:continue
        if np.max(A@y-b)>1e-8:continue
        v=r+D@y;best=min(best,float(v@v))
        if best<1e-26:return 0.
    if not np.isfinite(best):raise RuntimeError('No feasible segment QP solution')
    return np.sqrt(max(0.,best))*scale
