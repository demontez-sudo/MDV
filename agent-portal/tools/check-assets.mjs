// Verifies the deployed tree (public/): every asset the pages and the post-login
// shell loader reference exists, and every script parses. Run: npm run check
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];
const pages = [['public/index.html', 'public/assets'], ['public/admin/index.html', 'public/admin/assets']];

for (const [page, assets] of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:src|href)=["']assets\/([^"'?#]+)/gi)) refs.add(m[1]);
  for (const m of html.matchAll(/asset\(['"]([^'"?]+)['"]\)/g)) refs.add(m[1]);
  for (const name of refs) if (!fs.existsSync(path.join(root, assets, name))) errors.push(`${page}: missing asset ${name}`);
}

const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
for (const m of sw.matchAll(/['"](\/[^'"?]+\.(?:js|css|html|svg|png|webmanifest))/g)) {
  if (!fs.existsSync(path.join(root, 'public', m[1]))) errors.push(`sw.js precache missing ${m[1]}`);
}

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of [...walk(path.join(root, 'public')), ...walk(path.join(root, 'netlify'))]) {
  if (!/\.m?js$/.test(f)) continue;
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { errors.push(`syntax: ${path.relative(root, f)}`); }
}

if (errors.length) { console.error(errors.join('\n')); console.error(`FAIL (${errors.length})`); process.exit(1); }
console.log('agent-portal asset + syntax check: PASS');
