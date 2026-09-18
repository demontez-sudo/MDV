import crypto from 'node:crypto';
import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { deliverEmailMessage, requireEmailDelivery } from './_lib/email.mjs';
import { enforceRateLimit, withIdempotency } from './_lib/reliability.mjs';

const emailRx=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);const admin=adminClient();const body=parseBody(event);
    const org=body.organization_id;if(!org)return json(400,{error:'organization_id is required'});
    if(!await assertPermission(admin,user.id,org,'contracts.write'))return json(403,{error:'Missing permission: contracts.write'});
    await enforceRateLimit(admin,{bucket:'contracts.signature_send',subject:user.id,maxRequests:20,windowSeconds:60});
    return withIdempotency(admin,{event,body,organizationId:org,userId:user.id,operation:'contracts.signature_send',execute:async()=>{
    const requestId=body.signature_request_id;if(!requestId)return json(400,{error:'signature_request_id is required'});
    const {data:req,error:re}=await admin.from('signature_requests').select('*,contracts!signature_requests_contract_same_org_fk(id,title,contract_type),signature_signers(*)').eq('organization_id',org).eq('id',requestId).maybeSingle();if(re)throw re;if(!req)return json(404,{error:'Signature request not found'});
    const signers=(req.signature_signers||[]).filter(s=>s.status==='pending'||(body.resend===true&&['sent','viewed'].includes(s.status)));
    if(!signers.length)return json(400,{error:'No pending signers remain'});
    if(signers.some(s=>!emailRx.test(String(s.email||''))))return json(400,{error:'Every pending signer must have a valid email'});
    const {data:settings,error:se}=await admin.from('organization_settings').select('*').eq('organization_id',org).single();if(se)throw se;
    const base=String(process.env.VEUX_PUBLIC_SIGN_BASE_URL||process.env.URL||'').replace(/\/$/,'');if(!base)return json(500,{error:'VEUX_PUBLIC_SIGN_BASE_URL is not configured'});
    const fromEmail=String(settings.sender_email||process.env.VEUX_DEFAULT_SENDER_EMAIL||'');if(!emailRx.test(fromEmail))return json(400,{error:'No valid sender email is configured'});
    try{requireEmailDelivery({senderEmail:fromEmail});}catch(e){return json(e.statusCode||503,{error:e.publicMessage||e.message,code:e.code||'EMAIL_PROVIDER_NOT_CONFIGURED'});}
    const expiresAt=body.expires_at||req.expires_at||new Date(Date.now()+7*86400000).toISOString();
    const sent=[];
    for(const signer of signers){
      const raw=token();
      const url=`${base}/sign?token=${encodeURIComponent(raw)}`;
      const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px"><h2 style="font-weight:500">Signature requested</h2><p>${esc(signer.display_name||'Hello')},</p><p>You have a document from ${esc(settings.sender_name||'the agency')} ready for review.</p><p><strong>${esc(req.contracts?.title||req.contracts?.contract_type||'Agreement')}</strong></p><p><a href="${esc(url)}" style="display:inline-block;padding:12px 18px;background:#17130f;color:#fff;text-decoration:none">Review document</a></p><p style="font-size:12px;color:#777">This secure link expires ${esc(expiresAt)}.</p></div>`;
      const message={template_key:'signature_request',from_name:settings.sender_name||null,from_email:fromEmail,reply_to:settings.reply_to_email||null,to_emails:[signer.email],cc_emails:[],bcc_emails:[],subject:body.subject||`Signature requested: ${req.contracts?.title||'Agreement'}`,html_body:html,text_body:null};
      const {data:prepared,error:prepareError}=await admin.rpc('prepare_signature_delivery_v1',{target_org:org,target_request:req.id,target_signer:signer.id,target_token_hash:sha256(raw),target_expires:expiresAt,target_message:message,target_user:user.id});
      if(prepareError)throw prepareError;if(!prepared?.verified||!prepared?.access_token_id||!prepared?.email_message_id)throw new Error('Signature delivery preparation was not verified');
      try{
        await deliverEmailMessage(admin,prepared.email_message_id);
      }catch(sendError){
        const {data:cleanup,error:cleanupError}=await admin.rpc('cleanup_signature_delivery_v1',{target_org:org,target_request:req.id,target_signer:signer.id,target_access:prepared.access_token_id,target_email_message:prepared.email_message_id});
        if(cleanupError||!cleanup?.verified){const e=new Error(`Signature delivery failed and cleanup could not be verified: ${cleanupError?.message||sendError?.message||sendError}`);e.cause=sendError;throw e;}
        throw sendError;
      }
      const {data:finalized,error:finalizeError}=await admin.rpc('finalize_signature_delivery_v1',{target_org:org,target_request:req.id,target_signer:signer.id,target_access:prepared.access_token_id,target_email_message:prepared.email_message_id,target_user:user.id});
      if(finalizeError)throw finalizeError;if(!finalized?.verified||!finalized?.secure_link_redacted)throw new Error('Signature delivery finalization was not verified');
      sent.push({signer_id:signer.id,email:signer.email,delivery:'sent',persisted_at:finalized.persisted_at});
    }
    return json(200,{ok:true,verified:true,signature_request_id:req.id,signers:sent,persisted_at:sent.at(-1)?.persisted_at||new Date().toISOString()});
    }});
  }catch(error){return errorResponse(error);}
};
