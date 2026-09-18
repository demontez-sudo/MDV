import { requireUser, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import { emailDeliveryStatus } from './_lib/email.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
function check(key,label,status,detail,area){return {key,label,status,detail,area};}
function duplicates(rows,keyFn){const m=new Map();for(const r of rows){const k=keyFn(r);m.set(k,(m.get(k)||0)+1);}return [...m.entries()].filter(([,n])=>n>1);}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const slug=event.queryStringParameters?.organization||'maison-de-veux';const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});const admin=adminClient();
    const allowed=await Promise.all(['members.read','models.read','documents.read'].map(k=>assertPermission(admin,user.id,organization.id,k)));if(!allowed.some(Boolean)){const e=new Error('Missing permission for Release Audit');e.statusCode=403;throw e;}
    const [models,modelLinks,partners,partnerLinks,placements,docLinks,notifications,bookingModels,castingModels,members]=await Promise.all([
      rows(admin.from('models').select('id,display_name,status').eq('organization_id',organization.id).limit(1500)),
      rows(admin.from('model_user_links').select('id,user_id,model_id').eq('organization_id',organization.id).limit(2000)),
      rows(admin.from('partner_agencies').select('id,company_id,portal_enabled').eq('organization_id',organization.id).limit(1000)),
      rows(admin.from('partner_user_links').select('id,user_id,partner_agency_id').eq('organization_id',organization.id).limit(1500)),
      rows(admin.from('model_placements').select('id,model_id,partner_agency_id,status').eq('organization_id',organization.id).limit(3000)),
      rows(admin.from('document_links').select('id,document_id,resource_type,resource_id,visible_to_model,visible_to_partner').eq('organization_id',organization.id).eq('resource_type','model').limit(4000)),
      rows(admin.from('notifications').select('id,user_id,notification_type,source_type,source_id,metadata,created_at').eq('organization_id',organization.id).in('notification_type',['booking_shared_state','mobility_shared_state','document_shared_state']).limit(3000)),
      rows(admin.from('booking_models').select('id,booking_id,model_id').eq('organization_id',organization.id).limit(4000)),
      rows(admin.from('casting_models').select('id,casting_id,model_id').eq('organization_id',organization.id).limit(4000)),
      rows(admin.from('organization_members').select('id,user_id,member_type,status').eq('organization_id',organization.id).limit(2000))
    ]);
    const modelIds=new Set(models.map(x=>x.id)),partnerIds=new Set(partners.map(x=>x.id)),memberUsers=new Set(members.filter(x=>x.status==='active').map(x=>x.user_id));
    const modelUserByModel=new Map(modelLinks.map(x=>[x.model_id,x.user_id]));const partnerUsersByPartner=new Map();for(const x of partnerLinks){if(!partnerUsersByPartner.has(x.partner_agency_id))partnerUsersByPartner.set(x.partner_agency_id,[]);partnerUsersByPartner.get(x.partner_agency_id).push(x.user_id);}
    const activePlacementByModel=new Map();for(const p of placements.filter(x=>['active','pending','placed'].includes(x.status))){if(!activePlacementByModel.has(p.model_id))activePlacementByModel.set(p.model_id,[]);activePlacementByModel.get(p.model_id).push(p);}
    const checks=[];const delivery=emailDeliveryStatus();checks.push(check('email-delivery','Resend email delivery',delivery.configured?'pass':'fail',delivery.configured?'Resend runtime key is available to Netlify Functions':'RESEND_API_KEY is missing from the Functions runtime; package, signature, and password-recovery email are offline','Readiness'));
    const orphanModelLinks=modelLinks.filter(x=>!modelIds.has(x.model_id));checks.push(check('model-link-orphans','Model portal identity links',orphanModelLinks.length?'fail':'pass',orphanModelLinks.length?`${orphanModelLinks.length} link(s) point to missing models`:`${modelLinks.length} model link(s) resolve`,'Identity'));
    const duplicateModelLinks=duplicates(modelLinks,x=>x.model_id).length+duplicates(modelLinks,x=>x.user_id).length;checks.push(check('model-link-duplicates','Model portal uniqueness',duplicateModelLinks?'fail':'pass',duplicateModelLinks?`${duplicateModelLinks} duplicate identity grouping(s)`:'One model ↔ one portal identity','Identity'));
    const orphanPartnerLinks=partnerLinks.filter(x=>!partnerIds.has(x.partner_agency_id));checks.push(check('partner-link-orphans','Mother Agency identity links',orphanPartnerLinks.length?'fail':'pass',orphanPartnerLinks.length?`${orphanPartnerLinks.length} orphan partner link(s)`:`${partnerLinks.length} partner user link(s) resolve`,'Identity'));
    const inactiveMembership=[...modelLinks,...partnerLinks].filter(x=>!memberUsers.has(x.user_id));checks.push(check('portal-memberships','Portal membership state',inactiveMembership.length?'fail':'pass',inactiveMembership.length?`${inactiveMembership.length} portal user(s) lack active organization membership`:'All linked portal users have active membership','Identity'));
    const orphanPlacements=placements.filter(x=>!modelIds.has(x.model_id)||!partnerIds.has(x.partner_agency_id));checks.push(check('placement-integrity','Placement relationships',orphanPlacements.length?'fail':'pass',orphanPlacements.length?`${orphanPlacements.length} invalid placement relation(s)`:`${placements.length} placement relation(s) resolve`,'Relationships'));
    const modelDocGaps=docLinks.filter(x=>x.visible_to_model&&!modelUserByModel.has(x.resource_id));checks.push(check('model-doc-visibility','Model document visibility',modelDocGaps.length?'warn':'pass',modelDocGaps.length?`${modelDocGaps.length} model-visible file(s) have no linked Model Portal user`:'Model-visible files have portal identities','Visibility'));
    const partnerDocGaps=docLinks.filter(x=>x.visible_to_partner&&!((activePlacementByModel.get(x.resource_id)||[]).some(p=>(partnerUsersByPartner.get(p.partner_agency_id)||[]).length)));checks.push(check('partner-doc-visibility','Mother Agency document visibility',partnerDocGaps.length?'warn':'pass',partnerDocGaps.length?`${partnerDocGaps.length} partner-visible file(s) lack an active placement + portal user`:'Partner-visible files resolve through placement scope','Visibility'));
    const badNotifications=notifications.filter(x=>!x.source_type||!x.source_id);checks.push(check('shared-state-sources','Shared-state notification sources',badNotifications.length?'fail':'pass',badNotifications.length?`${badNotifications.length} shared update(s) lack source identity`:`${notifications.length} shared updates are source-scoped`,'Synchronization'));
    const unownedNotifications=notifications.filter(x=>!memberUsers.has(x.user_id));checks.push(check('shared-state-users','Shared-state recipient membership',unownedNotifications.length?'warn':'pass',unownedNotifications.length?`${unownedNotifications.length} shared update(s) target users outside active membership`:'Shared updates target active portal users','Synchronization'));
    const orphanBookingModels=bookingModels.filter(x=>!modelIds.has(x.model_id)),orphanCastingModels=castingModels.filter(x=>!modelIds.has(x.model_id));checks.push(check('work-model-links','Booking/Casting model links',(orphanBookingModels.length+orphanCastingModels.length)?'fail':'pass',(orphanBookingModels.length+orphanCastingModels.length)?`${orphanBookingModels.length} booking + ${orphanCastingModels.length} casting orphan link(s)`:'Booking and casting model links resolve','Workflows'));
    const eligibleModels=models.filter(x=>!['archived','released'].includes(String(x.status||'').toLowerCase()));const linkedPortalModels=eligibleModels.filter(x=>modelUserByModel.has(x.id)).length;checks.push(check('portal-coverage','Model Portal access','pass',`${linkedPortalModels} of ${eligibleModels.length} active roster model(s) currently have invited portal access. Portal identities are created only when access is issued.`,'Access'));
    const counts={pass:checks.filter(x=>x.status==='pass').length,warn:checks.filter(x=>x.status==='warn').length,fail:checks.filter(x=>x.status==='fail').length};const score=Math.max(0,Math.round(((counts.pass+counts.warn*.5)/checks.length)*100));
    return json(200,{environment:'veux-desk-v16.7-rc1',organization,summary:{score,...counts,total:checks.length},checks});
  }catch(error){return errorResponse(error);}
};
