const SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
function shell(statusCode,title,message){return {statusCode,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html,body{margin:0;background:#050403;color:#eee7de;font:14px/1.6 Arial,sans-serif}main{width:min(680px,88vw);margin:16vh auto}.eyebrow{font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#a98958}h1{font:400 42px/1.05 Georgia,serif;margin:16px 0}.muted{color:#9c9184}</style></head><body><main><div class="eyebrow">Maison de Veux</div><h1>${title}</h1><div class="muted">${message}</div></main></body></html>`};}
function safeKey(v){v=String(v||'').trim().toLowerCase();return /^[a-z0-9]+$/.test(v)?v:'';}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// This template is rendered directly for every profile that isn't one of the
// explicit legacy routes above it in netlify.toml (those still proxy to their
// own hand-built maison-{name}.netlify.app site). No per-model Netlify site,
// deploy step, or API token is needed here — the page fetches its own data
// (photos, measurements) client-side the moment it loads, using the same
// public RPC this function already calls to validate the route exists.
function profileHtml(routeKey,displayName){
  const routeJson=JSON.stringify(routeKey),name=escHtml(displayName||'Maison de Veux Model');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${name} — Maison de Veux</title>
<style>
:root{--black:#050403;--ink:#eee7de;--muted:#9c9184;--line:#28231e;--gold:#a98958}*{box-sizing:border-box}html,body{margin:0;background:var(--black);color:var(--ink);font-family:Arial,Helvetica,sans-serif}body{min-height:100vh}.brand{padding:28px 5vw 16px;font:500 11px/1.2 Arial,sans-serif;letter-spacing:.32em;text-transform:uppercase;color:var(--muted)}main{width:min(1500px,90vw);margin:0 auto;padding:34px 0 90px}.name{font-family:Georgia,'Times New Roman',serif;font-size:clamp(34px,5vw,72px);font-weight:400;letter-spacing:.02em;margin:0 0 12px}.measure{font-size:11px;line-height:1.8;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:36px}.book{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}.book figure{margin:0}.book img,.book video{display:block;width:100%;height:auto;background:#0d0b09}.status{padding:50px 0;color:var(--muted);font-size:13px;letter-spacing:.08em}.status b{color:var(--gold)}@media(max-width:760px){.brand{padding-left:20px}.book{grid-template-columns:1fr;gap:18px}main{width:calc(100vw - 40px);padding-top:22px}.measure{font-size:10px;margin-bottom:24px}}
</style></head><body data-mdv-profile=${JSON.stringify(routeKey)}><div class="brand">Maison de Veux · New York / Paris</div><main><h1 class="name" id="mdv-name">${name}</h1><div class="measure" id="mdv-measure"></div><section class="book" id="mdv-book"><div class="status">Loading public profile…</div></section></main>
<script>
(function(){'use strict';var URL=${JSON.stringify(SUPABASE_URL)},KEY=${JSON.stringify(SUPABASE_PUBLISHABLE_KEY)},ROUTE=${routeJson};
function n(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim()}function measure(d){var m=d.measurements||{},g=String(d.model&&d.model.gender||'').toLowerCase(),a=[];function add(k,v){if(n(v))a.push(k+' '+n(v))}add('HEIGHT',m.height);if(g==='men'||g==='male')add('CHEST',m.chest||m.bust);else add('BUST',m.bust||m.chest);add('WAIST',m.waist);add('HIPS',m.hips);add('SHOE',m.shoe);if(g==='men'||g==='male')add('SUIT',m.suit);else add('DRESS',m.dress);add('HAIR',m.hair);add('EYES',m.eyes);return a.join('  ')}
async function init(){var book=document.getElementById('mdv-book');try{var r=await fetch(URL+'/rest/v1/rpc/website_public_model_profile',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify({target_profile:ROUTE})}),d=await r.json();if(!r.ok||!d||d.error||!d.model)throw new Error(d&&d.error||'Profile unavailable');document.getElementById('mdv-name').textContent=d.model.display_name||'';document.getElementById('mdv-measure').textContent=measure(d);document.title=((d.public_profile&&d.public_profile.seo_title)||d.model.display_name||'Model')+' — Maison de Veux';var g=Array.isArray(d.gallery)?d.gallery:[];book.innerHTML='';if(!g.length){book.innerHTML='<div class="status">Public gallery coming soon.</div>';return}g.forEach(function(x){var f=document.createElement('figure'),el;if(String(x.media_type||'image').toLowerCase()==='video'){el=document.createElement('video');el.controls=true;el.playsInline=true;el.preload='metadata'}else{el=document.createElement('img');el.loading=x.is_primary?'eager':'lazy';el.alt=d.model.display_name||'Maison de Veux model'}el.src=x.url||'';f.appendChild(el);book.appendChild(f)})}catch(e){book.innerHTML='<div class="status"><b>Maison de Veux</b><br>Profile is not currently available.</div>';console.warn(e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();
</script></body></html>`;
}
export const handler=async(event)=>{
  if(event.httpMethod!=='GET'&&event.httpMethod!=='HEAD')return shell(405,'Method Not Allowed','This public profile route only accepts browser requests.');
  const requested=safeKey(event.queryStringParameters?.profile||String(event.path||'').split('/').filter(Boolean).pop());
  if(!requested)return shell(404,'Profile Not Found','This Maison de Veux profile is not available.');
  try{
    const rpc=await fetch(SUPABASE_URL+'/rest/v1/rpc/website_public_model_profile',{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({target_profile:requested})});
    const profile=await rpc.json();
    if(!rpc.ok||!profile||profile.error||!profile.model)return shell(404,'Profile Not Found','This Maison de Veux profile is not published.');
    const route=safeKey(profile.model.legacy_key||requested);
    if(!route||route!==requested)return shell(404,'Profile Not Found','This Maison de Veux profile route is not available.');
    if(event.httpMethod==='HEAD')return {statusCode:200,headers:{'Content-Type':'text/html; charset=utf-8'},body:''};
    return {statusCode:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60, stale-while-revalidate=300','X-Content-Type-Options':'nosniff'},body:profileHtml(route,profile.model.display_name)};
  }catch(error){console.error('[model-profile-router]',error);return shell(503,'Profile Temporarily Unavailable','Please try this Maison de Veux profile again shortly.');}
};
