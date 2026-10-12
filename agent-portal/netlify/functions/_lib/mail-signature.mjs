/* Email signature: validated on the server, rendered as email-safe HTML (inline styles, no images) and plain text. */
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function cleanSignature(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const s = {
    enabled: raw.enabled !== false,
    name: clean(raw.name, 80), title: clean(raw.title, 80), company: clean(raw.company, 80),
    phone: clean(raw.phone, 40), email: clean(raw.email, 120), website: clean(raw.website, 120),
    address: clean(raw.address, 140), note: clean(raw.note, 300)
  };
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(s.email)) s.email = '';
  s.website = s.website.replace(/^https?:\/\//i, '').replace(/[\s<>"']/g, '');
  const any = s.name || s.title || s.company || s.phone || s.email || s.website || s.address || s.note;
  return any ? s : null;
}

export function signatureHtml(raw) {
  const s = cleanSignature(raw);
  if (!s || !s.enabled) return '';
  const sans = "font-family:Arial,Helvetica,sans-serif";
  const contact = [s.phone ? esc(s.phone) : '', s.email ? `<a href="mailto:${esc(s.email)}" style="color:#8c6a2f;text-decoration:none">${esc(s.email)}</a>` : '', s.website ? `<a href="https://${esc(s.website)}" style="color:#8c6a2f;text-decoration:none">${esc(s.website)}</a>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ');
  return `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #a9895f;max-width:480px;color:#1b1814">`
    + (s.name ? `<div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:600">${esc(s.name)}</div>` : '')
    + (s.title ? `<div style="${sans};font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#6b5f4d;margin-top:3px">${esc(s.title)}</div>` : '')
    + (s.company ? `<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;margin:10px 0 4px">${esc(s.company)}</div>` : '')
    + (contact ? `<div style="${sans};font-size:12px;line-height:1.7;color:#4a4238">${contact}</div>` : '')
    + (s.address ? `<div style="${sans};font-size:12px;line-height:1.6;color:#4a4238">${esc(s.address)}</div>` : '')
    + (s.note ? `<div style="${sans};font-size:11px;line-height:1.5;color:#8a8070;margin-top:10px">${esc(s.note)}</div>` : '')
    + `</div>`;
}

export function signatureText(raw) {
  const s = cleanSignature(raw);
  if (!s || !s.enabled) return '';
  const line1 = [s.title, s.company].filter(Boolean).join(', ');
  const contact = [s.phone, s.email, s.website].filter(Boolean).join(' | ');
  return ['', '--', s.name, line1, contact, s.address, s.note].filter((x, i) => i < 2 || x).join('\n');
}
