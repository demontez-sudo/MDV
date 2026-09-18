import { requireUser, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{};
    const {organization,member}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    await requirePermission(user.id,organization.id,'org.read');
    const {data:dashboard,error}=await client.rpc('get_executive_dashboard',{target_org:organization.id,as_of_value:p.as_of||new Date().toISOString()});if(error)throw error;
    const admin=adminClient();
    const canAlerts=await assertPermission(admin,user.id,organization.id,'alerts.read');
    const [alerts,notifications,prefs]=await Promise.all([
      canAlerts?rows(admin.from('alerts').select('id,alert_type,severity,title,body,status,model_id,source_type,source_id,created_at').eq('organization_id',organization.id).in('status',['open','acknowledged']).order('created_at',{ascending:false}).limit(30)):Promise.resolve([]),
      rows(admin.from('notifications').select('id,notification_type,title,body,status,source_type,source_id,created_at').eq('organization_id',organization.id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)),
      rows(admin.from('member_preferences').select('dashboard_layout,notification_preferences').eq('organization_id',organization.id).eq('member_id',member.id).limit(1))
    ]);
    return json(200,{environment:'veux-saas-v10',organization,dashboard,alerts,notifications,preferences:prefs[0]||null});
  }catch(error){return errorResponse(error);}
};
