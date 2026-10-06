import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireModelPortal } from './_lib/portal-bridge.mjs';

const now=()=>new Date().toISOString();
const text=(v,max=4000)=>String(v??'').trim().slice(0,max);
const allowed=(v,set,label)=>{const x=String(v||'').trim().toLowerCase();if(!set.has(x)){const e=new Error(`Invalid ${label}.`);e.statusCode=400;throw e;}return x;};
const responseStatuses=new Set(['available','unavailable','interested','declined','need_to_discuss','confirmed','accepted','pass']);
const taskStatuses=new Set(['open','not_started','in_progress','blocked','completed']);

async function one(q){const {data,error}=await q;if(error)throw error;return data;}
async function modelNote(admin,{organizationId,modelId,userId,body,title='Model Portal Update',noteType='model_portal',metadata={}}){
  const payload={organization_id:organizationId,model_id:modelId,body:text(body),pinned:false,created_by:userId};
  // Newer schemas support these fields. If one is absent, retry with the proven core columns.
  const rich={...payload,title,note_type:noteType,visible_to_model:true,metadata:{source:'model_portal',direction:'model_to_agency',...metadata}};
  let q=await admin.from('model_notes').insert(rich).select('*').single();
  if(!q.error)return q.data;
  q=await admin.from('model_notes').insert(payload).select('*').single();
  if(q.error)throw q.error;
  return q.data;
}


