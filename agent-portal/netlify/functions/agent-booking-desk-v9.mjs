import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { safeDeleteBooking, safeDeleteCasting } from './_lib/calendar-safe-delete.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
const group=(list,key)=>{const m=new Map();for(const x of list){const k=x[key];if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;};
const n=v=>v===''||v==null?null:Number(v);
const cleanIds=a=>Array.from(new Set((Array.isArray(a)?a:[]).filter(Boolean)));
const BOOKING_STATUSES=new Set(['inquiry','casting','callback','option','hold','confirmed','fitting','job','completed','cancelled','invoice_pending','invoiced','client_paid','model_payable','model_paid','closed']);
const CASTING_STATUSES=new Set(['draft','open','submitted','callback','closed','cancelled']);
function normKey(v){return String(v||'').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function normalizeBookingStatus(v,body={}){const k=normKey(v)||'inquiry';if(BOOKING_STATUSES.has(k))return k;const map={draft:'inquiry',tentative:'option',scheduled:body.confirmed?'confirmed':'option',open:'inquiry',active:'job',pending:'option',complete:'completed',canceled:'cancelled'};const out=map[k]||'inquiry';return BOOKING_STATUSES.has(out)?out:'inquiry';}
function normalizeCastingStatus(v){const k=normKey(v)||'draft';if(CASTING_STATUSES.has(k))return k;const map={tentative:'draft',scheduled:'open',confirmed:'open',active:'open',pending:'draft',completed:'closed',complete:'closed',canceled:'cancelled'};const out=map[k]||'draft';return CASTING_STATUSES.has(out)?out:'draft';}


function rpcUnavailable(error){
  const code=String(error?.code||'').toUpperCase(),msg=String(error?.message||error||'').toLowerCase();
  return code==='PGRST202'||code==='42883'||msg.includes('could not find the function')||msg.includes('function')&&msg.includes('does not exist')||msg.includes('schema cache');
}
async function replaceLinks(admin,table,organizationId,parentKey,parentId,modelIds,userId,status){
  const ids=cleanIds(modelIds);
  const {error:delError}=await admin.from(table).delete().eq('organization_id',organizationId).eq(parentKey,parentId);
  if(delError)throw delError;
  if(!ids.length)return [];
  const rowsToInsert=ids.map(model_id=>({organization_id:organizationId,[parentKey]:parentId,model_id,status:status||undefined}));
  const {data,error}=await admin.from(table).insert(rowsToInsert).select('*');
  if(error)throw error;
  return data||[];
}
async function fallbackSaveBooking(admin,organizationId,userId,action,bookingId,payload,modelIds,rate,usage){
  let booking;
  if(action==='create_booking'){
    booking=await one(admin.from('bookings').insert(payload).select('*').single());
  }else{
    booking=await one(admin.from('bookings').update(payload).eq('organization_id',organizationId).eq('id',bookingId).select('*').single());
  }
  if(!booking?.id)throw new Error('Booking fallback write did not return a saved record.');
  const links=await replaceLinks(admin,'booking_models',organizationId,'booking_id',booking.id,modelIds,userId,'confirmed');
  let rates=[],usageRows=[];
  if(rate){
    const {error:rd}=await admin.from('booking_rates').delete().eq('organization_id',organizationId).eq('booking_id',booking.id);if(rd)throw rd;
    const row={organization_id:organizationId,booking_id:booking.id,model_id:cleanIds(modelIds)[0]||null,rate_type:'flat',quantity:rate.quantity||1,unit_amount:rate.unit_amount,currency:rate.currency||'USD',agency_fee_rate:rate.agency_fee_rate,notes:rate.notes||null,metadata:rate.metadata||{}};
    const {data,error}=await admin.from('booking_rates').insert(row).select('*');if(error)throw error;rates=data||[];
  }
  if(usage){
    const {error:ud}=await admin.from('booking_usage_terms').delete().eq('organization_id',organizationId).eq('booking_id',booking.id);if(ud)throw ud;
    const row={organization_id:organizationId,booking_id:booking.id,notes:usage.notes||null,currency:usage.currency||'USD',media:usage.media||[],territories:usage.territories||[],competitor_categories:usage.competitor_categories||[]};
    const {data,error}=await admin.from('booking_usage_terms').insert(row).select('*');if(error)throw error;usageRows=data||[];
  }
  const verify=await one(admin.from('bookings').select('*').eq('organization_id',organizationId).eq('id',booking.id).single());
  const verifyLinks=await rows(admin.from('booking_models').select('model_id').eq('organization_id',organizationId).eq('booking_id',booking.id));
  const requested=cleanIds(modelIds).sort(),actual=cleanIds(verifyLinks.map(x=>x.model_id)).sort();
  if(!verify||requested.join('|')!==actual.join('|'))throw new Error('Booking fallback save could not be verified after write.');
  return {verified:true,booking:verify,model_ids:actual,rates,usage:usageRows,persisted_at:verify.updated_at||verify.created_at||new Date().toISOString(),fallback:true};
}
async function fallbackSaveCasting(admin,organizationId,userId,action,castingId,payload,modelIds){
  let casting;
  if(action==='create_casting')casting=await one(admin.from('castings').insert(payload).select('*').single());
  else casting=await one(admin.from('castings').update(payload).eq('organization_id',organizationId).eq('id',castingId).select('*').single());
  if(!casting?.id)throw new Error('Casting fallback write did not return a saved record.');
  await replaceLinks(admin,'casting_models',organizationId,'casting_id',casting.id,modelIds,userId,'requested');
  const verify=await one(admin.from('castings').select('*').eq('organization_id',organizationId).eq('id',casting.id).single());
  const verifyLinks=await rows(admin.from('casting_models').select('model_id').eq('organization_id',organizationId).eq('casting_id',casting.id));
  const requested=cleanIds(modelIds).sort(),actual=cleanIds(verifyLinks.map(x=>x.model_id)).sort();
  if(!verify||requested.join('|')!==actual.join('|'))throw new Error('Casting fallback save could not be verified after write.');
  return {verified:true,casting:verify,model_ids:actual,persisted_at:verify.updated_at||verify.created_at||new Date().toISOString(),fallback:true};
}

async function notifyBookingState(admin,organizationId,booking,modelIds,changeKind='updated',changedFields=[]){
  const ids=cleanIds(modelIds); if(!booking||!ids.length)return;
  const modelLinks=await rows(admin.from('model_user_links').select('model_id,user_id').eq('organization_id',organizationId).in('model_id',ids));
  const placements=await rows(admin.from('model_placements').select('model_id,partner_agency_id,status').eq('organization_id',organizationId).in('model_id',ids).in('status',['active','pending','placed']));
  const partnerIds=[...new Set(placements.map(x=>x.partner_agency_id).filter(Boolean))];
  const partnerLinks=partnerIds.length?await rows(admin.from('partner_user_links').select('partner_agency_id,user_id').eq('organization_id',organizationId).in('partner_agency_id',partnerIds)):[];
  const modelUsers=[...new Set(modelLinks.map(x=>x.user_id).filter(Boolean))];
  const partnerUsers=[...new Set(partnerLinks.map(x=>x.user_id).filter(Boolean))];
  const when=booking.call_time||booking.starts_at;
  const call=when?new Date(when).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:booking.timezone||undefined}):null;
  const payment=booking.metadata?.payment_status||null;
  const changed=Array.isArray(changedFields)&&changedFields.length?changedFields.join(', '):null;
  const detail=[changed&&`Changed: ${changed}`,call&&`Call ${call}`,booking.location,payment&&`Payment: ${payment}`].filter(Boolean).join(' · ');
  const meta={booking_id:booking.id,change_kind:changeKind,changed_fields:Array.isArray(changedFields)?changedFields:[],requires_ack:true,revision_at:new Date().toISOString(),due_at:booking.call_time||booking.starts_at||null};
  const notifications=[
    ...modelUsers.map(user_id=>({organization_id:organizationId,user_id,notification_type:'booking_shared_state',title:`Booking ${changeKind}: ${booking.title||'Agency booking'}`,body:detail||'Open your Bookings desk for the latest call sheet and booking details.',channel:'in_app',status:'delivered',source_type:'booking',source_id:booking.id,action_url:'?page=bookings',metadata:meta})),
    ...partnerUsers.map(user_id=>({organization_id:organizationId,user_id,notification_type:'booking_shared_state',title:`Booking ${changeKind}: ${booking.title||'Agency booking'}`,body:detail||'Open the Mother Agency Bookings desk for the latest partner-visible booking details.',channel:'in_app',status:'delivered',source_type:'booking',source_id:booking.id,action_url:'?page=bookings',metadata:meta}))
  ];
  if(notifications.length){const {error}=await admin.from('notifications').insert(notifications);if(error)throw error;}
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
    if(event.httpMethod==='POST'){
      const admin=await requirePermission(user.id,organization.id,'bookings.write');const action=String(body.action||'');
      if(action==='change_status'){
        const {data,error}=await client.rpc('change_booking_status',{target_org:organization.id,target_booking:body.booking_id,target_status:normalizeBookingStatus(body.status,body),change_reason:body.reason||null});if(error)throw error;return json(200,{ok:true,booking:data});
      }
      if(action==='release_option'){
        const {data,error}=await admin.from('booking_options').update({status:'released',released_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('id',body.option_id).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,option:data,persisted_at:data?.updated_at||new Date().toISOString()});
      }
      if(action==='set_casting_model_status'){
        if(!body.casting_model_id||!body.status)return json(400,{error:'casting_model_id and status are required'});
        const {data,error}=await admin.from('casting_models').update({status:body.status,response_at:['declined','confirmed','attended','no_show'].includes(body.status)?new Date().toISOString():null,feedback:body.feedback||undefined,internal_notes:body.internal_notes||undefined}).eq('organization_id',organization.id).eq('id',body.casting_model_id).select('*').single();if(error)throw error;return json(200,{ok:true,casting_model:data});
      }
      if(action==='set_booking_model_status'){
        if(!body.booking_model_id||!body.status)return json(400,{error:'booking_model_id and status are required'});
        const {data,error}=await admin.from('booking_models').update({status:body.status,response_at:['accepted','declined','confirmed','completed','cancelled','released'].includes(body.status)?new Date().toISOString():null,notes:body.notes||undefined}).eq('organization_id',organization.id).eq('id',body.booking_model_id).select('*').single();if(error)throw error;return json(200,{ok:true,booking_model:data});
      }
      if(action==='create_option'){
        if(!body.booking_id||!body.model_id)return json(400,{error:'booking_id and model_id are required'});
        const {data,error}=await admin.from('booking_options').insert({organization_id:organization.id,booking_id:body.booking_id,model_id:body.model_id,priority:Number(body.priority||1),status:'active',starts_at:body.starts_at||null,ends_at:body.ends_at||null,expires_at:body.expires_at||null,notes:body.notes||null,created_by:user.id}).select('*').single();if(error)throw error;return json(200,{ok:true,option:data});
      }
      if(action==='convert_casting_model'){
        if(!body.casting_model_id)return json(400,{error:'casting_model_id is required'});
        const {data:saved,error:saveError}=await admin.rpc('convert_casting_model_to_booking_v1',{target_org:organization.id,target_casting_model:body.casting_model_id,target_payload:{booking_status:body.booking_status||'option',title:body.title||null,job_type:body.job_type||null,starts_at:body.starts_at||null,ends_at:body.ends_at||null,notes:body.notes||null,currency:(body.currency||'USD').slice(0,3).toUpperCase(),priority:Number(body.priority||1),expires_at:body.expires_at||null},target_user:user.id});
        if(saveError)throw saveError;
        if(saved?.verified!==true){const e=new Error('Casting conversion could not be verified');e.statusCode=409;throw e;}
        return json(200,{ok:true,verified:true,booking:saved.booking,booking_option:saved.booking_option||null,persisted_at:saved.persisted_at});
      }

      if(action==='move_booking'){
        if(!body.booking_id||!body.starts_at)return json(400,{error:'booking_id and starts_at are required'});
        const current=await one(admin.from('bookings').select('id,starts_at,ends_at,call_time,wrap_time,metadata').eq('organization_id',organization.id).eq('id',body.booking_id).single());
        const oldStart=current?.starts_at?new Date(current.starts_at):null,newStart=new Date(body.starts_at);if(!oldStart||isNaN(newStart))return json(400,{error:'Invalid booking date/time'});
        const delta=newStart-oldStart,patch={starts_at:newStart.toISOString(),updated_at:new Date().toISOString()};
        if(current.ends_at)patch.ends_at=new Date(new Date(current.ends_at).getTime()+delta).toISOString();
        if(current.call_time)patch.call_time=new Date(new Date(current.call_time).getTime()+delta).toISOString();
        if(current.wrap_time)patch.wrap_time=new Date(new Date(current.wrap_time).getTime()+delta).toISOString();
        patch.metadata={...(current.metadata||{}),calendar_dragged_at:new Date().toISOString(),calendar_dragged_by:user.id};
        const booking=await one(admin.from('bookings').update(patch).eq('organization_id',organization.id).eq('id',body.booking_id).select('*').single());
        return json(200,{ok:true,booking,moved:true});
      }
      if(action==='move_casting'){
        if(!body.casting_id||!body.starts_at)return json(400,{error:'casting_id and starts_at are required'});
        const current=await one(admin.from('castings').select('id,starts_at,ends_at,deadline_at,metadata').eq('organization_id',organization.id).eq('id',body.casting_id).single());
        const oldStart=current?.starts_at?new Date(current.starts_at):null,newStart=new Date(body.starts_at);if(!oldStart||isNaN(newStart))return json(400,{error:'Invalid casting date/time'});
        const delta=newStart-oldStart,patch={starts_at:newStart.toISOString(),updated_at:new Date().toISOString()};
        if(current.ends_at)patch.ends_at=new Date(new Date(current.ends_at).getTime()+delta).toISOString();
        if(current.deadline_at)patch.deadline_at=new Date(new Date(current.deadline_at).getTime()+delta).toISOString();
        patch.metadata={...(current.metadata||{}),calendar_dragged_at:new Date().toISOString(),calendar_dragged_by:user.id};
        const casting=await one(admin.from('castings').update(patch).eq('organization_id',organization.id).eq('id',body.casting_id).select('*').single());
        return json(200,{ok:true,casting,moved:true});
      }
      if(action==='create_booking'||action==='update_booking'){
        if(body.paid===true&&!body.company_id)return json(400,{error:'Paid bookings require a Client / Brand so the invoice can be created automatically.',code:'PAID_BOOKING_CLIENT_REQUIRED'});
        const handoff=body.booker_handoff&&typeof body.booker_handoff==='object'?body.booker_handoff:{};
        const payload={organization_id:organization.id,title:body.title,job_type:body.category||body.job_type||null,status:normalizeBookingStatus(body.status,body),starts_at:body.starts_at||null,ends_at:body.ends_at||null,call_time:body.call_time||null,wrap_time:body.wrap_time||null,timezone:body.timezone||null,location:body.location||null,company_id:body.company_id||null,primary_contact_id:body.contact_id||null,casting_director_contact_id:body.contact_id||null,market_id:body.market_id||null,assigned_member_id:body.assigned_member_id||null,internal_notes:body.notes||null,travel_required:!!body.travel_required,visa_required:!!body.visa_required,currency:(body.currency||'USD').slice(0,3).toUpperCase(),metadata:{pipeline_stage:body.pipeline_stage||null,payment_status:body.payment_status||null,repeat:body.repeat||null,calendar_event_type:body.calendar_event_type||body.category||body.job_type||null,confirmed:!!body.confirmed,paid:!!body.paid,booker_handoff:handoff,shared_state_updated_at:new Date().toISOString()}};
        let changedFields=[];
        if(action==='create_booking')changedFields=['New booking'];
        else {
          const current=await one(admin.from('bookings').select('title,status,starts_at,ends_at,call_time,wrap_time,location,metadata').eq('organization_id',organization.id).eq('id',body.booking_id).single());
          const before=current||{}; const labels={title:'Title',status:'Agency status',starts_at:'Job start',ends_at:'Job end',call_time:'Call time',wrap_time:'Wrap time',location:'Location'};
          Object.keys(labels).forEach(function(k){if(String(before[k]||'')!==String(payload[k]||''))changedFields.push(labels[k]);});
          if(String(before.metadata?.payment_status||'')!==String(payload.metadata?.payment_status||''))changedFields.push('Payment status');
          if(body.usage_rights!=null)changedFields.push('Usage');
          payload.metadata={...(current?.metadata||{}),...(payload.metadata||{}),shared_state_changed_fields:changedFields};
        }
        const amount=n(body.rate_amount),fee=n(body.agency_commission_pct);
        const rate=amount==null?null:{unit_amount:amount,quantity:1,currency:(body.currency||'USD').slice(0,3).toUpperCase(),agency_fee_rate:fee==null?null:fee/100,notes:body.rate_note||null,metadata:{raw_rate:body.rate_text||null}};
        const usage=body.usage_rights?{notes:body.usage_rights,currency:(body.currency||'USD').slice(0,3).toUpperCase(),media:[],territories:[],competitor_categories:[]}:null;
        let saved=null;
        const rpcResult=await admin.rpc('save_booking_full_v1',{target_org:organization.id,target_booking:action==='update_booking'?body.booking_id:null,target_payload:payload,target_model_ids:cleanIds(body.model_ids),target_rate:rate,target_usage:usage,target_user:user.id});
        if(rpcResult.error){
          if(!rpcUnavailable(rpcResult.error))throw rpcResult.error;
          saved=await fallbackSaveBooking(admin,organization.id,user.id,action,body.booking_id,payload,body.model_ids,rate,usage);
        }else saved=rpcResult.data;
        if(!saved?.verified||!saved?.booking){const e=new Error('Booking save could not be verified.');e.statusCode=500;e.publicMessage='Booking was not confirmed as saved. Please retry.';throw e;}
        let booking=saved.booking;
        // New model assignments are requests until the model answers. Existing accepted/declined/hold responses are preserved by save_booking_full_v1.
        if(body.model_response_required!==false){
          const ids=cleanIds(body.model_ids);
          if(ids.length){
            const {error:requestError}=await admin.from('booking_models').update({status:'requested',updated_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('booking_id',booking.id).in('model_id',ids).eq('status','confirmed').is('response_at',null);
            if(requestError)throw requestError;
          }
        }
        let auto_invoice=null,invoice_warning=null;
        if(body.paid===true){
          try{
            const {data:invoiceData,error:invoiceError}=await client.rpc('ensure_booking_invoice_v1',{target_org:organization.id,target_booking:booking.id,target_due_date:body.invoice_due_date||null,target_notes:'Automatically created from paid calendar booking'});
            if(invoiceError)throw invoiceError;
            auto_invoice=invoiceData||null;
            const reread=await one(admin.from('bookings').select('*').eq('organization_id',organization.id).eq('id',booking.id).single());
            if(reread)booking=reread;
          }catch(e){invoice_warning='Paid booking saved, but the draft invoice could not be created: '+(e.message||String(e));}
        }
        let notification_warning=null;try{await notifyBookingState(admin,organization.id,booking,body.model_ids,action==='create_booking'?'created':'updated',changedFields);}catch(e){notification_warning='Booking saved, but one or more portal notifications could not be delivered.';}
        const warnings=[notification_warning,invoice_warning].filter(Boolean);
        return json(action==='create_booking'?201:200,{ok:true,verified:true,persisted_at:saved.persisted_at,booking,model_ids:saved.model_ids,rates:saved.rates,usage:saved.usage,auto_invoice,warnings,warning:warnings[0]||null});
      }
      if(action==='delete_booking'){const result=await safeDeleteBooking(admin,organization.id,body.booking_id);return json(200,{ok:true,verified:result?.verified===true,deleted:'booking',booking_id:body.booking_id,persisted_at:new Date().toISOString()});}
      if(action==='create_casting'||action==='update_casting'){
        const handoff=body.booker_handoff&&typeof body.booker_handoff==='object'?body.booker_handoff:{};
        const payload={organization_id:organization.id,title:body.title,status:normalizeCastingStatus(body.status),casting_type:body.casting_type||'in_person',starts_at:body.starts_at||null,ends_at:body.ends_at||null,deadline_at:body.deadline_at||null,timezone:body.timezone||null,location:body.location||null,company_id:body.company_id||null,primary_contact_id:body.contact_id||null,casting_director_contact_id:body.contact_id||null,market_id:body.market_id||null,assigned_member_id:body.assigned_member_id||null,brief:body.notes||null,rate_note:body.rate_text||null,usage_note:body.usage_rights||null,requires_self_tape:!!body.requires_self_tape,requires_walk_video:!!body.requires_walk_video,requires_digitals:!!body.requires_digitals,metadata:{pipeline_stage:body.pipeline_stage||null,repeat:body.repeat||null,calendar_event_type:body.calendar_event_type||body.category||'Casting',pay_amount:Number.isFinite(Number(body.rate_amount))?Number(body.rate_amount):null,currency:String(body.currency||'USD').slice(0,3).toUpperCase(),booker_handoff:handoff}};
        let saved=null;
        const rpcResult=await admin.rpc('save_casting_full_v1',{target_org:organization.id,target_casting:action==='update_casting'?body.casting_id:null,target_payload:payload,target_model_ids:cleanIds(body.model_ids),target_user:user.id});
        if(rpcResult.error){
          if(!rpcUnavailable(rpcResult.error))throw rpcResult.error;
          saved=await fallbackSaveCasting(admin,organization.id,user.id,action,body.casting_id,payload,body.model_ids);
        }else saved=rpcResult.data;
        if(!saved?.verified||!saved?.casting){const e=new Error('Casting save could not be verified.');e.statusCode=500;e.publicMessage='Casting was not confirmed as saved. Please retry.';throw e;}
        return json(action==='create_casting'?201:200,{ok:true,verified:true,persisted_at:saved.persisted_at,casting:saved.casting,model_ids:saved.model_ids});
      }
      if(action==='delete_casting'){const result=await safeDeleteCasting(admin,organization.id,body.casting_id);return json(200,{ok:true,verified:result?.verified===true,deleted:'casting',casting_id:body.casting_id,persisted_at:new Date().toISOString()});}
      return json(400,{error:'Unsupported booking action'});
    }
    const admin=await requirePermission(user.id,organization.id,'bookings.read');
    const [bookings,castings,bookingModels,castingModels,rates,usage,options,risks,blocks,requests,models,modelPrimaryMedia,companies,contacts,markets,members,profiles]=await Promise.all([
      rows(admin.from('bookings').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(500)),
      rows(admin.from('castings').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(500)),
      rows(admin.from('booking_models').select('*').eq('organization_id',organization.id).limit(2000)),rows(admin.from('casting_models').select('*').eq('organization_id',organization.id).limit(2000)),
      rows(admin.from('booking_rates').select('*').eq('organization_id',organization.id).limit(2000)),rows(admin.from('booking_usage_terms').select('*').eq('organization_id',organization.id).limit(2000)),
      rows(admin.from('booking_options').select('*').eq('organization_id',organization.id).in('status',['active','challenged']).order('expires_at',{ascending:true}).limit(500)),rows(admin.from('booking_risk_snapshots').select('*').eq('organization_id',organization.id).order('checked_at',{ascending:false}).limit(1000)),
      rows(admin.from('availability_blocks').select('*').eq('organization_id',organization.id).eq('status','approved').order('starts_at',{ascending:true}).limit(500)),rows(admin.from('availability_requests').select('*').eq('organization_id',organization.id).eq('status','pending').order('starts_at',{ascending:true}).limit(300)),
      rows(admin.from('models').select('id,display_name,public_slug,primary_market_label,status').eq('organization_id',organization.id).limit(1000)),rows(admin.from('model_media').select('model_id,url,is_primary,media_type').eq('organization_id',organization.id).eq('is_primary',true).eq('media_type','image').limit(1500)),rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).order('name').limit(1000)),rows(admin.from('contacts').select('id,first_name,last_name,display_name,email,company_id,role').eq('organization_id',organization.id).order('display_name').limit(1500)),rows(admin.from('markets').select('id,name,code,city').eq('organization_id',organization.id).eq('active',true).order('name').limit(200)),rows(admin.from('organization_members').select('id,user_id,member_type,job_title,status').eq('organization_id',organization.id).eq('status','active').eq('member_type','staff').limit(500)),rows(admin.from('profiles').select('user_id,display_name,first_name,last_name').limit(1500))
    ]);
    const primaryPhotoMap=new Map(modelPrimaryMedia.filter(x=>x?.model_id&&x?.url).map(x=>[x.model_id,x.url]));const modelRows=models.map(x=>({...x,avatar_url:primaryPhotoMap.get(x.id)||null}));const mm=new Map(modelRows.map(x=>[x.id,x])),cm=new Map(companies.map(x=>[x.id,x])),pm=new Map(profiles.map(x=>[x.user_id,x]));const staff=members.filter(m=>/(founder|owner|director|booker|agent)/i.test(String(m.job_title||''))).map(m=>{const p=pm.get(m.user_id)||{};return {...m,display_name:p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||m.job_title||'Agency Team'};});const bm=group(bookingModels,'booking_id'),crm=group(castingModels,'casting_id'),rr=group(rates,'booking_id'),uu=group(usage,'booking_id'),oo=group(options,'booking_id'),rk=group(risks,'booking_id');
    const bookingRows=bookings.map(b=>({...b,companies:cm.get(b.company_id)||null,booking_models:(bm.get(b.id)||[]).map(x=>({...x,models:mm.get(x.model_id)||null})),booking_rates:rr.get(b.id)||[],booking_usage_terms:uu.get(b.id)||[],booking_options:oo.get(b.id)||[],booking_risk_snapshots:rk.get(b.id)||[]}));
    const castingRows=castings.map(c=>({...c,companies:cm.get(c.company_id)||null,casting_models:(crm.get(c.id)||[]).map(x=>({...x,models:mm.get(x.model_id)||null}))}));
    const optionRows=options.map(o=>({...o,models:mm.get(o.model_id)||null,bookings:(()=>{const b=bookings.find(x=>x.id===o.booking_id);return b?{id:b.id,title:b.title,status:b.status,starts_at:b.starts_at,ends_at:b.ends_at,company_id:b.company_id,companies:cm.get(b.company_id)||null}:null;})()}));
    return json(200,{environment:'veux-desk-v16.8.1-calendar-form-polish',organization,bookings:bookingRows,castings:castingRows,options:optionRows,availability_blocks:blocks.map(x=>({...x,models:mm.get(x.model_id)||null})),availability_requests:requests.map(x=>({...x,models:mm.get(x.model_id)||null})),lookups:{models:modelRows,companies,contacts,markets,members:staff}});
  }catch(error){return errorResponse(error);}
};
