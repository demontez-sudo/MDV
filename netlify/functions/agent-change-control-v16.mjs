import { requireUser, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function safeRows(q,warnings,label){const {data,error}=await q;if(error){warnings.push({area:label,code:error.code||null});return [];}return data||[];}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const slug=event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=adminClient();
    const warnings=[];
    const grants=await Promise.all(['bookings.read','mobility.read','documents.read'].map(k=>assertPermission(admin,user.id,organization.id,k)));
    if(!grants.some(Boolean)){const e=new Error('Missing permission for Change Control');e.statusCode=403;throw e;}
    const notifications=await rows(admin.from('notifications')
      .select('id,user_id,notification_type,title,body,status,source_type,source_id,action_url,metadata,created_at,read_at')
      .eq('organization_id',organization.id)
      .in('notification_type',['booking_shared_state','mobility_shared_state','document_shared_state'])
      .order('created_at',{ascending:false}).limit(600));
    const userIds=[...new Set(notifications.map(x=>x.user_id).filter(Boolean))];
    const modelLinks=userIds.length?await safeRows(admin.from('model_user_links').select('user_id,model_id').eq('organization_id',organization.id).in('user_id',userIds),warnings,'model_links'):[];
    const partnerLinks=userIds.length?await safeRows(admin.from('partner_user_links').select('user_id,partner_agency_id').eq('organization_id',organization.id).in('user_id',userIds),warnings,'partner_links'):[];
    const modelIds=[...new Set(modelLinks.map(x=>x.model_id).concat(notifications.map(x=>x.metadata?.model_id)).filter(Boolean))];
    const partnerIds=[...new Set(partnerLinks.map(x=>x.partner_agency_id).filter(Boolean))];
    const models=modelIds.length?await safeRows(admin.from('models').select('id,display_name,public_slug').eq('organization_id',organization.id).in('id',modelIds),warnings,'models'):[];
    const partners=partnerIds.length?await safeRows(admin.from('partner_agencies').select('id,company_id').eq('organization_id',organization.id).in('id',partnerIds),warnings,'partners'):[];
    const companyIds=[...new Set(partners.map(x=>x.company_id).filter(Boolean))];
    const companies=companyIds.length?await safeRows(admin.from('companies').select('id,name').eq('organization_id',organization.id).in('id',companyIds),warnings,'companies'):[];
    const profiles=userIds.length?await safeRows(admin.from('profiles').select('user_id,display_name,first_name,last_name').in('user_id',userIds),warnings,'profiles'):[];
    const modelById=new Map(models.map(x=>[x.id,x]));
    const modelByUser=new Map(modelLinks.map(x=>[x.user_id,modelById.get(x.model_id)||{id:x.model_id}]));
    const companyById=new Map(companies.map(x=>[x.id,x]));
    const partnerById=new Map(partners.map(x=>[x.id,{...x,company:companyById.get(x.company_id)||null}]));
    const partnerByUser=new Map(partnerLinks.map(x=>[x.user_id,partnerById.get(x.partner_agency_id)||{id:x.partner_agency_id}]));
    const profileByUser=new Map(profiles.map(x=>[x.user_id,x]));
    const items=notifications.map(n=>{
      const model=modelByUser.get(n.user_id)||modelById.get(n.metadata?.model_id)||null;
      const partner=partnerByUser.get(n.user_id)||null;
      const profile=profileByUser.get(n.user_id)||null;
      const recipient_kind=partner?'mother_agency':model?'model':'portal_user';
      const recipient_name=partner?.company?.name||model?.display_name||profile?.display_name||[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||'Portal user';
      return {...n,recipient_kind,recipient_name,model:model||null,partner:partner||null,acknowledged:!!n.metadata?.acknowledged_at,acknowledged_at:n.metadata?.acknowledged_at||null,requires_ack:n.metadata?.requires_ack!==false};
    });
    const required=items.filter(x=>x.requires_ack);
    const outstanding=required.filter(x=>!x.acknowledged);
    return json(200,{environment:'veux-desk-v16.9.64-change-control-recovery',organization,summary:{total:required.length,outstanding:outstanding.length,acknowledged:required.length-outstanding.length,models_outstanding:outstanding.filter(x=>x.recipient_kind==='model').length,partners_outstanding:outstanding.filter(x=>x.recipient_kind==='mother_agency').length},items,warnings});
  }catch(error){return errorResponse(error);}
};
