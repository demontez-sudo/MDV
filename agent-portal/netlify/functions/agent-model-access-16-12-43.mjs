import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { sendResendEmail, emailDeliveryStatus } from './_lib/email.mjs';
import { issueCompactRecoveryToken } from './_lib/model-recovery-token.mjs';
import { verifyModelPassword } from './_lib/model-auth-verifier.mjs';

const MODEL_PORTAL_URL='https://maisondeveux.com/portal/reset';
const JOIN_URL='https://maisondeveux.com/portal/join';
const EMAIL_RX=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_FLAG='cavyre_password_reset_required';
const TEMP_EXP='cavyre_temp_password_expires_at';
const DISABLED='cavyre_portal_disabled';
const INVITE_AT='cavyre_invited_at',INVITE_N='cavyre_invite_count',INVITE_BY='cavyre_invited_by',INVITE_CH='cavyre_invite_channel';
const PORTAL_URL='https://maisondeveux.com/portal';
const INVITE_TTL_MS=7*24*60*60*1000;
const BULK_MAX=3;
const NOT_ON_ROSTER=/^(archiv|releas|inactive|former)/i;

function tempPassword(){
  return `Cv!${crypto.randomBytes(12).toString('base64url')}9a`;
}
function safeMeta(user){return user?.app_metadata&&typeof user.app_metadata==='object'?user.app_metadata:{};}
/* Where a model is on the way to being signed in:
   not_linked (no login yet) -> ready (login exists, no invite sent) -> invited -> signed_in (the model has set their own password) | disabled.
   A sign-in made by the system to check a temporary password is not the model signing in, so it does not count. */
function stageOf(ctx){
  if(!ctx.link||!ctx.user)return 'not_linked';
  const m=safeMeta(ctx.user);
  if(m[DISABLED]||ctx.user.banned_until)return 'disabled';
  if(m.cavyre_password_changed_via==='model_self_service'||(ctx.user.last_sign_in_at&&!m[RESET_FLAG]))return 'signed_in';
  return m[INVITE_AT]?'invited':'ready';
}
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
  return {model_id:ctx.model.id,model_name:ctx.model.display_name||'Model',linked:!!ctx.link,auth_user_id:u?.id||null,email:u?.email||null,suggested_email:ctx.model.suggested_email||null,status:disabled?'DISABLED':(ctx.link?'ACTIVE':'NOT LINKED'),authentication:ctx.link?'Email + Password':'Not linked',last_login:u?.last_sign_in_at||null,password_status:disabled?'ACCESS DISABLED':reset?'TEMPORARY PASSWORD / RESET REQUIRED':'ACTIVE',reset_required:reset,temp_password_expires_at:expires,portal_disabled:disabled,stage:stageOf(ctx),invited_at:m[INVITE_AT]||null,invite_count:Number(m[INVITE_N])||0,invite_channel:m[INVITE_CH]||null,password_set_by_model:m.cavyre_password_changed_via==='model_self_service'};
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
    const {data,error}=await admin.auth.admin.createUser({email,password:temporary_password,email_confirm:true,app_metadata:{role:'model',organization_id:organization.id,[RESET_FLAG]:true,[TEMP_EXP]:new Date(Date.now()+7*24*60*60*1000).toISOString(),[DISABLED]:false,cavyre_model_id:ctx.model.id,cavyre_account_created_by:issuedBy}});
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
  const recoveryToken=issueCompactRecoveryToken({userId:ctx.user.id,modelId:ctx.model.id,email});
  const resetUrl=`${MODEL_PORTAL_URL}?c=${recoveryToken}`;
  const {data:settings}=await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email').eq('organization_id',organization.id).maybeSingle();
  const fromEmail=String(settings?.sender_email||process.env.VEUX_DEFAULT_SENDER_EMAIL||'').trim().toLowerCase();
  if(!EMAIL_RX.test(fromEmail)){const e=new Error('Agency sender email is not configured.');e.statusCode=503;throw e;}
  const senderName=settings?.sender_name||organization.name||'Maison de Veux';
  const delivery=await sendResendEmail({from_name:senderName,from_email:fromEmail,reply_to:EMAIL_RX.test(String(settings?.reply_to_email||'').trim())?String(settings.reply_to_email).trim():undefined,to_emails:[email],cc_emails:[],bcc_emails:[],subject:'Reset your Model Portal password',html_body:`<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:auto;padding:36px;color:#17130f"><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7b6a8e;margin-bottom:18px">CAVYRE · MODEL PORTAL</div><h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 18px">Create a new password</h1><p style="font-size:15px;line-height:1.7">Your agency has issued a secure Model Portal password reset. Use the button below to create your new password.</p><p style="margin:28px 0"><a href="${resetUrl}" style="display:inline-block;background:#17130f;color:#fff;text-decoration:none;padding:14px 20px;letter-spacing:.08em">CREATE NEW PASSWORD</a></p><p style="font-size:12px;line-height:1.6;color:#777">If you were not expecting this, contact your agency.</p></div>`,text_body:`Create a new Model Portal password:\n\n${resetUrl}`,idempotency_key:`model-recovery:${ctx.user.id}:${Date.now()}`});
  try{await admin.from('email_messages').insert({organization_id:organization.id,template_key:'model_password_recovery',status:'sent',provider:delivery.provider||'resend',provider_message_id:delivery.providerMessageId||null,from_name:senderName,from_email:fromEmail,reply_to:EMAIL_RX.test(String(settings?.reply_to_email||'').trim())?String(settings.reply_to_email).trim():null,to_emails:[email],cc_emails:[],bcc_emails:[],subject:'Reset your Model Portal password',html_body:'[secure recovery link delivered and redacted]',text_body:null,source_type:'model_password_recovery',sent_at:new Date().toISOString(),metadata:{model_id:ctx.model.id,user_id:ctx.user.id,secure_link_redacted:true}});}catch(_e){}
  return {sent:true,email,provider:delivery.provider||'resend'};
}


