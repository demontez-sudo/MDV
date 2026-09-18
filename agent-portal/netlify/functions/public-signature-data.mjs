import crypto from 'node:crypto';
import { adminClient, json, errorResponse } from './_lib/auth.mjs';
const sha256=s=>crypto.createHash('sha256').update(String(s||'')).digest('hex');

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const raw=event.queryStringParameters?.token;if(!raw)return json(400,{error:'token is required'});
    const admin=adminClient();
    const {data:access,error}=await admin.from('signature_access_tokens').select('id').eq('token_hash',sha256(raw)).eq('status','active').maybeSingle();if(error)throw error;
    if(!access)return json(404,{error:'Signature link is invalid or no longer active'});
    const {data:viewed,error:viewError}=await admin.rpc('mark_signature_viewed_v1',{target_access:access.id});
    if(viewError)throw viewError;
    if(viewed?.verified!==true||viewed?.available!==true){if(viewed?.reason==='expired')return json(410,{error:'Signature link has expired'});return json(404,{error:'Signature link is invalid or no longer active'});}
    const signer=viewed.signer,reqState=viewed.signature_request;
    const {data:req,error:re}=await admin.from('signature_requests').select('id,status,expires_at,contract_id,contracts!signature_requests_contract_same_org_fk(id,title,contract_type,status,effective_on,expires_on)').eq('id',reqState.id).single();if(re)throw re;
    return json(200,{verified:true,signature_request:{id:req.id,status:req.status,expires_at:req.expires_at},contract:req.contracts,signer:{id:signer.id,display_name:signer.display_name,email:signer.email,status:signer.status},persisted_at:viewed.persisted_at});
  }catch(error){return errorResponse(error);}
};
