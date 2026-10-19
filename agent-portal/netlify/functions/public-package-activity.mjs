import crypto from 'node:crypto';
import { notify } from './_lib/push.mjs';
import { adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';

const headers={'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow'};
const hashToken=token=>crypto.createHash('sha256').update(String(token||'')).digest('hex');
function validToken(v){return /^[A-Za-z0-9_-]{32,160}$/.test(String(v||''));}
function unavailable(link){return !link||link.status!=='active'||(link.expires_at&&new Date(link.expires_at).getTime()<=Date.now())||(Number(link.max_views)>0&&Number(link.view_count||0)>=Number(link.max_views));}
const allowedEvents=new Set(['model_viewed','profile_opened','request_form_opened']);

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'},{...headers,Allow:'POST'});
  try{
    const body=parseBody(event),raw=String(body.token||'').trim(),eventType=String(body.event_type||'').trim(),modelId=String(body.model_id||'').trim()||null;
    if(!validToken(raw)||!allowedEvents.has(eventType))return json(400,{error:'Invalid package activity'},headers);
    const admin=adminClient();
    const {data:link,error}=await admin.from('package_share_links').select('*').eq('token_hash',hashToken(raw)).maybeSingle();if(error)throw error;
    if(unavailable(link))return json(404,{error:'Package link is invalid, expired, or inactive'},headers);
    if(modelId){
      const {data:pm,error:pme}=await admin.from('package_models').select('id').eq('organization_id',link.organization_id).eq('package_id',link.package_id).eq('model_id',modelId).eq('visible',true).maybeSingle();if(pme)throw pme;
      if(!pm)return json(404,{error:'Model is not available in this package'},headers);
    }
    const {data:row,error:ae}=await admin.from('package_activity').insert({organization_id:link.organization_id,package_id:link.package_id,recipient_id:link.recipient_id||null,share_link_id:link.id,event_type:eventType,actor_label:'Package recipient',metadata:{model_id:modelId}}).select('id,created_at').single();if(ae)throw ae;
    try{
      /* the first look in an hour is worth an alert; every click after that is not */
      const since=new Date(Date.now()-3600*1000).toISOString();
      const {count}=await admin.from('package_activity').select('id',{count:'exact',head:true}).eq('share_link_id',link.id).gte('created_at',since).neq('id',row.id);
      if(!count){
        const {data:pk}=await admin.from('packages').select('title').eq('id',link.package_id).maybeSingle();
        let who='A client';if(link.recipient_id){const {data:rc}=await admin.from('package_recipients').select('display_name,email').eq('id',link.recipient_id).maybeSingle();who=rc?.display_name||rc?.email||who;}
        await notify(admin,{orgId:link.organization_id,title:who+' is looking at a package',body:pk?.title||'Model package',url:'?page=packageresponses',category:'packages',tag:'pkgview-'+link.id});
      }
    }catch(e){console.warn('[push] package view alert skipped',e&&e.message||e);}
    return json(201,{ok:true,verified:true,activity_id:row.id,persisted_at:row.created_at},headers);
  }catch(error){const r=errorResponse(error);r.headers={...r.headers,...headers};return r;}
};