function firstName(n){return String(n||'').trim().split(/\s+/)[0]||'there';}
function inviteText({name,email,url,agency}){
  return `Hi ${firstName(name)}, welcome to the ${agency} Model Portal: your schedule, bookings, castings, travel and documents in one place.\n\nTap this link to set up your account (one minute):\n\n${url}\n\nYour login email: ${email}\nThe link is just for you and works for 7 days. After you choose a password you are signed in, and you can come back any time at ${PORTAL_URL}\n\nTip: open the portal on your phone, tap Share, then Add to Home Screen, and it sits next to your other apps.\n\nIf anything does not work, reply to this message and we will sort it out right away.\n${agency}`;
}
function inviteHtml({name,email,url,agency}){
  const step=(n,t)=>`<tr><td style="width:34px;vertical-align:top"><div style="width:24px;height:24px;border:1px solid #17130f;border-radius:50%;text-align:center;line-height:24px;font-size:12px">${n}</div></td><td style="font-size:15px;line-height:1.6;padding-bottom:14px">${t}</td></tr>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:auto;padding:36px;color:#17130f"><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7b6a8e;margin-bottom:18px">${agency} · MODEL PORTAL</div><h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 18px">Welcome, ${firstName(name)}.</h1><p style="font-size:15px;line-height:1.7">Your Model Portal is ready: your schedule, bookings, castings, travel and documents in one place. It takes a minute to set up.</p><table role="presentation" style="margin:22px 0 8px;border-collapse:collapse">${step(1,'Tap the button below and choose a password (at least 10 characters).')}${step(2,'You are signed in straight away.')}${step(3,`Next time, sign in at <a href="${PORTAL_URL}" style="color:#17130f">${PORTAL_URL.replace('https://','')}</a> with <b>${email}</b> and your password.`)}</table><p style="margin:26px 0 10px"><a href="${url}" style="display:inline-block;background:#17130f;color:#fff;text-decoration:none;padding:14px 22px;letter-spacing:.08em">SET UP MY ACCOUNT</a></p><p style="font-size:12px;line-height:1.6;color:#555;margin:0 0 6px">Button not working? Tap or copy this link:</p><p style="font-size:12px;line-height:1.6;margin:0 0 20px;word-break:break-all"><a href="${url}" style="color:#17130f;text-decoration:underline">${url}</a></p><p style="font-size:13px;line-height:1.7;color:#555">Your login email is <b>${email}</b>. This link is just for you and works for 7 days.<br>On your phone: open the portal, tap Share, then Add to Home Screen, and it sits next to your other apps.</p><p style="font-size:12px;line-height:1.6;color:#777;margin-top:26px">Something not working? Reply to this email and we will sort it out right away.</p></div>`;
}
async function senderFor(admin,organization){
  const {data:settings}=await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email').eq('organization_id',organization.id).maybeSingle();
  const fromEmail=String(settings?.sender_email||process.env.VEUX_DEFAULT_SENDER_EMAIL||'').trim().toLowerCase();
  if(!EMAIL_RX.test(fromEmail)){const e=new Error('Agency sender email is not configured.');e.statusCode=503;throw e;}
  const reply=String(settings?.reply_to_email||'').trim();
  return {fromEmail,senderName:settings?.sender_name||organization.name||'Maison de Veux',replyTo:EMAIL_RX.test(reply)?reply:undefined};
}
/* Make sure the model has a login, then issue a personal set-up link. channel "email" sends it; channel "link" only returns the link and a ready-to-paste message (WhatsApp, text, DM). */
async function sendInvite(admin,organization,ctx,{email,channel,issuedBy}){
  if(!ctx.link||!ctx.user){
    const made=await linkOrCreate(admin,organization,ctx,email,issuedBy);   /* the temporary password it creates is never shown or sent: the invite link replaces it */
    ctx={...ctx,link:made.link,user:made.user};
  }
  const meta0=safeMeta(ctx.user);
  if(meta0[DISABLED]||ctx.user.banned_until){const e=new Error('Portal access is switched off for this model. Switch it on first.');e.statusCode=409;throw e;}
  const loginEmail=String(ctx.user.email||'').trim().toLowerCase();
  if(!EMAIL_RX.test(loginEmail)){const e=new Error('This model does not have a valid login email.');e.statusCode=409;throw e;}
  const token=issueCompactRecoveryToken({userId:ctx.user.id,modelId:ctx.model.id,email:loginEmail,ttlMs:INVITE_TTL_MS});
  const url=`${JOIN_URL}?c=${token}`;   /* short on purpose: easy to tap, and it fits on one line in a text */
  const agency=organization.name||'Maison de Veux',name=ctx.model.display_name||'';
  const text=inviteText({name,email:loginEmail,url,agency}),expires_at=new Date(Date.now()+INVITE_TTL_MS).toISOString();
  let sent=false,provider=null;
  if(channel==='email'){
    const {fromEmail,senderName,replyTo}=await senderFor(admin,organization);
    const delivery=await sendResendEmail({from_name:senderName,from_email:fromEmail,reply_to:replyTo,to_emails:[loginEmail],cc_emails:[],bcc_emails:[],subject:`Welcome to your ${agency} Model Portal`,html_body:inviteHtml({name,email:loginEmail,url,agency}),text_body:text,idempotency_key:`model-invite:${ctx.user.id}:${Date.now()}`});
    sent=true;provider=delivery.provider||'resend';
    try{await admin.from('email_messages').insert({organization_id:organization.id,template_key:'model_portal_invite',status:'sent',provider,provider_message_id:delivery.providerMessageId||null,from_name:senderName,from_email:fromEmail,reply_to:replyTo||null,to_emails:[loginEmail],cc_emails:[],bcc_emails:[],subject:`Welcome to your ${agency} Model Portal`,html_body:'[secure set-up link delivered and redacted]',text_body:null,source_type:'model_portal_invite',sent_at:new Date().toISOString(),metadata:{model_id:ctx.model.id,user_id:ctx.user.id,secure_link_redacted:true}});}catch(_e){}
  }
  const {data,error}=await admin.auth.admin.updateUserById(ctx.user.id,{app_metadata:{...safeMeta(ctx.user),[INVITE_AT]:new Date().toISOString(),[INVITE_N]:(Number(meta0[INVITE_N])||0)+1,[INVITE_BY]:issuedBy,[INVITE_CH]:channel}});
  if(error)throw error;
  ctx={...ctx,user:data?.user||ctx.user};
  return {ctx,sent,provider,email:loginEmail,expires_at,...(channel==='link'?{invite_url:url,message_text:text}:{})};
}

