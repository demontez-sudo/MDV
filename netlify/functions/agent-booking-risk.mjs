import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod)) return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=await requirePermission(user.id,organization.id,'bookings.read');
    const bookingId=body.booking_id||event.queryStringParameters?.booking_id;
    if(!bookingId) return json(400,{error:'booking_id is required'});

    if(event.httpMethod==='POST'){
      const {data:summary,error}=await client.rpc('refresh_booking_risk',{target_org:organization.id,target_booking:bookingId});
      if(error) throw error;
      const snapshotId=summary?.snapshot_id;
      const items=snapshotId?await rows(admin.from('booking_risk_items').select('*,models(id,display_name)').eq('organization_id',organization.id).eq('snapshot_id',snapshotId).order('severity').order('created_at')):[];
      return json(200,{environment:'veux-saas-v7',organization,summary,items});
    }

    const {data:snapshot,error}=await admin.from('booking_risk_snapshots').select('*').eq('organization_id',organization.id).eq('booking_id',bookingId).order('checked_at',{ascending:false}).limit(1).maybeSingle();
    if(error) throw error;
    const items=snapshot?await rows(admin.from('booking_risk_items').select('*,models(id,display_name)').eq('organization_id',organization.id).eq('snapshot_id',snapshot.id).order('created_at')):[];
    return json(200,{environment:'veux-saas-v7',organization,snapshot,items});
  }catch(error){return errorResponse(error);}
};
