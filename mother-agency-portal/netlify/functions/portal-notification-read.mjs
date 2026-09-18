import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireModelPortal, requirePartnerPortal } from './_lib/portal-bridge.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  try {
    const { user } = await requireUser(event);
    const body = parseBody(event);
    const slug = body.organization_slug || 'maison-de-veux';
    const ctx = body.portal === 'partner'
      ? await requirePartnerPortal({user,organizationSlug:slug})
      : await requireModelPortal({user,organizationSlug:slug});
    const now=new Date().toISOString();

    // Source acknowledgement is deliberately separate from simply reading a notification.
    if (body.source_type && body.source_id) {
      const {data:matched,error:me}=await ctx.admin.from('notifications').select('id,metadata,read_at,source_type,source_id')
        .eq('organization_id',ctx.organization.id).eq('user_id',user.id)
        .eq('source_type',String(body.source_type)).eq('source_id',String(body.source_id));
      if(me)throw me;
      const updated=[];
      for(const n of matched||[]){
        const metadata={...(n.metadata||{}),acknowledged_at:now,acknowledged_by_portal:body.portal==='partner'?'mother_agency':'model'};
        const {data,error}=await ctx.admin.from('notifications').update({read_at:n.read_at||now,metadata})
          .eq('organization_id',ctx.organization.id).eq('user_id',user.id).eq('id',n.id)
          .select('id,read_at,source_type,source_id,metadata').single();
        if(error)throw error;updated.push(data);
      }
      return json(200,{ok:true,acknowledged:true,updated});
    }

    let q = ctx.admin.from('notifications').update({read_at:now})
      .eq('organization_id',ctx.organization.id).eq('user_id',user.id).is('read_at',null);
    if (!body.all) {
      if (!body.notification_id) return json(400,{error:'notification_id is required'});
      q = q.eq('id',body.notification_id);
    }
    const {data,error}=await q.select('id,read_at,source_type,source_id,metadata');
    if(error) throw error;
    return json(200,{ok:true,updated:data||[]});
  } catch(error){ return errorResponse(error); }
};
