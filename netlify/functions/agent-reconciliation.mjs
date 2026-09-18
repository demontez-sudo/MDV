import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod)) return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event); const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    const admin=await requirePermission(user.id,organization.id,'finance.reconcile');
    if(event.httpMethod==='GET'){
      const sessionId=event.queryStringParameters?.session_id||null;
      const sessions=await rows(admin.from('reconciliation_sessions').select('*').eq('organization_id',organization.id).order('period_end',{ascending:false}).limit(100));
      const items=sessionId?await rows(admin.from('reconciliation_items').select('*').eq('organization_id',organization.id).eq('session_id',sessionId).order('created_at')):[];
      const periods=await rows(admin.from('accounting_periods').select('*').eq('organization_id',organization.id).order('ends_on',{ascending:false}).limit(100));
      return json(200,{environment:'veux-saas-v7',organization,sessions,items,accounting_periods:periods});
    }
    const action=String(body.action||'');
    let rpc,args;
    if(action==='start'){
      rpc='start_reconciliation_session';args={target_org:organization.id,target_period_start:body.period_start,target_period_end:body.period_end,target_currency:body.currency||'USD',target_connection:body.connection_id||null,target_notes:body.notes||null};
    }else if(action==='resolve_item'){
      rpc='resolve_reconciliation_item';args={target_org:organization.id,target_item:body.item_id,target_status:body.status,target_external_amount:body.external_amount??null,target_external_id:body.external_id||null,target_note:body.note||null};
    }else if(action==='refresh'){
      rpc='refresh_reconciliation_totals';args={target_org:organization.id,target_session:body.session_id};
    }else if(action==='complete'){
      rpc='complete_reconciliation_session';args={target_org:organization.id,target_session:body.session_id,target_force:!!body.force,target_note:body.note||null};
    }else if(action==='close_period'){
      rpc='close_accounting_period';args={target_org:organization.id,target_period:body.period_id,target_lock:!!body.lock,target_note:body.note||null};
    }else return json(400,{error:'Unsupported reconciliation action'});
    const {data,error}=await client.rpc(rpc,args);if(error)throw error;
    return json(200,{ok:true,result:data});
  }catch(error){return errorResponse(error);}
};
