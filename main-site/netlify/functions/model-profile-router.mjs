const SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
function html(statusCode,title,message){return {statusCode,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html,body{margin:0;background:#050403;color:#eee7de;font:14px/1.6 Arial,sans-serif}main{width:min(680px,88vw);margin:16vh auto}.eyebrow{font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#a98958}h1{font:400 42px/1.05 Georgia,serif;margin:16px 0}.muted{color:#9c9184}</style></head><body><main><div class="eyebrow">Maison de Veux</div><h1>${title}</h1><div class="muted">${message}</div></main></body></html>`};}
function safeKey(v){v=String(v||'').trim().toLowerCase();return /^[a-z0-9]+$/.test(v)?v:'';}
export const handler=async(event)=>{
  if(event.httpMethod!=='GET'&&event.httpMethod!=='HEAD')return html(405,'Method Not Allowed','This public profile route only accepts browser requests.');
  const requested=safeKey(event.queryStringParameters?.profile||String(event.path||'').split('/').filter(Boolean).pop());
  if(!requested)return html(404,'Profile Not Found','This Maison de Veux profile is not available.');
  try{
    const rpc=await fetch(SUPABASE_URL+'/rest/v1/rpc/website_public_model_profile',{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({target_profile:requested})});
    const profile=await rpc.json();
    if(!rpc.ok||!profile||profile.error||!profile.model)return html(404,'Profile Not Found','This Maison de Veux profile is not published.');
    const route=safeKey(profile.model.legacy_key||requested);
    if(!route||route!==requested)return html(404,'Profile Not Found','This Maison de Veux profile route is not available.');
    const origin='https://maison-'+route+'.netlify.app/';
    const upstream=await fetch(origin,{headers:{'User-Agent':'Maison-de-Veux-Profile-Router/16.9.17'}});
    if(!upstream.ok)return html(503,'Profile Deployment Pending','The public profile exists, but its model site has not been deployed yet.');
    const body=event.httpMethod==='HEAD'?'':await upstream.text();
    const contentType=upstream.headers.get('content-type')||'text/html; charset=utf-8';
    return {statusCode:200,headers:{'Content-Type':contentType,'Cache-Control':'public, max-age=60, stale-while-revalidate=300','X-Content-Type-Options':'nosniff'},body};
  }catch(error){console.error('[model-profile-router]',error);return html(503,'Profile Temporarily Unavailable','Please try this Maison de Veux profile again shortly.');}
};
