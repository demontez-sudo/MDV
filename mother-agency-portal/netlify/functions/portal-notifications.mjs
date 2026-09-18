import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal, requirePartnerPortal } from './_lib/portal-bridge.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);
    const p=event.queryStringParameters||{},slug=p.organization||'maison-de-veux';
    const ctx=p.portal==='partner'
      ? await requirePartnerPortal({user,organizationSlug:slug})
      : await requireModelPortal({user,organizationSlug:slug});
    const {data,error}=await ctx.admin.from('notifications')
      .select('id,notification_type,title,body,channel,status,source_type,source_id,action_url,read_at,metadata,created_at')
      .eq('organization_id',ctx.organization.id).eq('user_id',user.id)
      .order('created_at',{ascending:false}).limit(100);
    if(error)throw error;
    return json(200,{ok:true,notifications:data||[]});
  }catch(error){return errorResponse(error);}
};
