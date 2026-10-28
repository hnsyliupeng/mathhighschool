#!/usr/bin/env python3
"""Regenerate the small benchmark using a local checkout and native GNU Octave.

Example:
  git clone https://github.com/weicheng-huang-mechanics/DDG_Tutorial /tmp/DDG_Tutorial
  python3 scripts/generate_reference.py /tmp/DDG_Tutorial --octave octave

The supplied benchmark was produced using GNU Octave 7.2.0 WebAssembly. This
script uses a native Octave executable and avoids redistributing the upstream
MATLAB source. It removes plotting/logging only and limits the beam to 50 steps.
"""
import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path, help='local DDG_Tutorial checkout')
parser.add_argument('--octave', default='octave')
parser.add_argument('--output', type=Path, default=Path('src/data/references/octave-reference.json'))
args = parser.parse_args()
source = args.source.resolve()
commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
runner = subprocess.check_output([args.octave, '--version'], text=True).splitlines()[0]


def run(work):
    subprocess.run([args.octave, '--quiet', '--no-gui', 'main.m'], cwd=work, check=True, timeout=900)


def mass(root, name):
    work = root / name
    shutil.copytree(source / 'mass_spring_system' / name, work)
    main = work / 'main.m'
    text = main.read_text().replace('close all;', '').replace('clc;', '')
    text = re.split(r'% plot result', text, maxsplit=1)[0]
    if name == 'single_DOF':
        vector, fmt = "[t; x'; u']", '%.12g %.12g %.12g\\n'
    else:
        vector = '[t; x(2,:); x(3,:); x(4,:); u(2,:); u(3,:); u(4,:)]'
        fmt = '%.12g %.12g %.12g %.12g %.12g %.12g %.12g\\n'
    text += f"\nfid=fopen('result.txt','w'); fprintf(fid,'{fmt}', {vector}); fclose(fid);\n"
    main.write_text(text)
    run(work)
    rows = [[float(x) for x in line.split()] for line in (work / 'result.txt').read_text().splitlines() if line.strip()]
    if len(rows) != 1000:
        raise RuntimeError(f'{name}: expected 1000 rows, got {len(rows)}')
    return [{'step': i, 'time_label': row[0], 'positions': row[1:2] if name == 'single_DOF' else row[1:4]}
            for i, row in enumerate(rows) if i % 10 == 0 or i == len(rows)-1]


def beam(root):
    work = root / 'beam'
    shutil.copytree(source / '2d_curve' / 'case_1', work)
    main = work / 'main.m'
    text = main.read_text().replace('close all;', '').replace('clc;', '')
    text = text.replace('simParams = defSimParams();', 'simParams = defSimParams(); simParams.Nsteps = 50; simParams.plotStep = 100000;')
    text = text.replace("fprintf('t=%f\\n', ctime);", '').replace('%.4f', '%.12g')
    main.write_text(text)
    objfun = work / 'objfun.m'
    objfun.write_text(objfun.read_text().replace("fprintf('Iter=%d, error=%e\\n', iter-1, normfNew);", ''))
    (work / 'plotBeam.m').write_text('function plotBeam(varargin)\nend\n')
    run(work)
    rows = [[float(x) for x in line.split()] for line in (work / 'data.txt').read_text().splitlines() if line.strip()]
    if len(rows) != 50 * 40:
        raise RuntimeError(f'beam: expected 2000 rows, got {len(rows)}')
    return [{'step': i//40+1, 'time_label': row[0], 'tip_y': row[2]}
            for i, row in enumerate(rows) if i % 40 == 39]


with tempfile.TemporaryDirectory(prefix='ddg-reference-') as temp:
    root = Path(temp)
    data = {
        'metadata': {
            'reference_repository': 'https://github.com/weicheng-huang-mechanics/DDG_Tutorial',
            'reference_commit': commit, 'runner': runner, 'date': 'regenerated',
            'modifications': 'Removed close/clc and plotting, silenced per-iteration console output. Beam run limited to 50 time steps; recorded output with 12 significant digits. Mass outputs use original 1000 time labels and 999 integration steps.',
            'notes': 'The original mass scripts use linspace(0,10,1000) for force evaluation while dt=0.01; the browser uses t=n*dt. Beam reference nodes are rounded to 4 decimals; browser initial nodes are evenly spaced. Comparisons are therefore tolerance-based.'
        },
        'single': mass(root, 'single_DOF'), 'multiple': mass(root, 'multiple_DOF'), 'beam': beam(root)
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {args.output} (reference {commit})')
