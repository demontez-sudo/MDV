const NETLIFY_API='https://api.netlify.com/api/v1';
const TIMEOUT_MS=8000;

function secret(name){
  let v=String(process.env[name]||'').trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1).trim();
  return v;
}

function fail(statusCode,publicMessage,detail){
  const e=new Error(detail||publicMessage);
  e.statusCode=statusCode;
  e.publicMessage=publicMessage;
  return e;
}

async function call(path,{method='GET',headers={},body}={}){
  const token=secret('VEUX_NETLIFY_API_TOKEN');
  if(!token)throw fail(503,'Website deployment is not configured on this deployment (missing Netlify API token).','Missing VEUX_NETLIFY_API_TOKEN');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  let res;
  try{
    res=await fetch(NETLIFY_API+path,{method,headers:{Authorization:'Bearer '+token,...headers},body,signal:ctl.signal});
  }catch(err){
    if(err?.name==='AbortError')throw fail(504,'Netlify took too long to respond. Try again in a moment.');
    throw fail(502,'Could not reach Netlify. Try again in a moment.',err?.message);
  }finally{clearTimeout(timer);}
  let data=null;
  try{data=await res.json();}catch(_e){}
  if(res.ok)return data;
  const remote=String(data?.message||data?.error||'').trim();
  if(res.status===401||res.status===403)throw fail(503,'Website deployment is misconfigured: the Netlify API token was rejected.',remote||'Netlify auth rejected');
  if(res.status===422)throw fail(409,'Netlify rejected the request'+(remote?': '+remote:'.'),remote);
  throw fail(502,'Netlify error ('+res.status+')'+(remote?': '+remote:'.'),remote);
}

export async function findSiteByName(siteName){
  const list=await call('/sites?filter=all&name='+encodeURIComponent(siteName));
  return (Array.isArray(list)?list:[]).find(s=>String(s?.name||'').toLowerCase()===siteName.toLowerCase())||null;
}

export async function ensureSite(siteName,existingSiteId){
  if(existingSiteId){
    try{
      const site=await call('/sites/'+encodeURIComponent(existingSiteId));
      if(site?.id)return site;
    }catch(err){
      if(!/\(404\)/.test(String(err?.publicMessage||'')))throw err;
    }
  }
  const found=await findSiteByName(siteName);
  if(found)return found;
  const account=secret('VEUX_NETLIFY_ACCOUNT_SLUG');
  return call(account?'/'+encodeURIComponent(account)+'/sites':'/sites',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:siteName})
  });
}

export async function uploadZipDeploy(siteId,zipBuffer){
  const deploy=await call('/sites/'+encodeURIComponent(siteId)+'/deploys',{
    method:'POST',
    headers:{'Content-Type':'application/zip'},
    body:zipBuffer
  });
  if(!deploy?.id)throw fail(502,'Netlify accepted the upload but did not return a deploy id.');
  return deploy;
}

export async function getDeployState(deployId){
  const d=await call('/deploys/'+encodeURIComponent(deployId));
  return {state:String(d?.state||'unknown'),error:d?.error_message||null};
}
