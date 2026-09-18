import { adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { verifyModelRecoveryToken } from './_lib/model-recovery-token.mjs';
import { verifyModelPassword } from './_lib/model-auth-verifier.mjs';

const ORG_SLUG='maison-de-veux';

export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'},{Allow:'POST'});
  try{
    const body=parseBody(event);
    const recoveryToken=String(body.recovery_token||body.token_hash||'').trim();
    const password=typeof body.password==='string'?body.password:'';
    if(!recoveryToken)return json(400,{error:'The recovery link is missing or invalid.'});
    if(password.length<10)return json(400,{error:'Use at least 10 characters.'});
    if(Buffer.byteLength(password,'utf8')>72)return json(400,{error:'Password is too long. Use 72 bytes or fewer.'});

    const admin=adminClient();

    let claim;
    try{claim=verifyModelRecoveryToken(recoveryToken);}
    catch(_e){const e=new Error('This recovery link is invalid or has expired. Request a new password link.');e.statusCode=400;throw e;}

    const {data:org,error:orgError}=await admin.from('organizations')
      .select('id,name,status').eq('slug',ORG_SLUG).eq('status','active').maybeSingle();
    if(orgError)throw orgError;
    if(!org?.id)return json(503,{error:'Maison de Veux is temporarily unavailable.'});

    if(String(claim.oid)!==String(org.id)){return json(403,{error:'This recovery link is not valid for this agency.'});}
    const {data:modelLink,error:linkError}=await admin.from('model_user_links')
      .select('id,model_id,user_id').eq('organization_id',org.id).eq('user_id',claim.uid).eq('model_id',claim.mid).maybeSingle();
    if(linkError)throw linkError;
    if(!modelLink?.id)return json(403,{error:'This account does not have Model Portal access.'});
    const {data:authData,error:authError}=await admin.auth.admin.getUserById(claim.uid);
    if(authError||!authData?.user?.id)return json(403,{error:'The Model Portal authentication account is unavailable.'});
    const user=authData.user;
    if(claim.email&&String(user.email||'').toLowerCase()!==String(claim.email).toLowerCase())return json(403,{error:'The login email changed after this reset was issued. Request a new link.'});

    const {data:model,error:modelError}=await admin.from('models')
      .select('id,display_name,status,active').eq('organization_id',org.id).eq('id',modelLink.model_id).maybeSingle();
    if(modelError)throw modelError;
    if(!model?.id||model.active===false||String(model.status||'').toLowerCase()==='archived'){
      return json(403,{error:'This Model Portal account is not active.'});
    }

    const currentMeta=user.app_metadata&&typeof user.app_metadata==='object'?user.app_metadata:{};
    const nextMeta={...currentMeta,
      cavyre_password_reset_required:false,
      cavyre_temp_password_expires_at:null,
      cavyre_password_changed_at:new Date().toISOString(),
      cavyre_password_changed_via:'model_self_service'
    };

    const {data:updated,error:updateError}=await admin.auth.admin.updateUserById(user.id,{
      password,
      email_confirm:true,
      ban_duration:'none',
      app_metadata:{...nextMeta,cavyre_portal_disabled:false,cavyre_temporary_login_ready:false}
    });
    if(updateError)throw updateError;
    if(!updated?.user?.id||updated.user.id!==user.id)return json(500,{error:'Password update could not be verified.'});

    // Do not tell the model reset succeeded until the exact new credential signs in.
    const loginCheck=await verifyModelPassword({email:updated.user.email||user.email,password});
    if(loginCheck.user_id!==user.id){
      return json(409,{error:'Password changed, but login verification returned a different user. Please request a new reset link.'});
    }

    return json(200,{
      ok:true,
      verified:true,
      password_saved:true,
      credential_verified:true,
      auth_project:loginCheck.project,
      session:loginCheck.session||null,
      model_id:model.id,
      model_name:model.display_name||null,
      email:user.email||updated.user.email||null,
      redirect_to:'https://maisondeveux.com/portal'
    });
  }catch(error){
    return errorResponse(error);
  }
}
