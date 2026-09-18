import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { sendResendEmail } from './_lib/email.mjs';

const MODEL_PORTAL_URL='https://www.maisondeveux.com/admin/model-reset.html';
const EMAIL_RX=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_FLAG='cavyre_password_reset_required';
const TEMP_EXP='cavyre_temp_password_expires_at';
const DISABLED='cavyre_portal_disabled';

function tempPassword(){
  return `Cv!${crypto.randomBytes(12).toString('base64url')}9a`;
}
function safeMeta(user){return user?.app_metadata&&typeof user.app_metadata==='object'?user.app_metadata:{};}
async function linked(admin,orgId,modelId){
  const {data:model,error:me}=await admin.from('models').select('id,display_name,status,active').eq('organization_id',orgId).eq('id',modelId).maybeSingle();
  if(me)throw me;if(!model){const e=new Error('Model profile not found.');e.statusCode=404;throw e;}
  const {data:privateProfile}=await admin.from('model_private_profiles').select('email').eq('organization_id',orgId).eq('model_id',modelId).maybeSingle();
  model.suggested_email=privateProfile?.email||null;
  const {data:link,error:le}=await admin.from('model_user_links').select('id,user_id,model_id').eq('organization_id',orgId).eq('model_id',modelId).maybeSingle();
  if(le)throw le;
  if(!link?.user_id)return {model,link:null,user:null};
  const {data:u,error:ue}=await admin.auth.admin.getUserById(link.user_id);if(ue)throw ue;
  return {model,link,user:u?.user||null};
}
function view(ctx){
  const u=ctx.user,m=safeMeta(u),expires=m[TEMP_EXP]||null,reset=!!m[RESET_FLAG],disabled=!!m[DISABLED]||!!u?.banned_until;
  return {model_id:ctx.model.id,model_name:ctx.model.display_name||'Model',linked:!!ctx.link,auth_user_id:u?.id||null,email:u?.email||null,suggested_email:ctx.model.suggested_email||null,status:disabled?'DISABLED':(ctx.link?'ACTIVE':'NOT LINKED'),authentication:ctx.link?'Email + Password':'Not linked',last_login:u?.last_sign_in_at||null,password_status:disabled?'ACCESS DISABLED':reset?'TEMPORARY PASSWORD / RESET REQUIRED':'ACTIVE',reset_required:reset,temp_password_expires_at:expires,portal_disabled:disabled};
}

async function findAuthUserByEmail(admin,email){
  const target=String(email||'').trim().toLowerCase();if(!EMAIL_RX.test(target))return null;
  for(let page=1;page<=20;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});if(error)throw error;
    const users=data?.users||[],found=users.find(x=>String(x.email||'').trim().toLowerCase()===target);if(found)return found;
    if(users.length<100)break;
  }
  return null;
}
async function linkOrCreate(admin,organization,ctx,email,issuedBy){
  email=String(email||ctx.model.suggested_email||'').trim().toLowerCase();
  if(!EMAIL_RX.test(email)){const e=new Error('Enter a valid model login email.');e.statusCode=400;throw e;}
  let authUser=await findAuthUserByEmail(admin,email),temporary_password=null,created=false;
  if(!authUser){
    temporary_password=tempPassword();
    const {data,error}=await admin.auth.admin.createUser({email,password:temporary_password,email_confirm:true,app_metadata:{role:'model',organization_id:organization.id,[RESET_FLAG]:true,[TEMP_EXP]:new Date(Date.now()+24*60*60*1000).toISOString(),[DISABLED]:false,cavyre_model_id:ctx.model.id,cavyre_account_created_by:issuedBy}});
    if(error)throw error;authUser=data?.user;created=true;
  }else{
    const meta=safeMeta(authUser);
    const {data,error}=await admin.auth.admin.updateUserById(authUser.id,{ban_duration:'none',app_metadata:{...meta,role:meta.role||'model',organization_id:meta.organization_id||organization.id,cavyre_model_id:ctx.model.id,[DISABLED]:false}});
    if(error)throw error;authUser=data?.user||authUser;
  }
  const {data:existing,error:existingErr}=await admin.from('model_user_links').select('id,user_id,model_id').eq('organization_id',organization.id).eq('model_id',ctx.model.id).maybeSingle();if(existingErr)throw existingErr;
  let link=existing;
  if(existing){
    if(existing.user_id!==authUser.id){const {data,error}=await admin.from('model_user_links').update({user_id:authUser.id}).eq('id',existing.id).select('id,user_id,model_id').single();if(error)throw error;link=data;}
  }else{
    const {data,error}=await admin.from('model_user_links').insert({organization_id:organization.id,model_id:ctx.model.id,user_id:authUser.id}).select('id,user_id,model_id').single();if(error)throw error;link=data;
  }
  return {link,user:authUser,temporary_password,created};
}


