import { handler as bootstrapHandler } from './model-portal-bootstrap.mjs';
import { handler as scheduleHandler } from './model-portal-schedule.mjs';
import { handler as actionHandler } from './model-portal-action.mjs';
import { handler as uploadHandler } from './model-portal-upload-url.mjs';
import { handler as downloadHandler } from './model-portal-download-url.mjs';
import { toLegacyEvent, fromLegacyResponse, parseLegacyBody, jsonResponse } from './_lib/modern-legacy-bridge.mjs';

function pathOf(req){const u=new URL(req.url);return (u.searchParams.get('endpoint')||u.pathname).replace(/^\/portal(?=\/api\/)/,'');}
function normalizeResponse(v){
  const m={accepted:'accepted',declined:'declined',hold:'need_to_discuss',confirmed:'confirmed',available:'available',unavailable:'unavailable'};
  return m[String(v||'').toLowerCase()]||String(v||'').toLowerCase();
}
function legacyBootstrap(b,s){
  const bookingLinks=(b.commercial?.bookings||[]).map(x=>({
    ...x, bookings:x.booking||x.bookings||null
  }));
  const castingLinks=(b.commercial?.castings||[]).map(x=>({
    ...x, castings:x.casting||x.castings||null
  }));
  const scheduleBookings=(s.bookings||[]).map(x=>({
    id:x.booking_model_id||x.id, booking_id:x.id, model_id:s.model_id, status:x.model_status||x.status||'pending', response_at:null,
    bookings:{...x,id:x.id,starts_at:x.starts_at,ends_at:x.ends_at,call_time:x.starts_at,wrap_time:x.ends_at}
  }));
  const scheduleCastings=(s.castings||[]).map(x=>({
    id:x.casting_model_id||x.id, casting_id:x.id, model_id:s.model_id, status:x.model_status||x.status||'invited', slot_at:x.starts_at, response_at:null,
    castings:{...x,id:x.id,starts_at:x.starts_at,ends_at:x.ends_at}
  }));
  const events=(s.events||[]).map(x=>({id:x.id,event_id:x.id,model_id:s.model_id,attendance_status:x.model_status||x.status||'pending',events:{...x,id:x.id}}));
  const model={...(b.model||{}),measurement:b.measurements||b.model?.measurement||null,media:b.media?.all||b.model?.media||[]};
  const notifications=b.requests||[];
  return {
    ok:true,verified:true,release:'18.1.0',organization:b.organization,current_user:b.account,model,
    schedule:{events,bookings:scheduleBookings.length?scheduleBookings:bookingLinks,castings:scheduleCastings.length?scheduleCastings:castingLinks,availability_blocks:b.availability?.blocks||[],availability_requests:[]},
    booking_rates:(b.commercial?.bookings||[]).map(x=>x.rate).filter(Boolean),
    booking_usage_terms:(b.commercial?.bookings||[]).map(x=>x.usage).filter(Boolean),
    tasks:b.tasks||[],approvals:notifications.filter(x=>/approval/i.test(String(x.notification_type||x.source_type||''))),
    notifications,mobility:b.mobility||{travel:[],visa_cases:[]},documents:b.documents?.links||[],
    finance:{...(b.finance||{}),account:b.finance?.account||{summary:{balances:[],budget_projection:[]},budgets:[],expenses:[],statement_acknowledgements:[]}},
    development:b.development||{},notes:b.notes||[],wellness:b.wellness||{profile:null,items:[],checkins:[]},warnings:[...(b.warnings||[]),...(s.warnings||[])]
  };
}
async function invoke(handler,req,body){return handler(await toLegacyEvent(req,body));}

