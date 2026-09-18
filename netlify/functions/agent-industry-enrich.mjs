import { requireUser, adminClient, assertPermission, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
function clean(v,n=1000){return String(v??'').trim().slice(0,n)}
function safeUrl(v){const s=clean(v,1000);return /^https?:\/\//i.test(s)?s:null}
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event),body=parseBody(event);
  const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug||'maison-de-veux'});
  const admin=adminClient();
  if(!await assertPermission(admin,user.id,organization.id,'crm.manage'))return json(403,{error:'You do not have permission to update CRM records'});
  if(body.confirm!==true)return json(409,{error:'Agent confirmation is required before web research can update CAVYRE.'});
  const contactId=clean(body.contact_id,100),research=body.research||{},e=research.entity||{};
  if(!contactId)return json(400,{error:'Select the existing contact to enrich.'});
  const {data:contact,error:ce}=await admin.from('contacts').select('*').eq('organization_id',organization.id).eq('id',contactId).maybeSingle();
  if(ce)throw ce;if(!contact)return json(404,{error:'Contact not found.'});
  const sources=(Array.isArray(research.sources)?research.sources:[]).filter(s=>safeUrl(s?.url)).slice(0,16);
  const relationships=(Array.isArray(research.relationships)?research.relationships:[]).slice(0,30);
  const metadata={...(contact.metadata||{}),industry_intelligence:{entity_type:clean(e.entity_type,80)||null,primary_company:clean(e.primary_company,180)||null,markets:Array.isArray(e.markets)?e.markets.map(x=>clean(x,80)).filter(Boolean).slice(0,12):[],website:safeUrl(e.website),instagram:clean(e.instagram,180)||null,summary:clean(e.summary,1600)||null,relationships,recent_credits:Array.isArray(research.recent_credits)?research.recent_credits.slice(0,30):[],sources,confidence:Math.max(0,Math.min(100,Number(research.confidence)||0)),verified_at:new Date().toISOString(),verified_by:user.id}};
  const patch={metadata};
  if(e.role&&!contact.role)patch.role=clean(e.role,160);
  if(e.professional_email&&!contact.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(e.professional_email,240)))patch.email=clean(e.professional_email,240).toLowerCase();
  const {data:updated,error:ue}=await admin.from('contacts').update(patch).eq('organization_id',organization.id).eq('id',contactId).select('*').single();
  if(ue)throw ue;
  await admin.from('crm_activity').insert({organization_id:organization.id,contact_id:contactId,activity_type:'note',direction:'internal',subject:'Vera Industry Intelligence',summary:`Agent-approved web enrichment · ${sources.length} sources · confidence ${metadata.industry_intelligence.confidence}%`,occurred_at:new Date().toISOString()});
  return json(200,{ok:true,contact:updated,industry_intelligence:metadata.industry_intelligence});
 }catch(e){return errorResponse(e)}
};