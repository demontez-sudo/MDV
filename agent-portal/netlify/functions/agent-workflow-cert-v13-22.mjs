import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

const GROUPS=[
  {key:'roster',label:'Roster & Model Profiles',tables:['models','model_measurements','model_media'],page:'roster'},
  {key:'calendar',label:'Calendar / Booking / Casting',tables:['events','event_models','bookings','booking_models','castings','casting_models'],page:'calendar'},
  {key:'crm',label:'Industry Directory / CRM',tables:['companies','contacts','crm_activity'],page:'industrydirectory'},
  {key:'mobility',label:'Global Mobility',tables:['passports','visa_cases','travel_records'],page:'globalmobility'},
  {key:'tasks',label:'Tasks & Ownership',tables:['tasks','task_assignments'],page:'tasksconsolidated'},
  {key:'packages',label:'Model Packages',tables:['packages','package_models','package_recipients','package_feedback'],page:'multipackage'},
  {key:'documents',label:'Documents & Secure Sharing',tables:['documents','document_links'],page:'roster'},
  {key:'finance',label:'Finance & Legal',tables:['invoices','payments','model_payouts','contracts','usage_rights'],page:'financelegal'},
  {key:'team',label:'Team & Permissions',tables:['organization_members','member_roles'],page:'team'},
  {key:'communications',label:'Messages',tables:['conversations','conversation_participants','messages'],page:'inbox'},
  {key:'partner',label:'Mother Agency / Partner',tables:['partner_agencies','partner_user_links','model_placements'],page:'madirectory'}
];

async function countTable(admin,table,orgId){
  const r=await admin.from(table).select('id',{count:'exact',head:true}).eq('organization_id',orgId);
  if(r.error) return {ok:false,count:0,error:r.error.message};
  return {ok:true,count:r.count||0,error:null};
}
function rowStatus(results){
  const failed=results.filter(x=>!x.ok);
  if(failed.length) return 'fail';
  const total=results.reduce((n,x)=>n+x.count,0);
  return total===0?'warn':'pass';
}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'org.settings.manage');
    const workflows=[];
    for(const g of GROUPS){
      const tableResults=[];
      for(const t of g.tables){tableResults.push({table:t,...await countTable(admin,t,organization.id)});}
      const status=rowStatus(tableResults);
      const bad=tableResults.filter(x=>!x.ok);
      const total=tableResults.reduce((n,x)=>n+x.count,0);
      workflows.push({
        key:g.key,label:g.label,page:g.page,status,
        detail:bad.length?`${bad.length} table connection(s) failed`:total===0?'Connected, but no relational records found':`${total} relational record(s) available across ${g.tables.length} table(s)`,
        tables:tableResults
      });
    }
    const fail=workflows.filter(x=>x.status==='fail').length;
    const warn=workflows.filter(x=>x.status==='warn').length;
    const pass=workflows.filter(x=>x.status==='pass').length;
    return json(200,{environment:'veux-v13.22-workflow-certification',generated_at:new Date().toISOString(),organization:{id:organization.id,name:organization.name,slug:organization.slug},gate:fail?'blocked':warn?'review':'ready',summary:{pass,warn,fail,total:workflows.length},workflows});
  }catch(error){return errorResponse(error);}
};
