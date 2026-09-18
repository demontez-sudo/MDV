from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
entries=[('public/index.html',root/'public/assets'),('public/admin/index.html',root/'public/admin/assets'),('admin/index.html',root/'admin/assets')]
errors=[]
release='16.14.12'
canonical=[f'cavyre-calendar-engine-{release}.js',f'cavyre-fashion-week-data-{release}.js',f'cavyre-season-command-{release}.js',f'cavyre-season-command-{release}.css',f'cavyre-season-smart-authority-guard-{release}.js',f'cavyre-global-release-authority-{release}.js',f'cavyre-vera-logo-authority-{release}.js',f'cavyre-vera-logo-authority-{release}.css']
for rel,adir in entries:
 p=root/rel; s=p.read_text(errors='ignore')
 if release not in s: errors.append(f'{rel}: release marker {release} missing')
 for name in re.findall(r"asset\(['\"]([^'\"]+)['\"]\)",s):
  clean=name.split('?')[0]
  if not (adir/clean).exists(): errors.append(f'{rel}: missing shell asset {clean}')
 for attr,val in re.findall(r'\b(src|href)=["\']([^"\']+)["\']',s,re.I):
  if val.startswith(('http:','https:','data:','#','mailto:','tel:')): continue
  vv=val.split('?')[0]; target=None
  if vv.startswith('/assets/'): target=root/'public'/vv.lstrip('/')
  elif vv.startswith('/admin/assets/'): target=root/'public'/vv.lstrip('/')
  elif vv.startswith('assets/'): target=p.parent/vv
  if target is not None and not target.exists(): errors.append(f'{rel}: missing static asset {val}')
 for bad in ['vx-161023-full-wave-loader','vx-161024-kinetic-orbit-loader','vx-161044-model-agency-calendar-loader','veux-agent-v16.10.16-vera-official.js']:
  if bad in s: errors.append(f'{rel}: forbidden active legacy authority: {bad}')
 for name in canonical:
  if name.endswith('.js') and name not in s and name not in ['cavyre-vera-logo-authority-'+release+'.js','cavyre-global-release-authority-'+release+'.js']:
   errors.append(f'{rel}: canonical runtime reference missing: {name}')
for name in canonical:
 blobs=[]
 for adir in [root/'public/assets',root/'public/admin/assets',root/'admin/assets']:
  f=adir/name
  if not f.exists(): errors.append(f'missing canonical mirror {f.relative_to(root)}')
  else: blobs.append(f.read_bytes())
 if blobs and any(x!=blobs[0] for x in blobs[1:]): errors.append(f'canonical mirror mismatch: {name}')
# Vera source-of-truth checks
smart=root/'public/assets/veux-agent-v16.11.11-smart-portal.js'
if smart.exists():
 t=smart.read_text(errors='ignore')
 if 'class="cvy-vera-native"' not in t: errors.append('Agency Command does not render native Vera SVG')
else: errors.append('Agency Command runtime missing')
ui=root/'public/assets/veux-agent-v16.10.22-ui-repair.js'
if ui.exists():
 t=ui.read_text(errors='ignore')
 if "querySelectorAll('img').forEach" in t or 'normalizeLauncher(){var' in t: errors.append('legacy UI Repair still mutates Vera identity')
for f in [root/'public/assets/vera/vera-mark.svg',root/'public/assets/vera/vera-avatar-circle.svg']:
 if not f.exists() or f.stat().st_size<50: errors.append(f'Vera asset invalid: {f.relative_to(root)}')
# Calendar runtime contract: syntax checks alone do not catch missing local helpers.
calendar_contract = root/'public/assets'/f'cavyre-calendar-engine-{release}.js'
calendar_text = calendar_contract.read_text(encoding='utf-8') if calendar_contract.exists() else ''
required_calendar_symbols = ['avatar','threeView','dayView','weekView','monthView85','controls','renderBody','bind','load','render']
missing_calendar_symbols = [name for name in required_calendar_symbols if f'function {name}' not in calendar_text]
if missing_calendar_symbols:
 errors.append('Calendar runtime contract missing local function(s): ' + ', '.join(missing_calendar_symbols))
if errors:
 print('FAILED'); print('\n'.join('- '+e for e in errors)); sys.exit(1)
print(f'PASS {release}: shell/static assets resolve; canonical mirrors match; legacy Calendar/Vera authorities are not active; Agency Command owns native Vera SVG; Vera assets valid.')
