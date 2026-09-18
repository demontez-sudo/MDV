import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { loadModels } from './_lib/portal-bridge.mjs';

const SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';

function crc32(buf){
  let c=0xffffffff;
  for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}
  return (c^0xffffffff)>>>0;
}
function zipStore(files){
  const locals=[],centrals=[];let offset=0;
  for(const file of files){
    const name=Buffer.from(file.name,'utf8'),data=Buffer.isBuffer(file.data)?file.data:Buffer.from(String(file.data),'utf8'),crc=crc32(data);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(0,8);local.writeUInt16LE(0,10);local.writeUInt16LE(0,12);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);
    locals.push(local,name,data);
    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(0,10);central.writeUInt16LE(0,12);central.writeUInt16LE(0,14);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(0,30);central.writeUInt16LE(0,32);central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);central.writeUInt32LE(0,38);central.writeUInt32LE(offset,42);
    centrals.push(central,name);
    offset+=local.length+name.length+data.length;
  }
  const centralStart=offset,centralBuf=Buffer.concat(centrals),localBuf=Buffer.concat(locals),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralBuf.length,12);end.writeUInt32LE(centralStart,16);end.writeUInt16LE(0,20);
  return Buffer.concat([localBuf,centralBuf,end]);
}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function canonicalProfileHtml(routeKey,displayName){
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
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const slug=event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=await requirePermission(user.id,organization.id,'public_profiles.manage');
    const modelId=String(event.queryStringParameters?.model_id||'').trim();
    if(!modelId){const e=new Error('model_id is required');e.statusCode=400;throw e;}
    const model=(await loadModels(admin,organization.id,[modelId]))[0];
    if(!model){const e=new Error('Model not found');e.statusCode=404;throw e;}
    const {data:profile,error}=await admin.from('model_public_profiles').select('*').eq('organization_id',organization.id).eq('model_id',modelId).maybeSingle();if(error)throw error;
    if(!profile){const e=new Error('Create the Website Profile in Model 360 before generating a site build.');e.statusCode=409;throw e;}
    if(profile?.metadata?.publication_source){const e=new Error('This model already has an existing Maison profile site. Use the existing-site sync merge workflow so the current design is preserved.');e.statusCode=409;throw e;}
    const routeKey=String(model.legacy_key||profile.metadata?.website_profile?.route_key||'').trim().toLowerCase();
    if(!routeKey){const e=new Error('Website route is not configured.');e.statusCode=409;throw e;}
    const siteName='maison-'+routeKey,siteOrigin='https://'+siteName+'.netlify.app',profileUrl='https://www.maisondeveux.com/'+routeKey;
    const manifest={checkpoint:'16.9.17',model_id:model.id,display_name:model.display_name,route_key:routeKey,public_slug:model.public_slug||null,site_name:siteName,site_origin:siteOrigin,profile_url:profileUrl,published:!!profile.published,generated_at:new Date().toISOString(),architecture:'individual-model-netlify-site + MOGY Model 360 public source',instructions:'Deploy this ZIP to the individual Netlify site named '+siteName+'. After Main Site 16.9.17 is live, the branded '+profileUrl+' route resolves through the published-profile fallback without adding another explicit redirect.'};
    const netlify=`[build]\n  publish = "."\n\n[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Content-Type-Options = "nosniff"\n    Referrer-Policy = "strict-origin-when-cross-origin"\n`;
    const zip=zipStore([{name:'index.html',data:canonicalProfileHtml(routeKey,model.display_name)},{name:'netlify.toml',data:netlify},{name:'PROFILE_BUILD.json',data:JSON.stringify(manifest,null,2)+'\n'}]);
    return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${siteName}.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:zip.toString('base64')};
  }catch(error){return errorResponse(error);}
};
