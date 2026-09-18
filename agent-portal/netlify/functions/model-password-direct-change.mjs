import { adminClient, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';
import { verifyModelPassword } from './_lib/model-auth-verifier.mjs';
const clean=v=>String(v||'');
export async function handler(event){
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 try{
  const body=parseBody(event),email=clean(body.email).trim().toLowerCase(),currentPassword=clean(body.current_password),newPassword=clean(body.new_password);
  if(!email)return json(400,{error:'Enter your Model Portal email.'});
  if(!currentPassword)return json(400,{error:'Enter your temporary or current password.'});
  if(newPassword.length<10)return json(400,{error:'Use at least 10 characters for your new password.'});
  if(newPassword===currentPassword)return json(400,{error:'Your new password must be different from your temporary/current password.'});
  const current=await verifyModelPassword({email,password:currentPassword});
  const user=current?.session?.user;
  if(!user?.id){const e=new Error('Current login could not be verified.');e.statusCode=401;throw e;}
  const portal=await requireModelPortal({user,organizationSlug:body.organization_slug||'maison-de-veux'});
  const admin=adminClient();
  const {data:updated,error}=await admin.auth.admin.updateUserById(user.id,{password:newPassword,email_confirm:true,ban_duration:'none',
   app_metadata:{...(user.app_metadata||{}),cavyre_password_reset_required:false,cavyre_portal_disabled:false,cavyre_temporary_login_ready:false,cavyre_password_changed_at:new Date().toISOString()}});
  if(error)throw error;
  if(!updated?.user?.id||updated.user.id!==user.id){const e=new Error('Password update could not be verified.');e.statusCode=500;throw e;}
  const check=await verifyModelPassword({email:updated.user.email||email,password:newPassword});
  if(check.user_id!==user.id){const e=new Error('New login verification returned a different user.');e.statusCode=409;throw e;}
  return json(200,{ok:true,credential_verified:true,model_id:portal.modelId,session:check.session||null,redirect_to:'https://maisondeveux.com/portal'});
 }catch(e){return errorResponse(e)}
}