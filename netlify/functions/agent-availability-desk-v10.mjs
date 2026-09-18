import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
function range(p){const start=p.start?new Date(p.start):new Date();const end=p.end?new Date(p.end):new Date(start.getTime()+14*864e5);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)throw Object.assign(new Error('Invalid availability range'),{statusCode:400});return {start:start.toISOString(),end:end.toISOString()};}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(action==='review_request'){
        await requirePermission(user.id,organization.id,'availability.approve');
        const {data,error}=await client.rpc('review_availability_request',{target_org:organization.id,target_request:body.request_id,target_status:body.status,review_note_value:body.note||null});if(error)throw error;return json(200,{ok:true,verified:true,result:data,persisted_at:new Date().toISOString()});
      }
      if(action==='create_block'){
        const admin=await requirePermission(user.id,organization.id,'availability.write');
        const start=new Date(body.starts_at),end=new Date(body.ends_at);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return json(400,{error:'valid starts_at and ends_at are required'});
        const model=await rows(admin.from('models').select('id').eq('organization_id',organization.id).eq('id',body.model_id).limit(1));if(!model[0])return json(404,{error:'model not found'});
        const {data,error}=await admin.from('availability_blocks').insert({organization_id:organization.id,model_id:body.model_id,block_type:body.block_type||'bookout',status:'approved',starts_at:start.toISOString(),ends_at:end.toISOString(),timezone:body.timezone||organization.timezone||null,reason:body.reason||null,source:'agent',created_by:user.id,approved_by:user.id,approved_at:new Date().toISOString()}).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,block:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='cancel_block'){
        const admin=await requirePermission(user.id,organization.id,'availability.write');
        const {data,error}=await admin.from('availability_blocks').update({status:'cancelled'}).eq('organization_id',organization.id).eq('id',body.block_id).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,block:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      return json(400,{error:'Unsupported availability action'});
    }
    const admin=await requirePermission(user.id,organization.id,'availability.read');const r=range(p);
    const [models,blocks,requests,bookings,bookingModels,options]=await Promise.all([
      rows(admin.from('models').select('id,display_name,public_slug,primary_market_label,stage,status').eq('organization_id',organization.id).eq('active',true).order('display_name')),
      rows(admin.from('availability_blocks').select('*').eq('organization_id',organization.id).lte('starts_at',r.end).gte('ends_at',r.start).neq('status','cancelled').order('starts_at')),
      rows(admin.from('availability_requests').select('*').eq('organization_id',organization.id).lte('starts_at',r.end).gte('ends_at',r.start).order('created_at',{ascending:false})),
      rows(admin.from('bookings').select('id,title,status,starts_at,ends_at,company_id').eq('organization_id',organization.id).lte('starts_at',r.end).gte('ends_at',r.start).not('status','in','(cancelled,closed)')),
      rows(admin.from('booking_models').select('booking_id,model_id,status').eq('organization_id',organization.id)),
      rows(admin.from('booking_options').select('*').eq('organization_id',organization.id).lte('starts_at',r.end).gte('ends_at',r.start).in('status',['active','challenged']))
    ]);
    const canWrite=await assertPermission(admin,user.id,organization.id,'availability.write');const canApprove=await assertPermission(admin,user.id,organization.id,'availability.approve');return json(200,{environment:'veux-saas-v10',organization,range:r,models,availability_blocks:blocks,availability_requests:requests,bookings:bookings.map(b=>({...b,model_ids:bookingModels.filter(x=>x.booking_id===b.id).map(x=>x.model_id)})),options,access:{write:canWrite,approve:canApprove}});
  }catch(error){return errorResponse(error);}
};
