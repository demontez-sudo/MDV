import { json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

export async function handler(event){
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {admin,user,organization}=await requireStaffOrganization(event);
    await requirePermission({admin,user,organization,permission:'models:read'});
    const qs=event.queryStringParameters||{};
    const modelId=String(qs.model_id||'').trim();
    if(!modelId) return json(400,{error:'model_id is required.'});

    const {data:model,error:modelError}=await admin
      .from('models')
      .select('id,first_name,last_name,status,email')
      .eq('organization_id',organization.id)
      .eq('id',modelId)
      .maybeSingle();
    if(modelError) throw modelError;
    if(!model) return json(404,{error:'Model not found.'});

    const {data:link,error:linkError}=await admin
      .from('model_user_links')
      .select('model_id,user_id,organization_id')
      .eq('organization_id',organization.id)
      .eq('model_id',modelId)
      .maybeSingle();
    if(linkError) throw linkError;

    let auth=null;
    if(link?.user_id){
      const r=await admin.auth.admin.getUserById(link.user_id);
      if(r.error) throw r.error;
      const u=r.data?.user;
      if(u){
        const m=u.app_metadata||{};
        auth={
          user_id:u.id,
          email:u.email||null,
          email_confirmed:Boolean(u.email_confirmed_at),
          portal_disabled:Boolean(m.cavyre_model_portal_disabled),
          password_change_required:Boolean(
            m.cavyre_password_reset_required===true ||
            m.cavyre_temporary_login_ready===true
          ),
          temporary_password_expires_at:m.cavyre_temporary_password_expires_at||null
        };
      }
    }

    return json(200,{
      ok:true,
      verified:true,
      canonical_auth_url:'https://www.maisondeveux.com/portal',
      canonical_portal_url:'https://www.maisondeveux.com/portal',
      model:{
        id:model.id,
        name:[model.first_name,model.last_name].filter(Boolean).join(' ')||null,
        status:model.status||null
      },
      model_link_verified:Boolean(link?.user_id),
      auth_identity_found:Boolean(auth),
      auth
    });
  }catch(e){
    return errorResponse(e);
  }
}