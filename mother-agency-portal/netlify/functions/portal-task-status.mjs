import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireModelPortal, requirePartnerPortal } from './_lib/portal-bridge.mjs';
export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const b=parseBody(event),slug=b.organization_slug||'maison-de-veux';
    if(b.portal==='partner')await requirePartnerPortal({user,organizationSlug:slug});else await requireModelPortal({user,organizationSlug:slug});
    const map={pending:'open',not_started:'open',inprogress:'in_progress',in_progress:'in_progress',onhold:'waiting',on_hold:'waiting',completed:'completed',done:'completed',waiting:'waiting',open:'open'};
    const status=map[String(b.status||'').toLowerCase()];if(!b.task_id||!status)return json(400,{error:'task_id and valid status are required'});
    const {data,error}=await client.rpc('update_my_task_status',{target_task:b.task_id,new_status:status});if(error)throw error;
    return json(200,{ok:true,result:data});
  }catch(error){return errorResponse(error);}
};