export default async (req)=>{
  const path=pathOf(req), method=req.method;
  if(path==='/api/model/bootstrap'&&method==='GET'){
    const event=await toLegacyEvent(req);
    const [bo,so]=await Promise.all([bootstrapHandler(event),scheduleHandler(event)]);
    if(Number(bo.statusCode||200)>=400)return fromLegacyResponse(bo);
    const b=parseLegacyBody(bo),s=Number(so.statusCode||200)<400?parseLegacyBody(so):{events:[],bookings:[],castings:[],model_id:b.model?.id};
    return jsonResponse(200,legacyBootstrap(b,s));
  }
  if(path==='/api/model/respond'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    const kind=String(raw.kind||'').toLowerCase(), status=normalizeResponse(raw.response);
    const action=kind==='booking'?'booking_response':kind==='casting'?'casting_response':'request_response';
    const body={...raw,action,status};
    if(kind==='booking')body.link_id=raw.target_id;
    else if(kind==='casting')body.link_id=raw.target_id;
    else {body.request_id=raw.target_id;body.request_type=kind||'schedule_event';}
    const out=await invoke(actionHandler,req,body); if(Number(out.statusCode||200)>=400)return fromLegacyResponse(out);
    return jsonResponse(200,{ok:true,verified:true,result:parseLegacyBody(out)});
  }
  if(path==='/api/portal/task-status'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'task_update'}));
  }
  if(path==='/api/portal/task-reschedule'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'task_reschedule_request'}));
  }
  if(path==='/api/portal/message'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'send_message',message:raw.body||raw.message,thread:raw.conversation_id||raw.thread}));
  }
  if(path==='/api/model/availability-request'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    if(raw.action==='cancel')return jsonResponse(409,{error:'Withdrawing an availability request requires agency review in the unified portal.'});
    const status=raw.status||raw.response||'need_to_discuss';
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'availability_response',status}));
  }
  if(path==='/api/model/approval-response'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    const status=String(raw.response||'').toLowerCase()==='approved'?'accepted':'declined';
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'request_response',status,request_type:'approval'}));
  }
  if(path==='/api/model/development-submissions'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    if(raw.action==='withdraw')return jsonResponse(409,{error:'Withdrawal requires agency review in the unified portal.'});
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'development_submission',message:raw.message||raw.notes||raw.note||'Development submission received.'}));
  }
  if(path==='/api/model/media'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    if(raw.action==='prepare_upload')return fromLegacyResponse(await invoke(uploadHandler,req,{...raw,purpose:'model_media'}));
    return jsonResponse(409,{error:'Media finalization is handled by the unified storage finalizer.'});
  }
  if(path==='/api/model/account-action'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'request_response',status:'completed',request_type:raw.action||'account_action',request_id:raw.statement_id||null,note:'Model account acknowledgement'}));
  }
  if(path==='/api/model/self-profile'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'request_response',status:'completed',request_type:'profile_update',note:JSON.stringify(raw).slice(0,1600)}));
  }
  if(path==='/api/model/wellness-checkin'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'request_response',status:'completed',request_type:'wellness_checkin',note:raw.note||raw.notes||'Wellness check-in submitted.'}));
  }
  if(path==='/api/model/calendar-action'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    const note=[raw.title,raw.location,raw.notes||raw.reason].filter(Boolean).join(' · ');
    return fromLegacyResponse(await invoke(actionHandler,req,{...raw,action:'availability_response',status:'need_to_discuss',note:note||`Calendar request: ${raw.action||'update'}`}));
  }
  if(path==='/api/portal/notifications'&&method==='GET'){
    const out=await bootstrapHandler(await toLegacyEvent(req)); if(Number(out.statusCode||200)>=400)return fromLegacyResponse(out); const b=parseLegacyBody(out);
    return jsonResponse(200,{ok:true,notifications:b.requests||[]});
  }
  if(path==='/api/portal/notification-read'&&method==='POST'){
    const raw=await req.json().catch(()=>({}));
    const event=await toLegacyEvent(req,raw);
    const { requireUser, adminClient } = await import('./_lib/auth.mjs');
    try {
      const { user } = await requireUser(event);
      const admin = adminClient();
      let q = admin.from('notifications').update({status:'read'}).eq('user_id',user.id);
      if(raw.notification_id) q=q.eq('id',raw.notification_id);
      else if(raw.source_type&&raw.source_id) q=q.eq('source_type',raw.source_type).eq('source_id',raw.source_id);
      else if(!raw.all) return jsonResponse(400,{error:'Notification target is required.'});
      const {data,error}=await q.select('id,status');
      if(error) throw error;
      return jsonResponse(200,{ok:true,updated:data||[]});
    } catch(error) {
      return jsonResponse(error?.statusCode||500,{error:(error?.statusCode||500)>=500?'Server error':(error?.message||'Notification update failed.')});
    }
  }
  if(path==='/api/model/directory'&&method==='GET')return jsonResponse(200,{ok:true,models:[]});
  if(path==='/api/model/access-login')return jsonResponse(410,{error:'Legacy model access-code login is retired. Use the Model Portal email and password.'});
  if(path==='/api/model-assistant')return jsonResponse(503,{error:'Model assistant is temporarily unavailable during unified cutover.'});
  if(path==='/api/model/download-url'&&method==='GET')return fromLegacyResponse(await downloadHandler(await toLegacyEvent(req)));
  return jsonResponse(404,{error:'Unknown unified Model Portal endpoint',path});
};