/* Everyone on the roster and how far along they are: for the invites page. */
async function roster(admin,organization){
  const org=organization.id;
  const [m,p,l]=await Promise.all([
    admin.from('models').select('id,display_name,status,active').eq('organization_id',org).limit(2000),
    admin.from('model_private_profiles').select('*').eq('organization_id',org).limit(2000),
    admin.from('model_user_links').select('model_id,user_id').eq('organization_id',org).limit(2000)]);
  if(m.error)throw m.error;
  const priv=new Map((p.data||[]).map(x=>[x.model_id,x])),linkBy=new Map((l.data||[]).map(x=>[x.model_id,x.user_id]));
  const models=(m.data||[]).filter(x=>x.active!==false&&!NOT_ON_ROSTER.test(String(x.status||'')));
  const users=new Map();
  const ids=[...new Set(models.map(x=>linkBy.get(x.id)).filter(Boolean))];
  for(let i=0;i<ids.length;i+=8){
    await Promise.all(ids.slice(i,i+8).map(async id=>{try{const {data}=await admin.auth.admin.getUserById(id);if(data?.user)users.set(id,data.user);}catch(_e){}}));
  }
  return models.map(x=>{
    const user=users.get(linkBy.get(x.id))||null,pv=priv.get(x.id)||{};
    const ctx={model:x,link:linkBy.get(x.id)?{user_id:linkBy.get(x.id)}:null,user},meta=safeMeta(user);
    return {model_id:x.id,name:x.display_name||'Model',status:x.status||'',contact_email:pv.email||null,phone:pv.whatsapp||pv.phone||null,login_email:user?.email||null,stage:stageOf(ctx),invited_at:meta[INVITE_AT]||null,invite_count:Number(meta[INVITE_N])||0,last_login:user?.last_sign_in_at||null,password_set_by_model:meta.cavyre_password_changed_via==='model_self_service'};
  }).sort((a,b)=>a.name.localeCompare(b.name));
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'},{Allow:'GET, POST'});
  try{
    const {user,client}=await requireUser(event);
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const modelId=String(body.model_id||event.queryStringParameters?.model_id||'').trim();
    if(!modelId){
      const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
      if(event.httpMethod==='GET'&&event.queryStringParameters?.email_check==='1'){
        const admin=await requirePermission(user.id,organization.id,'models.read');
        const st=emailDeliveryStatus();
        const {data:settings}=await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email').eq('organization_id',organization.id).maybeSingle();
        const sender=String(settings?.sender_email||process.env.VEUX_DEFAULT_SENDER_EMAIL||'').trim().toLowerCase();
        const {data:recent}=await admin.from('email_messages').select('*').eq('organization_id',organization.id).in('template_key',['model_portal_invite','model_password_recovery']).order('created_at',{ascending:false}).limit(15);
        const problems=[];
        if(!st.configured)problems.push('Email is not switched on: the RESEND_API_KEY setting is missing on this deployment.');
        if(!EMAIL_RX.test(sender))problems.push('No sender address is set. Add one in Settings, or set VEUX_DEFAULT_SENDER_EMAIL.');
        return json(200,{ok:true,email:{resend_configured:!!st.configured,sender_email:sender||null,sender_name:settings?.sender_name||organization.name||null,reply_to:settings?.reply_to_email||null,problems},recent:(recent||[]).map(x=>({at:x.sent_at||x.created_at,status:x.status,kind:x.template_key==='model_portal_invite'?'Invite':'Reset',to:(x.to_emails||[])[0]||'',id:x.provider_message_id||''})),your_email:user.email||null});
      }
      if(event.httpMethod==='POST'&&String(body.action||'')==='send_test_email'){
        const admin=await requirePermission(user.id,organization.id,'models.write');
        const to=String(user.email||'').trim().toLowerCase();
        if(!EMAIL_RX.test(to))return json(409,{error:'Your own account has no email address to send a test to.'});
        try{
          const {fromEmail,senderName,replyTo}=await senderFor(admin,organization);
          const d=await sendResendEmail({from_name:senderName,from_email:fromEmail,reply_to:replyTo,to_emails:[to],cc_emails:[],bcc_emails:[],subject:'Model Portal email test',html_body:'<p style="font-family:Arial,sans-serif">This is a test from the Model Portal. If you can read this, invites and password emails can be sent.</p>',text_body:'This is a test from the Model Portal. If you can read this, invites and password emails can be sent.',idempotency_key:`model-test:${user.id}:${Date.now()}`});
          return json(200,{ok:true,verified:true,sent_to:to,from:fromEmail,id:d.providerMessageId||null});
        }catch(e){return json(502,{ok:false,error:String(e.message||e).slice(0,300)});}   /* the provider's own words, e.g. "domain is not verified" */
      }
      if(event.httpMethod==='GET'&&event.queryStringParameters?.list==='1'){
        const admin=await requirePermission(user.id,organization.id,'models.read');
        return json(200,{ok:true,models:await roster(admin,organization)});
      }
      if(event.httpMethod==='POST'&&String(body.action||'')==='bulk_invite'){
        const admin=await requirePermission(user.id,organization.id,'models.write');
        const ids=[...new Set((Array.isArray(body.model_ids)?body.model_ids:[]).map(String))].slice(0,BULK_MAX);   /* a few per call keeps each call short; the page sends them in batches */
        const out=[],t0=Date.now();
        for(const id of ids){
          if(Date.now()-t0>7000){out.push({model_id:id,ok:false,deferred:true,reason:'Run out of time on this batch. Send again.'});continue;}   /* the function has about 10 seconds */
          if(out.some(x=>x.ok))await new Promise(r=>setTimeout(r,650));   /* the email provider accepts about two a second */
          try{
            const c=await linked(admin,organization.id,id),stage=stageOf(c);
            if(stage==='disabled'){out.push({model_id:id,name:c.model.display_name,ok:false,skipped:true,reason:'Portal access is switched off'});continue;}
            if(stage==='signed_in'&&!body.include_signed_in){out.push({model_id:id,name:c.model.display_name,ok:false,skipped:true,reason:'Already signed in'});continue;}
            if(!c.user&&!EMAIL_RX.test(String(c.model.suggested_email||''))){out.push({model_id:id,name:c.model.display_name,ok:false,skipped:true,reason:'No email on the profile'});continue;}
            const r=await sendInvite(admin,organization,c,{email:null,channel:'email',issuedBy:user.id});
            out.push({model_id:id,name:c.model.display_name,ok:true,sent_to:r.email});
          }catch(e){out.push({model_id:id,ok:false,reason:String(e.publicMessage||e.message||e).slice(0,200)});}
        }
        return json(200,{ok:true,verified:true,results:out,sent:out.filter(x=>x.ok).length});
      }
      return json(400,{error:'model_id is required'});
    }
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
    if(action==='send_invite'){
      const ch=body.channel==='link'?'link':'email';
      const r=await sendInvite(admin,organization,ctx,{email:body.email,channel:ch,issuedBy:user.id});
      const {ctx:next,...rest}=r;
      return json(200,{ok:true,verified:true,...rest,access:view(next),persisted_at:new Date().toISOString()});
    }
    if(action==='change_login_email'){
      const changed=await changeLoginEmail(admin,organization,ctx,body.email,user.id);
      ctx={...ctx,link:changed.link,user:changed.user};
      return json(200,{ok:true,verified:true,relinked:changed.relinked,temporary_password:changed.temporary_password,display_once:!!changed.temporary_password,access:view(ctx),persisted_at:new Date().toISOString()});
    }
    if(!ctx.link||!ctx.user){const e=new Error('This model does not have a linked authentication account. Use Repair / Create Login first.');e.statusCode=409;throw e;}
    const meta=safeMeta(ctx.user);
    if(action==='generate_temporary_password'){
      const password=tempPassword(),expires=new Date(Date.now()+7*24*60*60*1000).toISOString();
      const {data,error}=await admin.auth.admin.updateUserById(ctx.user.id,{password,email_confirm:true,ban_duration:'none',app_metadata:{...meta,[RESET_FLAG]:true,[TEMP_EXP]:expires,[DISABLED]:false,cavyre_password_reset_issued_at:new Date().toISOString(),cavyre_password_reset_issued_by:user.id,cavyre_temporary_login_ready:true}});
      if(error)throw error;ctx={...ctx,user:data.user};

      // VERIFY the exact credential against the same Supabase Auth project before showing it.
      const loginCheck=await verifyModelPassword({email:data.user.email,password});
      if(loginCheck.user_id!==data.user.id){
        const e=new Error('Credential verification resolved to the wrong authentication user.');
        e.statusCode=409;throw e;
      }

      return json(200,{
        ok:true,
        verified:true,
        credential_verified:true,
        auth_project:loginCheck.project,
        temporary_password:password,
        display_once:true,
        expires_at:expires,
        access:view(ctx)
      });
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
