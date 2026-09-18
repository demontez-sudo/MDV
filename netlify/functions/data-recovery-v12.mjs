import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { enforceRateLimit, withIdempotency } from './_lib/reliability.mjs';

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod)) return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const admin=adminClient();
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const org=body.organization_id||event.queryStringParameters?.organization_id;
    if(!org) return json(400,{error:'organization_id is required'});
    if(!await assertPermission(admin,user.id,org,'data.recover')) return json(403,{error:'Data recovery permission required'});

    if(event.httpMethod==='GET'){
      const {data,error}=await client.rpc('list_recovery_items',{target_org:org});
      if(error) throw error;
      return json(200,{organization_id:org,items:data||[]});
    }

    const action=String(body.action||'restore');
    if(action!=='restore') return json(400,{error:'Unsupported recovery action'});
    if(!body.recovery_item_id) return json(400,{error:'recovery_item_id is required'});
    await enforceRateLimit(admin,{bucket:'data.recovery',subject:user.id,maxRequests:20,windowSeconds:60});
    return withIdempotency(admin,{event,body,organizationId:org,userId:user.id,operation:'data.restore',execute:async()=>{
      const {data,error}=await admin.rpc('restore_recovery_item_service',{recovery_item:body.recovery_item_id,target_org:org,actor_user:user.id});
      if(error) throw error;
      if(data?.ok===false)return json(409,{error:'Record could not be restored',detail:data.error||null,recovery_item_id:body.recovery_item_id});
      return json(200,{...data,recovery_item_id:body.recovery_item_id});
    }});
  }catch(error){return errorResponse(error)}
};
