import { requireUser, adminClient, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';
import { verifyModelPassword } from './_lib/model-auth-verifier.mjs';

function cleanPassword(v){return String(v||'');}

export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);
    const body=parseBody(event);
    const password=cleanPassword(body.password);
    if(password.length<10)return json(400,{error:'Use at least 10 characters.'});

    const portal=await requireModelPortal({user,organizationSlug:body.organization_slug||'maison-de-veux'});
    const admin=adminClient();

    const {data:updated,error}=await admin.auth.admin.updateUserById(user.id,{
      password,
      email_confirm:true,
      ban_duration:'none',
      app_metadata:{
        ...(user.app_metadata||{}),
        cavyre_password_reset_required:false,
        cavyre_portal_disabled:false,
        cavyre_temporary_login_ready:false,
        cavyre_password_changed_at:new Date().toISOString()
      }
    });
    if(error)throw error;
    if(!updated?.user?.id||updated.user.id!==user.id){
      const e=new Error('Password update could not be verified.');e.statusCode=500;throw e;
    }

    const check=await verifyModelPassword({email:updated.user.email||user.email,password});
    if(check.user_id!==user.id){
      const e=new Error('Login verification returned a different user.');e.statusCode=409;throw e;
    }

    return json(200,{
      ok:true,
      credential_verified:true,
      model_id:portal.modelId,
      session:check.session||null,
      redirect_to:'https://maisondeveux.com/portal'
    });
  }catch(e){return errorResponse(e)}
}
