import { requireUser, adminClient, assertPermission, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';
import { aiProviderStatus } from './_lib/ai-providers.mjs';

const TABLES=['models','tasks','companies','contacts','castings','bookings','events','visa_cases','travel_records','ai_jobs'];
async function tableCheck(admin,organizationId,table){
  const {error}=await admin.from(table).select('id').eq('organization_id',organizationId).limit(1);
  return error?{ok:false,error:String(error.message||error).slice(0,180)}:{ok:true};
}
export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),q=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:q.organization||'maison-de-veux'});
    const admin=adminClient();
    const aiUse=await assertPermission(admin,user.id,organization.id,'ai.use');
    if(!aiUse)return json(403,{error:'Vera preflight requires ai.use permission'});
    const permissionKeys=['calendar.read','calendar.write','crm.read','crm.write','tasks.write','tasks.manage','mobility.read','mobility.write'];
    const permissions={};
    for(const key of permissionKeys){try{permissions[key]=await assertPermission(admin,user.id,organization.id,key)}catch(e){permissions[key]=false}}
    const tables={};for(const table of TABLES)tables[table]=await tableCheck(admin,organization.id,table);
    const provider=aiProviderStatus();
    const openaiWeb=Boolean(String(process.env.OPENAI_API_KEY||'').trim());
    const serviceKey=Boolean(String(process.env.VEUX_SUPABASE_SERVICE_ROLE_KEY||process.env.VEUX_SUPABASE_SECRET_KEY||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim());
    const requiredTablesOk=Object.values(tables).every(x=>x.ok);
    const coreReady=serviceKey&&aiUse&&requiredTablesOk&&provider.ok;
    const deepResearchReady=coreReady&&openaiWeb;
    return json(200,{ok:true,release:'16.11.86',organization:organization.slug,authenticated:true,checks:{service_key:serviceKey,ai_provider:provider.ok,openai_web_research:openaiWeb,ai_use_permission:aiUse,required_tables:requiredTablesOk},permissions,tables,readiness:{core:coreReady,deep_research:deepResearchReady,production_candidate:coreReady&&deepResearchReady},note:'This preflight is read-only. Production promotion still requires the staging action checklist.'});
  }catch(e){return errorResponse(e)}
};