const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const isCheckViolation=e=>String(e?.code||'')==='23514'||/check constraint|not allowed|violates/i.test(String(e?.message||''));
/* Try each candidate value until the database's CHECK constraint accepts one. */
async function updateWithFallback(build,field,candidates){
  let last=null;
  for(const value of candidates){
    const {data,error}=await build({[field]:value}).select('*').maybeSingle();
    if(!error)return {data,value};
    last=error;if(!isCheckViolation(error))throw error;
  }
  throw last;
}
/* Post a model's message into the same conversation store the agency Messages inbox reads. */
async function sendToAgency({admin,client,user,organization,modelId,conversationId,subject,message}){
  let conv=null;
  if(isUuid(conversationId)){
    const {data,error}=await admin.from('conversations').select('id,model_id,status,subject').eq('organization_id',organization.id).eq('id',conversationId).eq('model_id',modelId).maybeSingle();
    if(error)throw error;conv=data;
  }
  if(conv&&conv.status==='closed'){const e=new Error('This conversation is closed. Start a new message instead.');e.statusCode=409;throw e;}
  if(!conv){
    /* Reuse the open conversation for the same subject so repeated replies on one booking stay in one thread. */
    const subj=text(subject,160)||'Message from model';
    const {data:same}=await admin.from('conversations').select('id,model_id,status,subject').eq('organization_id',organization.id).eq('model_id',modelId).eq('subject',subj).neq('status','closed').neq('status','archived').order('updated_at',{ascending:false}).limit(1);
    if(same&&same[0])conv=same[0];
  }
  if(!conv){
    const base={organization_id:organization.id,model_id:modelId,subject:text(subject,160)||'Message from model'};
    let ins=await admin.from('conversations').insert({...base,status:'active'}).select('id,model_id,status,subject').single();
    if(ins.error)ins=await admin.from('conversations').insert(base).select('id,model_id,status,subject').single();
    if(ins.error)throw ins.error;conv=ins.data;
  }
  const rpc=await client.rpc('send_portal_message',{target_conversation:conv.id,message_body:message});
  if(rpc.error){
    const {data:m}=await admin.from('models').select('display_name').eq('organization_id',organization.id).eq('id',modelId).maybeSingle();
    const saved=await admin.from('messages').insert({organization_id:organization.id,conversation_id:conv.id,sender_user_id:user.id,sender_label:m?.display_name||'Model',body:message,visibility:'participants'}).select('id,conversation_id,sent_at').single();
    if(saved.error)throw rpc.error;
    await admin.from('conversations').update({updated_at:now()}).eq('id',conv.id);
    return {conversation_id:conv.id,message:saved.data,fallback:true};
  }
  return {conversation_id:conv.id,result:rpc.data};
}
async function titleOf(admin,organization,table,id){
  if(!id)return null;try{const {data}=await admin.from(table).select('title').eq('organization_id',organization.id).eq('id',id).maybeSingle();return data?.title||null;}catch(_e){return null;}
}
const RESPONSE_LABEL={accepted:'Accepted',confirmed:'Confirmed',declined:'Declined',need_to_discuss:'On hold / needs discussion',available:'Available',unavailable:'Unavailable',interested:'Interested',pass:'Passed'};

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'},{Allow:'POST'});
  try{
    const {user,client}=await requireUser(event);
    const body=parseBody(event), slug=body.organization||body.organization_slug||'maison-de-veux';
    const {admin,organization,modelId}=await requireModelPortal({user,organizationSlug:slug});
    const action=String(body.action||'').trim();
    if(!action){const e=new Error('Action is required.');e.statusCode=400;throw e;}


    if(action==='availability_response'){
      const response=allowed(body.status,new Set(['available','unavailable','need_to_discuss']),'availability response');
      const start=text(body.starts_at,80),end=text(body.ends_at,80),note=text(body.note,1800);
      if(!start&&!end&&!note){const e=new Error('Availability dates or a note are required.');e.statusCode=400;throw e;}
      const record=await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:note||`Availability: ${response}`,title:'Availability Response',noteType:'availability_response',metadata:{response,starts_at:start||null,ends_at:end||null,market:text(body.market,120)||null}});
      return json(200,{ok:true,verified:true,action,status:response,record});
    }

    if(action==='mobility_response'){
      const response=allowed(body.status,new Set(['confirmed','change_requested','need_to_discuss']),'mobility response');
      const resourceType=allowed(body.resource_type,new Set(['travel','visa']),'mobility type'); const resourceId=text(body.resource_id,120);
      if(!resourceId){const e=new Error('Travel or visa record is required.');e.statusCode=400;throw e;}
      const table=resourceType==='travel'?'travel_records':'visa_cases';
      const {data:target,error:targetError}=await admin.from(table).select('id').eq('organization_id',organization.id).eq('model_id',modelId).eq('id',resourceId).maybeSingle();if(targetError)throw targetError;if(!target){const e=new Error('Mobility record was not found.');e.statusCode=404;throw e;}
      const record=await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:text(body.note,1800)||`${resourceType} details ${response.replaceAll('_',' ')}`,title:resourceType==='travel'?'Travel Response':'Visa Response',noteType:'mobility_response',metadata:{resource_type:resourceType,resource_id:resourceId,response}});
      return json(200,{ok:true,verified:true,action,status:response,record});
    }

    if(action==='document_ack'){
      const documentId=text(body.document_id,120);if(!documentId){const e=new Error('Document is required.');e.statusCode=400;throw e;}
      const {data:link,error:linkError}=await admin.from('document_links').select('id,document_id').eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',modelId).eq('document_id',documentId).eq('visible_to_model',true).maybeSingle();if(linkError)throw linkError;if(!link){const e=new Error('Document is not available to this Model Portal.');e.statusCode=404;throw e;}
      const record=await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:text(body.note,1000)||'Document reviewed and acknowledged.',title:'Document Acknowledged',noteType:'document_acknowledgement',metadata:{document_id:documentId,acknowledged_at:now()}});
      return json(200,{ok:true,verified:true,action,record});
    }

    if(action==='request_response'){
      const response=allowed(body.status,new Set(['accepted','declined','need_to_discuss','completed']),'request response');
      const requestType=text(body.request_type,120)||'agency_request',requestId=text(body.request_id,120);
      const record=await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:text(body.note,1800)||`Request response: ${response}`,title:'Agency Request Response',noteType:'request_response',metadata:{request_type:requestType,request_id:requestId||null,response}});
      return json(200,{ok:true,verified:true,action,status:response,record});
    }

    if(action==='casting_response'){
      const id=text(body.link_id||body.id,120),castingId=text(body.casting_id,120);
      if(!id&&!castingId){const e=new Error('Casting response target is required.');e.statusCode=400;throw e;}
      const status=allowed(body.status,responseStatuses,'casting response'),note=text(body.note,1800);
      const build=v=>{let q=admin.from('casting_models').update({...v,response_at:now(),feedback:note||null}).eq('organization_id',organization.id).eq('model_id',modelId);return id?q.eq('id',id):q.eq('casting_id',castingId);};
      const {data}=await updateWithFallback(build,'status',[status,...(status==='need_to_discuss'?['pending']:[])]);
      if(!data){const e=new Error('Casting assignment was not found.');e.statusCode=404;throw e;}
      const title=await titleOf(admin,organization,'castings',data.casting_id);
      let message_warning=null;try{await sendToAgency({admin,client,user,organization,modelId,subject:`Casting: ${title||'Response'}`,message:`${RESPONSE_LABEL[status]||status} — ${title||'casting'}${note?'\n\n'+note:''}`});}catch(me){message_warning=me?.message||String(me);}
      return json(200,{ok:true,verified:true,action,status,record:data,message_warning});
    }

    if(action==='booking_response'){
      const id=text(body.link_id||body.id,120),bookingId=text(body.booking_id,120);
      if(!id&&!bookingId){const e=new Error('Booking response target is required.');e.statusCode=400;throw e;}
      const status=allowed(body.status,responseStatuses,'booking response'),note=text(body.note,1800);
      const build=v=>{let q=admin.from('booking_models').update({...v,response_at:now(),...(note?{notes:note}:{})}).eq('organization_id',organization.id).eq('model_id',modelId);return id?q.eq('id',id):q.eq('booking_id',bookingId);};
      const {data}=await updateWithFallback(build,'status',[status,...(status==='need_to_discuss'?['pending']:[])]);
      if(!data){const e=new Error('Booking assignment was not found.');e.statusCode=404;throw e;}
      const title=await titleOf(admin,organization,'bookings',data.booking_id);
      let message_warning=null;try{await sendToAgency({admin,client,user,organization,modelId,subject:`Booking: ${title||'Response'}`,message:`${RESPONSE_LABEL[status]||status} — ${title||'booking'}${note?'\n\n'+note:''}`});}catch(me){message_warning=me?.message||String(me);}
      return json(200,{ok:true,verified:true,action,status,record:data,message_warning});
    }

    if(action==='event_response'){
      const eventId=text(body.event_id||body.id,120);
      if(!eventId){const e=new Error('Event response target is required.');e.statusCode=400;throw e;}
      const status=allowed(body.status,new Set(['accepted','declined','need_to_discuss','confirmed','available','unavailable']),'event response'),note=text(body.note,1800);
      const candidates=status==='declined'||status==='unavailable'?['declined','unavailable']:status==='need_to_discuss'?['tentative','maybe','pending']:['accepted','confirmed','attending'];
      const build=v=>admin.from('event_models').update(v).eq('organization_id',organization.id).eq('model_id',modelId).eq('event_id',eventId);
      const {data}=await updateWithFallback(build,'attendance_status',candidates);
      if(!data){const e=new Error('Event assignment was not found.');e.statusCode=404;throw e;}
      const title=await titleOf(admin,organization,'events',eventId);
      await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:note||`${RESPONSE_LABEL[status]||status}: ${title||'event'}`,title:'Event Response',noteType:'event_response',metadata:{event_id:eventId,response:status}});
      let message_warning=null;try{await sendToAgency({admin,client,user,organization,modelId,subject:`Event: ${title||'Response'}`,message:`${RESPONSE_LABEL[status]||status} — ${title||'event'}${note?'\n\n'+note:''}`});}catch(me){message_warning=me?.message||String(me);}
      return json(200,{ok:true,verified:true,action,status,record:data,message_warning});
    }

    if(action==='task_update'){
      const taskId=text(body.task_id||body.id,120);if(!taskId){const e=new Error('Task is required.');e.statusCode=400;throw e;}
      const status=allowed(body.status,taskStatuses,'task status');
      const patch=status==='completed'?{status,completed_at:now()}:{status};
      const data=await one(admin.from('tasks').update(patch).eq('organization_id',organization.id).eq('model_id',modelId).eq('id',taskId).select('*').maybeSingle());
      if(!data){const e=new Error('Task was not found.');e.statusCode=404;throw e;}
      const note=text(body.note,1800);
      if(note)await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:note,title:'Task Response',noteType:'task_response',metadata:{task_id:taskId,status}});
      return json(200,{ok:true,verified:true,action,status,record:data});
    }

    if(action==='task_reschedule_request'){
      const taskId=text(body.task_id||body.id,120);if(!taskId){const e=new Error('Task is required.');e.statusCode=400;throw e;}
      const requestedDate=text(body.requested_date,40);if(!/^\d{4}-\d{2}-\d{2}/.test(requestedDate)){const e=new Error('A valid requested date is required.');e.statusCode=400;throw e;}
      const note=text(body.note,1800);
      const existing=await one(admin.from('tasks').select('id,metadata').eq('organization_id',organization.id).eq('model_id',modelId).eq('id',taskId).maybeSingle());
      if(!existing){const e=new Error('Task was not found.');e.statusCode=404;throw e;}
      const nextMeta={...(existing.metadata||{}),reschedule_status:'pending',reschedule_requested_date:requestedDate,reschedule_note:note||null,reschedule_requested_at:now()};
      const data=await one(admin.from('tasks').update({metadata:nextMeta}).eq('organization_id',organization.id).eq('model_id',modelId).eq('id',taskId).select('*').single());
      if(note)await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:note,title:'Reschedule Requested',noteType:'task_reschedule_request',metadata:{task_id:taskId,requested_date:requestedDate}});
      return json(200,{ok:true,verified:true,action,record:data});
    }

    if(action==='send_message'){
      const message=text(body.message,4000);if(!message){const e=new Error('Message cannot be empty.');e.statusCode=400;throw e;}
      const sent=await sendToAgency({admin,client,user,organization,modelId,conversationId:text(body.thread||body.conversation_id,120),subject:text(body.subject,160),message});
      return json(200,{ok:true,verified:true,action,conversation_id:sent.conversation_id,record:sent.message||sent.result||null});
    }

    if(action==='development_submission'){
      const message=text(body.message,4000);if(!message){const e=new Error('Submission notes are required.');e.statusCode=400;throw e;}
      const taskId=text(body.task_id,120),planId=text(body.plan_id,120),category=text(body.category,120)||'development';
      const note=await modelNote(admin,{organizationId:organization.id,modelId,userId:user.id,body:message,title:'Development Submission',noteType:'development_submission',metadata:{task_id:taskId||null,plan_id:planId||null,category}});
      if(taskId){
        await admin.from('tasks').update({status:'in_progress'}).eq('organization_id',organization.id).eq('model_id',modelId).eq('id',taskId);
      }
      return json(200,{ok:true,verified:true,action,record:note});
    }

    const e=new Error('Unsupported model portal action.');e.statusCode=400;throw e;
  }catch(error){return errorResponse(error);}
};
