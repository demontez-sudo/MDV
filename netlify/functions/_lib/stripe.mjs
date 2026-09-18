import crypto from 'node:crypto';

function env(name){ const v=process.env[name]; if(!v) throw new Error(`Missing environment variable: ${name}`); return v; }

export async function stripeRequest(path, { method='POST', form=null } = {}) {
  const secret = env('STRIPE_SECRET_KEY');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(form ? { 'Content-Type':'application/x-www-form-urlencoded' } : {})
    },
    body: form ? new URLSearchParams(flattenForm(form)).toString() : undefined
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){ const err=new Error(data?.error?.message || `Stripe request failed (${res.status})`); err.statusCode=502; err.providerStatus=res.status; throw err; }
  return data;
}

function flattenForm(input, prefix='', out={}) {
  if (input === undefined) return out;
  if (input === null) { out[prefix]=''; return out; }
  if (Array.isArray(input)) { input.forEach((v,i)=>flattenForm(v, `${prefix}[${i}]`, out)); return out; }
  if (typeof input === 'object') { for (const [k,v] of Object.entries(input)) flattenForm(v, prefix ? `${prefix}[${k}]` : k, out); return out; }
  out[prefix]=String(input); return out;
}

export function verifyStripeWebhook(rawBody, signatureHeader, secret=process.env.STRIPE_WEBHOOK_SECRET, toleranceSeconds=300) {
  if(!secret) throw new Error('Missing environment variable: STRIPE_WEBHOOK_SECRET');
  const parts=String(signatureHeader||'').split(',').map(x=>x.trim());
  const timestamp=parts.find(p=>p.startsWith('t='))?.slice(2);
  const signatures=parts.filter(p=>p.startsWith('v1=')).map(p=>p.slice(3));
  if(!timestamp || !signatures.length) return false;
  const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${rawBody}`,'utf8').digest('hex');
  const valid=signatures.some(sig=>{
    try { const a=Buffer.from(expected,'hex'), b=Buffer.from(sig,'hex'); return a.length===b.length && crypto.timingSafeEqual(a,b); } catch { return false; }
  });
  if(!valid) return false;
  const age=Math.abs(Math.floor(Date.now()/1000)-Number(timestamp));
  return Number.isFinite(age) && age<=toleranceSeconds;
}
