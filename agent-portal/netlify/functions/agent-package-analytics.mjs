import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const slug=event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    await requirePermission(user.id,organization.id,'packages.analytics');
    const packageId=event.queryStringParameters?.package_id||null;
    const companyId=event.queryStringParameters?.company_id||null;
    if(!packageId&&!companyId) return json(400,{error:'package_id or company_id is required'});
    if(packageId){
      const {data,error}=await client.rpc('package_performance',{target_org:organization.id,target_package:packageId});if(error)throw error;
      return json(200,{environment:'veux-saas-v7',organization,performance:data});
    }
    const {data,error}=await client.rpc('client_package_performance',{target_org:organization.id,target_company:companyId});if(error)throw error;
    return json(200,{environment:'veux-saas-v7',organization,performance:data});
  }catch(error){return errorResponse(error);}
};