async function changeLoginEmail(admin,organization,ctx,email,issuedBy){
  email=String(email||'').trim().toLowerCase();
  if(!EMAIL_RX.test(email)){const e=new Error('Enter a valid portal login email.');e.statusCode=400;throw e;}
  const existing=await findAuthUserByEmail(admin,email);
  let user=ctx.user,link=ctx.link,temporary_password=null,relinked=false;

  if(existing && (!user || existing.id!==user.id)){
    if(user && String(existing.id)!==String(user.id)){
      // Relink this Model to the already-existing Auth identity for the requested email.
      if(link){
        const {data,error}=await admin.from('model_user_links').update({user_id:existing.id}).eq('organization_id',organization.id).eq('model_id',ctx.model.id).eq('id',link.id).select('id,user_id,model_id').single();
        if(error)throw error;link=data;
      }else{
        const {data,error}=await admin.from('model_user_links').insert({organization_id:organization.id,model_id:ctx.model.id,user_id:existing.id}).select('id,user_id,model_id').single();
        if(error)throw error;link=data;
      }
      user=existing;relinked=true;
    }else{
      user=existing;
    }
  }else if(user){
    const meta=safeMeta(user);
    const {data,error}=await admin.auth.admin.updateUserById(user.id,{email,email_confirm:true,app_metadata:{...meta,cavyre_login_email_changed_at:new Date().toISOString(),cavyre_login_email_changed_by:issuedBy,cavyre_model_id:ctx.model.id}});
    if(error)throw error;user=data?.user||user;
  }else{
    const created=await linkOrCreate(admin,organization,ctx,email,issuedBy);
    user=created.user;link=created.link;temporary_password=created.temporary_password;relinked=true;
  }

  return {user,link,temporary_password,relinked};
}

