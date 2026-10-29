#!/usr/bin/env python3
"""Independent point/triangle, spring-energy and constraint checks.

Only the saved discrete frames are checked. This does not establish CCD,
continuum convergence, physical calibration, or five-tendon hand coupling.
The closest-point calculation uses a plane projection plus three edge tests,
not the region-based TypeScript implementation.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
saved = json.loads((ROOT / 'docs/screenshots/material-grasp-samples.json').read_text())
report = json.loads((ROOT / 'docs/screenshots/material-grasp-audit.json').read_text())
assert saved['sourceHash'] == report['sourceHash'], 'sample / run source hash mismatch'
for path, expected in report['hashes'].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, f'stale source: {path}'

def sub(a, b): return [a[i]-b[i] for i in range(3)]
def dot(a, b): return sum(a[i]*b[i] for i in range(3))
def add_scaled(a, b, t): return [a[i]+t*b[i] for i in range(3)]
def distance(a,b): return math.sqrt(dot(sub(a,b),sub(a,b)))
def area(a,b,c):
    u,v=sub(b,a),sub(c,a)
    return .5*math.sqrt((u[1]*v[2]-u[2]*v[1])**2+(u[2]*v[0]-u[0]*v[2])**2+(u[0]*v[1]-u[1]*v[0])**2)
def segment_distance(p,a,b):
    ab=sub(b,a); denom=dot(ab,ab)
    if denom <= 1e-30: return distance(p,a)
    return distance(p,add_scaled(a,ab,max(0,min(1,dot(sub(p,a),ab)/denom))))
def point_triangle_distance(p,a,b,c):
    u,v,ap=sub(b,a),sub(c,a),sub(p,a)
    uu,uv,vv=dot(u,u),dot(u,v),dot(v,v)
    det=uu*vv-uv*uv
    if det <= 1e-30: raise AssertionError('degenerate sampled triangle')
    pu,pv=dot(ap,u),dot(ap,v)
    x=(vv*pu-uv*pv)/det; y=(uu*pv-uv*pu)/det
    if x >= 0 and y >= 0 and x+y <= 1:
        projected=add_scaled(add_scaled(a,u,x),v,y)
        return distance(p,projected)
    return min(segment_distance(p,a,b),segment_distance(p,b,c),segment_distance(p,c,a))

metrics={key:0.0 for key in ['penetration_error_m','centre_error_m','ground_gap_error_m','energy_error_J','link_strain_error','structural_strain_error','area_ratio_error','bary_sum_error','point_reconstruction_error_m','normal_length_error','friction_excess_N','normal_force_sum_error_N']}
frames_checked=triangles_checked=contact_pairs=0
for sample in saved['samples']:
    mesh=sample['mesh']; triangles=mesh['triangles']; springs=mesh['springs']; radii=mesh['radii']; frames=sample['frames']
    assert len(frames)==7, f"missing snapshots {sample['id']} {sample['scale']}"
    rest_areas=[area(*(frames[0]['positions'][i] for i in tri)) for tri in triangles]
    assert all(a>1e-15 for a in rest_areas)
    for f in frames:
        frames_checked += 1; positions=f['positions']; tips=f['tips']
        for d in range(3):
            c=sum(p[d] for p in positions)/len(positions)
            metrics['centre_error_m']=max(metrics['centre_error_m'],abs(c-f['centre'][d]))
        gap=min(p[2]-r for p,r in zip(positions,radii))
        metrics['ground_gap_error_m']=max(metrics['ground_gap_error_m'],abs(gap-f['minGroundGap']))
        energy=link_strain=structural_strain=0.0
        for e in springs:
            dx=distance(positions[e['a']],positions[e['b']])-e['rest']
            strain=abs(dx/e['rest']);link_strain=max(link_strain,strain)
            if e['kind']!='bend': structural_strain=max(structural_strain,strain)
            energy+=.5*e['k']*dx*dx
        metrics['energy_error_J']=max(metrics['energy_error_J'],abs(energy-f['springEnergy']))
        metrics['link_strain_error']=max(metrics['link_strain_error'],abs(link_strain-f['maxLinkStrain']))
        metrics['structural_strain_error']=max(metrics['structural_strain_error'],abs(structural_strain-f['maxStructuralStrain']))
        area_ratio=min(area(*(positions[i] for i in tri))/a for tri,a in zip(triangles,rest_areas))
        metrics['area_ratio_error']=max(metrics['area_ratio_error'],abs(area_ratio-f['minFaceAreaRatio']))
        max_pen=0.0; radius=.0075+.0005*sample['scale']
        for tip in tips:
            for tri in triangles:
                a,b,c=(positions[i] for i in tri)
                triangles_checked+=1
                # Conservative axis-aligned exclusion, implemented separately.
                if any(tip[d] < min(a[d],b[d],c[d])-radius or tip[d] > max(a[d],b[d],c[d])+radius for d in range(3)): continue
                max_pen=max(max_pen,radius-point_triangle_distance(tip,a,b,c))
        metrics['penetration_error_m']=max(metrics['penetration_error_m'],abs(max_pen-f['maxPenetration']))
        forces=[0.0]*5
        for c in f['contacts']:
            contact_pairs += 1
            bary=c['bary']; tri=triangles[c['triangle']]
            assert all(-1e-12 <= v <= 1+1e-12 for v in bary)
            metrics['bary_sum_error']=max(metrics['bary_sum_error'],abs(sum(bary)-1))
            point=[sum(bary[k]*positions[tri[k]][d] for k in range(3)) for d in range(3)]
            metrics['point_reconstruction_error_m']=max(metrics['point_reconstruction_error_m'],distance(point,c['point']))
            metrics['normal_length_error']=max(metrics['normal_length_error'],abs(math.sqrt(dot(c['normal'],c['normal']))-1))
            metrics['friction_excess_N']=max(metrics['friction_excess_N'],c['tangentialForce']-sample['params']['friction']*c['normalForce'])
            forces[c['finger']]+=c['normalForce']
        metrics['normal_force_sum_error_N']=max(metrics['normal_force_sum_error_N'],max(abs(forces[i]-f['normalForces'][i]) for i in range(5)))
limits={'penetration_error_m':2e-10,'centre_error_m':2e-14,'ground_gap_error_m':1e-14,'energy_error_J':1e-10,'link_strain_error':1e-10,'structural_strain_error':1e-10,'area_ratio_error':1e-10,'bary_sum_error':1e-12,'point_reconstruction_error_m':2e-14,'normal_length_error':1e-12,'friction_excess_N':1e-9,'normal_force_sum_error_N':1e-10}
checks={name:metrics[name]<=limit for name,limit in limits.items()}
result={'sourceHash':saved['sourceHash'],'auditorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'scope':'Independent recomputation on saved discrete frames only; no CCD or physical validation.','cases':len(saved['samples']),'frames':frames_checked,'pad_triangle_checks':triangles_checked,'active_pairs':contact_pairs,'metrics':metrics,'limits':limits,'checks':checks,'passed':all(checks.values())}
out=ROOT/'docs/screenshots/material-grasp-independent.json';out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
if not result['passed']: raise SystemExit(1)
