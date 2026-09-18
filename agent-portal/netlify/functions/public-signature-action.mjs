import crypto from 'node:crypto';
import { adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
const sha256=s=>crypto.createHash('sha256').update(String(s||'')).digest('hex');

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const body=parseBody(event);const raw=body.token;const action=String(body.action||'');
    if(!raw||!['signed','declined'].includes(action))return json(400,{error:'token and action signed|declined are required'});
    const admin=adminClient();const {data:access,error}=await admin.from('signature_access_tokens').select('*').eq('token_hash',sha256(raw)).eq('status','active').maybeSingle();if(error)throw error;if(!access)return json(404,{error:'Signature link is invalid or inactive'});
    const {data:result,error:responseError}=await admin.rpc('respond_signature_v1',{target_access:access.id,target_action:action,target_note:body.note||null,target_typed_name:body.typed_name||null});
    if(responseError)throw responseError;
    if(result?.verified!==true){const e=new Error('Signature response could not be verified');e.statusCode=409;throw e;}
    if(result?.expired===true)return json(410,{error:'Signature link has expired'});
    return json(200,{ok:true,verified:true,status:result.status||action,all_signed:!!result.all_signed,persisted_at:result.persisted_at});
  }catch(error){return errorResponse(error);}
};
