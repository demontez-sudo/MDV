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
    const {data:req,error:re}=await admin.from('signature_requests').select('id,status,expires_at,contract_id,contracts!signature_requests_contract_same_org_fk(id,organization_id,title,contract_type,status,effective_on,expires_on,structured_terms)').eq('id',reqState.id).single();if(re)throw re;
    /* The contract PDF(s) the signer needs to read: short-lived links, only for the document list on this contract. */
    const contract=req.contracts||null;let documents=[];
    try{
      const refs=Array.isArray(contract?.structured_terms?.documents)?contract.structured_terms.documents.slice(0,10):[];
      const ids=refs.map(x=>x&&x.id).filter(Boolean);
      if(ids.length){
        const {data:docs}=await admin.from('documents').select('id,name,mime_type,storage_provider,storage_bucket,storage_path,external_url,status').eq('organization_id',contract.organization_id).in('id',ids);
        for(const d of docs||[]){
          if(d.status&&d.status!=='active')continue;
          let url=null;
          if(d.storage_provider==='supabase'&&d.storage_bucket&&d.storage_path){const {data:u}=await admin.storage.from(d.storage_bucket).createSignedUrl(d.storage_path,3600);url=u?.signedUrl||null;}
          else if(d.external_url)url=d.external_url;
          if(url)documents.push({id:d.id,name:d.name||'Document',mime_type:d.mime_type||null,url});
        }
      }
    }catch(_e){documents=[];}
    const publicContract=contract?{id:contract.id,title:contract.title,contract_type:contract.contract_type,status:contract.status,effective_on:contract.effective_on,expires_on:contract.expires_on}:null;
    return json(200,{verified:true,signature_request:{id:req.id,status:req.status,expires_at:req.expires_at},contract:publicContract,documents,signer:{id:signer.id,display_name:signer.display_name,email:signer.email,status:signer.status},persisted_at:viewed.persisted_at});
  }catch(error){return errorResponse(error);}
};
