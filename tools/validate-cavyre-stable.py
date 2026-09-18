#!/usr/bin/env python3
from pathlib import Path
import re, sys, subprocess, hashlib
ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
errors=[]; warnings=[]

def err(x): errors.append(x)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
# Publish authority
nt=(ROOT/'netlify.toml').read_text(errors='ignore')
if not re.search(r'publish\s*=\s*["\']public["\']',nt): err('netlify.toml does not publish public/')
# Entry points
entries=[PUB/'index.html',PUB/'admin/index.html',ROOT/'admin/index.html']
for ep in entries:
    if not ep.exists(): err(f'missing entrypoint {ep.relative_to(ROOT)}'); continue
    text=ep.read_text(errors='ignore')
    refs=re.findall(r'''(?:src|href)=["']([^"'#?]+)''',text)
    for ref in refs:
        if ref.startswith(('http:','https:','data:','mailto:','tel:','#','//')): continue
        if ref.startswith('/'):
            target=PUB/ref.lstrip('/')
        else:
            target=ep.parent/ref
        if not target.exists(): err(f'{ep.relative_to(ROOT)} missing static ref {ref}')
# Agent active scripts: duplicates + syntax
agent=(PUB/'admin/index.html').read_text(errors='ignore')
scripts=re.findall(r'''<script[^>]+src=["']([^"']+)''',agent,re.I)
base=[x.split('?')[0] for x in scripts]
for x in sorted(set(base)):
    if base.count(x)>1: err(f'duplicate active script {x}')
# Dynamic asset manifest from asset('...')
for name in re.findall(r'''asset\(["']([^"']+)["']\)''',agent):
    p=PUB/'assets'/name
    if not p.exists(): err(f'login/dynamic asset missing: public/assets/{name}')
# Protected Calendar contract
cal=PUB/'assets/cavyre-calendar-engine-16.15.03.js'
cal_auth=PUB/'assets/cavyre-calendar-authority-16.11.78.js'
for p in (cal,cal_auth):
    if not p.exists(): err(f'missing protected Calendar authority {p.name}')
if cal.exists():
    s=cal.read_text(errors='ignore')
    for token in ['function dayView','function threeView','function weekView','function monthView85','function avatar','vx75-orbit','vx95-runway-shell','vx89-flow-dashboard','vx85-season']:
        if token not in s: err(f'Calendar contract missing {token}')
    for forbidden in ['cvy1323-orbit-shell','VOLUMETRIC DAY COMMAND']:
        if forbidden in s: err(f'forbidden replacement Calendar renderer active: {forbidden}')
# Known conflicting active authorities should not be in Agent HTML
for forbidden in ['cavyre-full-wave-orbit','cavyre-kinetic-orbit','cavyre-model-agency-calendar','vera-official.js']:
    if forbidden in agent: err(f'legacy authority still active: {forbidden}')
# Core routes must point to existing functions
route_pairs=re.findall(r'from\s*=\s*"([^"]+)"\s*\n\s*to\s*=\s*"/\.netlify/functions/([^"]+)"',nt)
for route,fn in route_pairs:
    if route.startswith(('/api/agent/','/admin/api/agent/')):
        p=ROOT/'netlify/functions'/f'{fn}.mjs'
        if not p.exists():
            p2=ROOT/'netlify/functions'/f'{fn}.js'
            if not p2.exists(): err(f'route {route} target missing function {fn}')
# Core API route presence
core=['/api/agent/tasks/v11','/api/agent/calendar/v9']
for r in core:
    if r not in nt: err(f'core API redirect absent: {r}')
# Active JS syntax
checked=set()
for src in base:
    if not src.endswith(('.js','.mjs')): continue
    p=(PUB/'admin'/src) if not src.startswith('/') else PUB/src.lstrip('/')
    if not p.exists() and src.startswith('assets/'): p=PUB/src
    if p.exists() and p not in checked:
        checked.add(p)
        cp=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
        if cp.returncode: err(f'JS syntax: {p.relative_to(ROOT)}: {cp.stderr.strip()[:300]}')
# Core Netlify function syntax
for p in [ROOT/'netlify/functions/agent-task-approval-desk-v11.mjs',ROOT/'netlify/functions/agent-calendar-v9.mjs',ROOT/'netlify/functions/agent-season-desk-v9.mjs',ROOT/'netlify/functions/agent-model-operating-graph-v1.mjs']:
    if p.exists():
        cp=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
        if cp.returncode: err(f'Function syntax: {p.name}: {cp.stderr.strip()[:300]}')
# Task resilience contract
task=ROOT/'netlify/functions/agent-task-approval-desk-v11.mjs'
if task.exists():
    s=task.read_text(errors='ignore')
    for token in ['optionalRows','verified_recovery',"partial:warnings.length>0"]:
        if token not in s: err(f'Task resilience contract missing {token}')
print(f'CAVYRE STABILITY GATE: {len(errors)} errors, {len(warnings)} warnings')
if errors:
    for x in errors: print('ERROR:',x)
    sys.exit(1)
print(f'PASS: {len(checked)} active Agent scripts syntax-checked; static/dynamic assets resolve; core routes resolve; Calendar design contract locked; Tasks fail-soft contract present.')