async function sendReset(admin,organization,ctx){
  const email=String(ctx.user?.email||'').trim().toLowerCase();
  if(!EMAIL_RX.test(email)){const e=new Error('The linked authentication account does not have a valid email.');e.statusCode=409;throw e;}
  const {data:link,error}=await admin.auth.admin.generateLink({type:'recovery',email});
  if(error)throw error;
  const hash=link?.properties?.hashed_token;
  if(!hash){const e=new Error('Supabase did not return a recovery token.');e.statusCode=502;throw e;}
  const resetUrl=`${MODEL_PORTAL_URL}?token_hash=${encodeURIComponent(hash)}&type=recovery`;
  const {data:settings}=await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email').eq('organization_id',organization.id).maybeSingle();
  const fromEmail=String(settings?.sender_email||process.env.VEUX_DEFAULT_SENDER_EMAIL||'').trim().toLowerCase();
  if(!EMAIL_RX.test(fromEmail)){const e=new Error('Agency sender email is not configured.');e.statusCode=503;throw e;}
  const senderName=settings?.sender_name||organization.name||'Maison de Veux';
  const delivery=await sendResendEmail({from_name:senderName,from_email:fromEmail,reply_to:EMAIL_RX.test(String(settings?.reply_to_email||'').trim())?String(settings.reply_to_email).trim():undefined,to_emails:[email],cc_emails:[],bcc_emails:[],subject:'Reset your Model Portal password',html_body:`<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:auto;padding:36px;color:#17130f"><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7b6a8e;margin-bottom:18px">CAVYRE · MODEL PORTAL</div><h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 18px">Create a new password</h1><p style="font-size:15px;line-height:1.7">Your agency has issued a secure Model Portal password reset. Use the button below to create your new password.</p><p style="margin:28px 0"><a href="${resetUrl}" style="display:inline-block;background:#17130f;color:#fff;text-decoration:none;padding:14px 20px;letter-spacing:.08em">CREATE NEW PASSWORD</a></p><p style="font-size:12px;line-height:1.6;color:#777">If you were not expecting this, contact your agency.</p></div>`,text_body:`Create a new Model Portal password:\n\n${resetUrl}`,idempotency_key:`model-recovery:${ctx.user.id}:${Date.now()}`});
  try{await admin.from('email_messages').insert({organization_id:organization.id,template_key:'model_password_recovery',status:'sent',provider:delivery.provider||'resend',provider_message_id:delivery.providerMessageId||null,from_name:senderName,from_email:fromEmail,reply_to:EMAIL_RX.test(String(settings?.reply_to_email||'').trim())?String(settings.reply_to_email).trim():null,to_emails:[email],cc_emails:[],bcc_emails:[],subject:'Reset your Model Portal password',html_body:'[secure recovery link delivered and redacted]',text_body:null,source_type:'model_password_recovery',sent_at:new Date().toISOString(),metadata:{model_id:ctx.model.id,user_id:ctx.user.id,secure_link_redacted:true}});}catch(_e){}
  return {sent:true,email,provider:delivery.provider||'resend'};
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'},{Allow:'GET, POST'});
  try{
    const {user,client}=await requireUser(event);
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const modelId=String(body.model_id||event.queryStringParameters?.model_id||'').trim();
    if(!modelId)return json(400,{error:'model_id is required'});
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=await requirePermission(user.id,organization.id,event.httpMethod==='POST'?'models.write':'models.read');
    let ctx=await linked(admin,organization.id,modelId);
    if(event.httpMethod==='GET')return json(200,{ok:true,access:view(ctx)});
    const action=String(body.action||'').trim();
    if(action==='link_or_create_account'){
      const linkedOut=await linkOrCreate(admin,organization,ctx,body.email,user.id);
      ctx={...ctx,link:linkedOut.link,user:linkedOut.user};
      return json(200,{ok:true,verified:true,created:linkedOut.created,temporary_password:linkedOut.temporary_password,display_once:!!linkedOut.temporary_password,access:view(ctx),persisted_at:new Date().toISOString()});
    }
    if(action==='change_login_email'){
      const changed=await changeLoginEmail(admin,organization,ctx,body.email,user.id);
      ctx={...ctx,link:changed.link,user:changed.user};
      return json(200,{ok:true,verified:true,relinked:changed.relinked,temporary_password:changed.temporary_password,display_once:!!changed.temporary_password,access:view(ctx),persisted_at:new Date().toISOString()});
    }
    if(!ctx.link||!ctx.user){const e=new Error('This model does not have a linked authentication account. Use Repair / Create Login first.');e.statusCode=409;throw e;}
    const meta=safeMeta(ctx.user);
    if(action==='generate_temporary_password'){
      const password=tempPassword(),expires=new Date(Date.now()+24*60*60*1000).toISOString();
      const {data,error}=await admin.auth.admin.updateUserById(ctx.user.id,{password,ban_duration:'none',app_metadata:{...meta,[RESET_FLAG]:true,[TEMP_EXP]:expires,[DISABLED]:false,cavyre_password_reset_issued_at:new Date().toISOString(),cavyre_password_reset_issued_by:user.id}});
      if(error)throw error;ctx={...ctx,user:data.user};
      return json(200,{ok:true,verified:true,temporary_password:password,display_once:true,expires_at:expires,password_change_required:true,activation_url:'https://maisondeveux.com/portal/activate',access:view(ctx)});
    }
    if(action==='send_reset_email'){
      const out=await sendReset(admin,organization,ctx);return json(200,{ok:true,verified:true,...out,access:view(ctx)});
    }
    if(action==='disable_portal_access'){
      const {data,error}=await admin.auth.admin.updateUserById(ctx.user.id,{ban_duration:'876000h',app_metadata:{...meta,[DISABLED]:true,cavyre_portal_disabled_at:new Date().toISOString(),cavyre_portal_disabled_by:user.id}});if(error)throw error;ctx={...ctx,user:data.user};
      return json(200,{ok:true,verified:true,access:view(ctx)});
    }
    if(action==='enable_portal_access'){
      const {data,error}=await admin.auth.admin.updateUserById(ctx.user.id,{ban_duration:'none',app_metadata:{...meta,[DISABLED]:false,cavyre_portal_enabled_at:new Date().toISOString(),cavyre_portal_enabled_by:user.id}});if(error)throw error;ctx={...ctx,user:data.user};
      return json(200,{ok:true,verified:true,access:view(ctx)});
    }
    return json(400,{error:'Unsupported model access action.'});
  }catch(e){return errorResponse(e);}
};
