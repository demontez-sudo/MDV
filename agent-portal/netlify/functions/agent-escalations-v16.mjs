import { requireUser, parseBody, json, errorResponse, adminClient } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { collectPortalEscalations, createEscalationTask } from './_lib/portal-escalation.mjs';

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const body=event.httpMethod==='POST'?parseBody(event):{};const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});const admin=adminClient();await requirePermission(user.id,organization.id,event.httpMethod==='POST'?'tasks.write':'tasks.read');
    const items=await collectPortalEscalations({organizationId:organization.id,admin,limit:800});
    if(event.httpMethod==='POST'){
      const item=items.find(x=>x.id===body.notification_id);if(!item)return json(404,{error:'Escalation item was not found or is already acknowledged'});
      const result=await createEscalationTask(admin,item,{actorUserId:user.id});return json(200,{ok:true,...result});
    }
    const open=items.filter(x=>!x.escalated),critical=open.filter(x=>x.severity==='critical'),high=open.filter(x=>x.severity==='high'),watch=open.filter(x=>x.severity==='watch');
    return json(200,{environment:'veux-desk-v16.5',organization,summary:{total:items.length,open:open.length,critical:critical.length,high:high.length,watch:watch.length,escalated:items.filter(x=>x.escalated).length},items});
  }catch(error){return errorResponse(error);}
};
