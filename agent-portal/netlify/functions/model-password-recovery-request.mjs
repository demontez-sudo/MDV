import { adminClient, parseBody, json } from './_lib/auth.mjs';
import { sendResendEmail } from './_lib/email.mjs';
import { issueModelRecoveryToken } from './_lib/model-recovery-token.mjs';

const ORG_SLUG='maison-de-veux';
const RECOVERY_PAGE='https://maisondeveux.com/portal/reset';
const EMAIL_RX=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function generic(){return json(200,{ok:true,message:'If this email has Model Portal access, a secure password link is on the way.'});}

export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'},{Allow:'POST'});
  let email='';
  try{
    const body=parseBody(event);
    email=String(body.email||'').trim().toLowerCase();
    if(!EMAIL_RX.test(email))return generic();

    const admin=adminClient();
    const {data:org,error:orgError}=await admin.from('organizations')
      .select('id,name,status').eq('slug',ORG_SLUG).eq('status','active').maybeSingle();
    if(orgError||!org?.id)return generic();

    // Resolve the authentication identity, then issue a CAVYRE first-party recovery token.
    let authUser=null;
    for(let page=1;page<=20&&!authUser;page++){
      const {data:list,error:listError}=await admin.auth.admin.listUsers({page,perPage:100});
      if(listError)return generic();
      authUser=(list?.users||[]).find(u=>String(u.email||'').trim().toLowerCase()===email)||null;
      if((list?.users||[]).length<100)break;
    }
    if(!authUser?.id)return generic();

    // Only actual linked models are eligible.
    const {data:modelLink,error:modelLinkError}=await admin.from('model_user_links')
      .select('id,model_id,user_id').eq('organization_id',org.id).eq('user_id',authUser.id).maybeSingle();
    if(modelLinkError||!modelLink?.id)return generic();

    const {data:model}=await admin.from('models')
      .select('id,display_name,active,status').eq('organization_id',org.id).eq('id',modelLink.model_id).maybeSingle();
    if(!model?.id||model.active===false||String(model.status||'').toLowerCase()==='archived')return generic();

    // One request per minute per email.
    const since=new Date(Date.now()-60_000).toISOString();
    const {data:recent}=await admin.from('email_messages').select('id')
      .eq('organization_id',org.id).eq('source_type','model_password_recovery_self_service')
      .contains('to_emails',[email]).gte('created_at',since).limit(1);
    if(recent?.length)return generic();

    const {data:settings}=await admin.from('organization_settings')
      .select('sender_name,sender_email,reply_to_email').eq('organization_id',org.id).maybeSingle();

    const fromEmail=String(settings?.sender_email||process.env.VEUX_DEFAULT_SENDER_EMAIL||'').trim().toLowerCase();
    if(!EMAIL_RX.test(fromEmail)){
      console.error('[MODEL recovery] sender email is not configured');
      return generic();
    }

    const recoveryToken=issueModelRecoveryToken({userId:authUser.id,modelId:model.id,organizationId:org.id,email});
    const resetUrl=`${RECOVERY_PAGE}?recovery_token=${encodeURIComponent(recoveryToken)}`;
    const senderName=settings?.sender_name||org.name||'Maison de Veux';
    const modelName=model.display_name||'Model';

    const html=`<div style="background:#f5f0e7;padding:36px 18px;font-family:Arial,Helvetica,sans-serif;color:#171512">
      <div style="max-width:620px;margin:auto;border:1px solid #d8cdbd;background:#f8f4ec">
        <div style="padding:28px 32px;border-bottom:1px solid #d8cdbd;text-align:center">
          <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#8a765c">NEW YORK / PARIS</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;margin-top:8px">Maison de Veux</div>
          <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#756c61;margin-top:8px">MODEL PORTAL · SECURE ACCESS</div>
        </div>
        <div style="padding:34px 34px 38px">
          <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#a57a42">Password Recovery</div>
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;margin:10px 0 18px">Create a new password</h1>
          <p style="font-size:15px;line-height:1.65;color:#5d554c">Hi ${esc(modelName)}, use the secure button below to create a new Maison de Veux Model Portal password.</p>
          <p style="margin:28px 0"><a href="${esc(resetUrl)}" style="display:inline-block;background:#171512;color:#f8f4ec;text-decoration:none;padding:15px 20px;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase">CREATE NEW PASSWORD →</a></p>
          <p style="font-size:12px;line-height:1.6;color:#7c7369">This is a secure, single-use recovery link. If you did not request it, you can ignore this email or contact your agency.</p>
        </div>
      </div>
    </div>`;

    const delivery=await sendResendEmail({
      from_name:senderName,
      from_email:fromEmail,
      reply_to:EMAIL_RX.test(String(settings?.reply_to_email||'').trim())?String(settings.reply_to_email).trim():undefined,
      to_emails:[email],cc_emails:[],bcc_emails:[],
      subject:'Reset your Maison de Veux Model Portal password',
      html_body:html,
      text_body:`Create a new Maison de Veux Model Portal password:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      idempotency_key:`model-self-recovery:${authUser.id}:${Date.now()}`
    });

    try{
      await admin.from('email_messages').insert({
        organization_id:org.id,
        template_key:'model_password_recovery',
        status:'sent',
        provider:delivery.provider||'resend',
        provider_message_id:delivery.providerMessageId||null,
        from_name:senderName,from_email:fromEmail,
        reply_to:EMAIL_RX.test(String(settings?.reply_to_email||'').trim())?String(settings.reply_to_email).trim():null,
        to_emails:[email],cc_emails:[],bcc_emails:[],
        subject:'Reset your Maison de Veux Model Portal password',
        html_body:'[secure recovery link delivered and redacted]',
        text_body:null,
        source_type:'model_password_recovery_self_service',
        sent_at:new Date().toISOString(),
        metadata:{model_id:model.id,user_id:authUser.id,secure_link_redacted:true,recovery_page:'/model-reset.html',recovery_authority:'cavyre_signed_v1'}
      });
    }catch(_e){}

    return generic();
  }catch(error){
    console.error('[MODEL recovery] request failed',{email,error:String(error?.message||error)});
    return generic();
  }
}
