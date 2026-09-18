import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const admin=adminClient();const body=event.httpMethod==='POST'?parseBody(event):{};const org=body.organization_id||event.queryStringParameters?.organization_id;if(!org)return json(400,{error:'organization_id is required'});
    if(!await assertPermission(admin,user.id,org,'onboarding.manage'))return json(403,{error:'Onboarding management permission required'});
    const {data:summary,error:rpcError}=await client.rpc('refresh_launch_readiness',{target_org:org});if(rpcError)throw rpcError;const {data:checks,error}=await admin.from('organization_launch_checks').select('*').eq('organization_id',org).order('category').order('label');if(error)throw error;return json(200,{summary,checks:checks||[]});
  }catch(error){return errorResponse(error)}
};
