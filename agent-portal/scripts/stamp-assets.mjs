// Stamps the startup files of the portal with a version taken from their content.
// index.html and admin/index.html carry a hash block inside the "mdv-ui-loader" script (between the markers mdv-hashes and end-hashes).
// Every file the loader names gets ?v=<first 10 characters of its SHA-1>, so a file's address only changes when the file does,
// which lets the service worker keep it for good. Run it after editing any file named in the loader (Netlify runs it on every deploy).
//   node scripts/stamp-assets.mjs           write the hashes
//   node scripts/stamp-assets.mjs --check   exit 1 if the committed hashes are out of date
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const PAGES = ['index.html', 'admin/index.html'];
let stale = 0;

function loaderBlock(html) {
  const i = html.indexOf('<script id="mdv-ui-loader">');
  if (i < 0) throw new Error('mdv-ui-loader not found');
  const j = html.indexOf('</script>', i);
  return { i, j, text: html.slice(i, j) };
}

for (const page of PAGES) {
  const file = path.join(root, page);
  const html = fs.readFileSync(file, 'utf8');
  try {
    const { i, j, text } = loaderBlock(html);
    const names = [...new Set([...text.matchAll(/'([A-Za-z0-9_.\-]+\.(?:js|css))'/g)].map(m => m[1]))].sort();
    const H = {};
    for (const n of names) {
      const p = path.join(root, page.startsWith('admin/') ? 'admin/assets' : 'assets', n);   // the admin page reads its own mirror of the files
      if (!fs.existsSync(p)) throw new Error('missing asset ' + n);
      H[n] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 10);
    }
    const block = '/*mdv-hashes*/var H=' + JSON.stringify(H) + ';/*end-hashes*/';
    const next = text.replace(/\/\*mdv-hashes\*\/[\s\S]*?\/\*end-hashes\*\//, block);
    if (next === text && !text.includes(block)) throw new Error('hash markers not found in ' + page);
    if (check) { if (next !== text) { stale++; console.error('out of date: ' + page); } continue; }
    fs.writeFileSync(file, html.slice(0, i) + next + html.slice(j));
    console.log('stamped ' + page + ': ' + names.length + ' files');
  } catch (e) {
    if (check) { stale++; console.error(page + ': ' + e.message); continue; }
    /* never leave stale hashes behind: with no hashes the loader falls back to a stamp that is new on every deploy */
    console.warn('could not stamp ' + page + ' (' + e.message + '), falling back to a deploy-time stamp');
    const html2 = fs.readFileSync(file, 'utf8');
    const stamp = '?v=d' + Date.now().toString(36);
    fs.writeFileSync(file, html2.replace(/\/\*mdv-hashes\*\/[\s\S]*?\/\*end-hashes\*\//, '/*mdv-hashes*/var H={};/*end-hashes*/').replace(/var v='\?v=[^']*';/, "var v='" + stamp + "';"));
  }
}
if (check && stale) process.exit(1);
