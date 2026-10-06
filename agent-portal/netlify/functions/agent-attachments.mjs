import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

/* Files on calendar records (bookings / events / castings) and Call Sheets on Model 360.
   Files are uploaded through the existing secure pipeline (/api/storage/upload-url + finalize).
   This function links them: to the record (document_links, falling back to the record's
   metadata when the link type is rejected) and, when asked, to each assigned model so the
   model sees them in the Model Portal. */

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
const RESOURCES={
  booking:{table:'bookings',links:'booking_models',fk:'booking_id'},
  event:{table:'events',links:'event_models',fk:'event_id'},
  casting:{table:'castings',links:'casting_models',fk:'casting_id'}
};
const bad=(msg,code=400)=>{const e=new Error(msg);e.statusCode=code;e.publicMessage=msg;return e;};
const resourceOf=type=>{const r=RESOURCES[String(type||'').toLowerCase()];if(!r)throw bad('resource_type must be booking, event or casting.');return r;};

async function assignedModels(admin,organizationId,res,id){
  const links=await rows(admin.from(res.links).select('model_id').eq('organization_id',organizationId).eq(res.fk,id));
  return [...new Set(links.map(x=>x.model_id).filter(Boolean))];
}
async function notifyModel(admin,organizationId,modelId,doc,title,body){
  const {data:link,error}=await admin.from('model_user_links').select('user_id').eq('organization_id',organizationId).eq('model_id',modelId).maybeSingle();
  if(error||!link?.user_id)return;
  await admin.from('notifications').insert({organization_id:organizationId,user_id:link.user_id,notification_type:'document_shared_state',title,body,channel:'in_app',status:'delivered',source_type:'document',source_id:doc.id,action_url:'?page=documents',metadata:{model_id:modelId,requires_ack:true,revision_at:new Date().toISOString()}});
}
/* Make `documentId` visible on a model's own Documents list (and notify once). */
async function shareToModel(admin,organizationId,modelId,doc,{relationship='attachment',title,body}={}){
  const {data:existing,error}=await admin.from('document_links').select('id,visible_to_model').eq('organization_id',organizationId).eq('resource_type','model').eq('resource_id',modelId).eq('document_id',doc.id).maybeSingle();
  if(error)throw error;
  let newlyVisible=false;
  if(existing){
    if(!existing.visible_to_model){const up=await admin.from('document_links').update({visible_to_model:true}).eq('id',existing.id);if(up.error)throw up.error;newlyVisible=true;}
  }else{
    let ins=await admin.from('document_links').insert({organization_id:organizationId,document_id:doc.id,resource_type:'model',resource_id:modelId,relationship,visible_to_model:true,visible_to_partner:false});
    if(ins.error&&relationship!=='attachment')ins=await admin.from('document_links').insert({organization_id:organizationId,document_id:doc.id,resource_type:'model',resource_id:modelId,relationship:'attachment',visible_to_model:true,visible_to_partner:false});
    if(ins.error)throw ins.error;newlyVisible=true;
  }
  if(newlyVisible){try{await notifyModel(admin,organizationId,modelId,doc,title||`Document shared: ${doc.name||'Agency document'}`,body||'A new secure document is available. Open Documents to review it.');}catch(_e){}}
}
async function ownDocument(admin,organizationId,id){
  const {data,error}=await admin.from('documents').select('*').eq('organization_id',organizationId).eq('id',id).maybeSingle();
  if(error)throw error;if(!data)throw bad('Document not found.',404);return data;
}
const clean=(v,n)=>String(v==null?'':v).trim().slice(0,n);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const needId=(v,label)=>{const x=clean(v,80);if(!UUID.test(x))throw bad(`${label} is not a valid id.`);return x;};

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,event.httpMethod==='GET'?'documents.read':'documents.write');

    /* ---------------- reads ---------------- */
    if(event.httpMethod==='GET'){
      if(p.model_id&&p.call_sheets){needId(p.model_id,'model_id');
        const links=await rows(admin.from('document_links').select('id,document_id,relationship,visible_to_model,visible_to_partner,created_at,documents(*)').eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',p.model_id).order('created_at',{ascending:false}).limit(300));
        const sheets=links.filter(l=>l.documents&&l.documents.status!=='archived'&&(l.relationship==='call_sheet'||String(l.documents.category||'').toLowerCase()==='call-sheet'));
        const ids=sheets.map(l=>l.document_id);
        const bookingLinks=ids.length?await rows(admin.from('document_links').select('document_id,resource_id').eq('organization_id',organization.id).eq('resource_type','booking').in('document_id',ids)):[];
        const bookingIds=[...new Set(bookingLinks.map(x=>x.resource_id))];
        const bookings=bookingIds.length?await rows(admin.from('bookings').select('id,title,starts_at').eq('organization_id',organization.id).in('id',bookingIds)):[];
        const bMap=new Map(bookings.map(b=>[b.id,b]));
        return json(200,{ok:true,organization:{id:organization.id},call_sheets:sheets.map(l=>{const d=l.documents,m=(d.metadata&&typeof d.metadata==='object')?d.metadata:{},bl=bookingLinks.find(x=>x.document_id===l.document_id);return {link_id:l.id,document_id:d.id,name:d.name,mime_type:d.mime_type,size_bytes:d.size_bytes,created_at:d.created_at,visible_to_model:!!l.visible_to_model,title:m.title||null,shoot_date:m.shoot_date||null,call_time:m.call_time||null,location:m.location||null,notes:m.notes||null,booking:bl?(bMap.get(bl.resource_id)||{id:bl.resource_id}):null};})});
      }
      const res=resourceOf(p.resource_type),id=needId(p.resource_id,'resource_id');
      const links=await rows(admin.from('document_links').select('id,document_id,visible_to_model,created_at,documents(*)').eq('organization_id',organization.id).eq('resource_type',p.resource_type).eq('resource_id',id).order('created_at',{ascending:false}).limit(100));
      const out=links.filter(l=>l.documents&&l.documents.status!=='archived').map(l=>({link_id:l.id,document_id:l.documents.id,name:l.documents.name,mime_type:l.documents.mime_type,size_bytes:l.documents.size_bytes,category:l.documents.category,created_at:l.documents.created_at,shared_with_models:!!l.visible_to_model,source:'link'}));
      try{
        const {data:rec}=await admin.from(res.table).select('metadata').eq('organization_id',organization.id).eq('id',id).maybeSingle();
        const docs=Array.isArray(rec?.metadata?.documents)?rec.metadata.documents:[];
        for(const d of docs)if(d&&d.id&&!out.some(x=>String(x.document_id)===String(d.id)))out.push({link_id:null,document_id:d.id,name:d.name||'Document',mime_type:'application/pdf',size_bytes:null,category:'attachment',created_at:d.uploaded_at||null,shared_with_models:!!d.shared,source:'metadata'});
      }catch(_e){}
      const models=await assignedModels(admin,organization.id,res,id);
      return json(200,{ok:true,organization:{id:organization.id},documents:out,model_ids:models});
    }

    /* ---------------- writes ---------------- */
    const action=String(body.action||'');

    if(action==='link'){
      const res=resourceOf(body.resource_type),id=needId(body.resource_id,'resource_id');
      const docs=(Array.isArray(body.documents)?body.documents:[]).filter(d=>d&&UUID.test(String(d.id))).slice(0,20);
      if(!docs.length)throw bad('At least one valid document is required.');
      const {data:rec,error:re}=await admin.from(res.table).select('id,title,metadata').eq('organization_id',organization.id).eq('id',id).maybeSingle();if(re)throw re;if(!rec)throw bad('That calendar record was not found.',404);
      const share=body.share_with_models===true,modelIds=await assignedModels(admin,organization.id,res,id);
      let useMetadata=false;
      for(const d of docs){
        const doc=await ownDocument(admin,organization.id,d.id);
        const ex=await admin.from('document_links').select('id').eq('organization_id',organization.id).eq('resource_type',body.resource_type).eq('resource_id',id).eq('document_id',doc.id).maybeSingle();
        if(!ex.data){
          const ins=await admin.from('document_links').insert({organization_id:organization.id,document_id:doc.id,resource_type:body.resource_type,resource_id:id,relationship:'attachment',visible_to_model:share,visible_to_partner:false});
          if(ins.error){console.warn('[attachments] document_links rejected, using record metadata:',ins.error.message);useMetadata=true;}
        }
        if(share)for(const m of modelIds)await shareToModel(admin,organization.id,m,doc,{title:`New file on: ${rec.title||body.resource_type}`,body:`${doc.name||'A file'} was attached to ${rec.title||'a booking'}. Open Documents to view it.`});
      }
      if(useMetadata){
        const meta=rec.metadata&&typeof rec.metadata==='object'?{...rec.metadata}:{},list=Array.isArray(meta.documents)?meta.documents.slice():[];
        for(const d of docs)if(!list.some(x=>String(x.id)===String(d.id)))list.push({id:String(d.id),name:clean(d.name,200)||'Document',uploaded_at:new Date().toISOString(),shared:share});
        meta.documents=list;const up=await admin.from(res.table).update({metadata:meta}).eq('organization_id',organization.id).eq('id',id);
        if(up.error)throw bad('The file uploaded but could not be attached: '+clean(up.error.message,160),500);
      }
      return json(200,{ok:true,verified:true,attached:docs.length,shared_with:share?modelIds.length:0,via:useMetadata?'metadata':'links',persisted_at:new Date().toISOString()});
    }

    if(action==='unlink'){
      const res=resourceOf(body.resource_type),id=needId(body.resource_id,'resource_id'),docId=needId(body.document_id,'document_id');
      await admin.from('document_links').delete().eq('organization_id',organization.id).eq('resource_type',body.resource_type).eq('resource_id',id).eq('document_id',docId);
      const {data:rec}=await admin.from(res.table).select('metadata').eq('organization_id',organization.id).eq('id',id).maybeSingle();
      if(rec&&Array.isArray(rec.metadata?.documents)&&rec.metadata.documents.some(x=>String(x.id)===docId)){
        await admin.from(res.table).update({metadata:{...rec.metadata,documents:rec.metadata.documents.filter(x=>String(x.id)!==docId)}}).eq('organization_id',organization.id).eq('id',id);
      }
      return json(200,{ok:true,verified:true,removed:true});
    }

    if(action==='share'){
      const res=resourceOf(body.resource_type),id=needId(body.resource_id,'resource_id'),docId=needId(body.document_id,'document_id'),share=body.share!==false;
      const doc=await ownDocument(admin,organization.id,docId),modelIds=await assignedModels(admin,organization.id,res,id);
      await admin.from('document_links').update({visible_to_model:share}).eq('organization_id',organization.id).eq('resource_type',body.resource_type).eq('resource_id',id).eq('document_id',docId);
      if(share)for(const m of modelIds)await shareToModel(admin,organization.id,m,doc);
      else for(const m of modelIds)await admin.from('document_links').update({visible_to_model:false}).eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',m).eq('document_id',docId);
      return json(200,{ok:true,verified:true,shared:share,models:modelIds.length});
    }

    if(action==='call_sheet'){
      const docId=needId(body.document_id,'document_id'),modelIds=[...new Set((Array.isArray(body.model_ids)?body.model_ids:[]).map(String).filter(x=>UUID.test(x)))].slice(0,60);if(!modelIds.length)throw bad('Choose at least one model for this call sheet.');
      const doc=await ownDocument(admin,organization.id,docId);
      const title=clean(body.title,160)||doc.name||'Call sheet',shootDate=clean(body.shoot_date,10)||null,callTime=clean(body.call_time,40)||null,location=clean(body.location,240)||null,notes=clean(body.notes,1500)||null,share=body.share!==false;
      const meta={...(doc.metadata&&typeof doc.metadata==='object'?doc.metadata:{}),kind:'call_sheet',title,shoot_date:shootDate,call_time:callTime,location,notes,booking_id:clean(body.booking_id,80)||null};
      const label=['Call sheet',title,shootDate].filter(Boolean).join(' — ');
      let up=await admin.from('documents').update({name:label,category:'call-sheet',metadata:meta}).eq('organization_id',organization.id).eq('id',docId);
      if(up.error)up=await admin.from('documents').update({name:label,category:'call-sheet'}).eq('organization_id',organization.id).eq('id',docId);
      if(up.error)throw up.error;
      const fresh={...doc,name:label};
      for(const m of modelIds){
        const {data:mdl,error:me}=await admin.from('models').select('id').eq('organization_id',organization.id).eq('id',m).maybeSingle();if(me)throw me;if(!mdl)continue;
        const {data:ex}=await admin.from('document_links').select('id').eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',m).eq('document_id',docId).maybeSingle();
        if(ex){
          const upd=await admin.from('document_links').update({relationship:'call_sheet',visible_to_model:share}).eq('id',ex.id);
          if(upd.error)await admin.from('document_links').update({visible_to_model:share}).eq('id',ex.id);
          if(share)try{await notifyModel(admin,organization.id,m,fresh,`Call sheet: ${title}`,`${shootDate?shootDate+' · ':''}${location||'Open Documents to view your call sheet.'}`);}catch(_e){}
        }else if(share){
          await shareToModel(admin,organization.id,m,fresh,{relationship:'call_sheet',title:`Call sheet: ${title}`,body:`${shootDate?shootDate+' · ':''}${location||'Open Documents to view your call sheet.'}`});
        }else{
          let ins=await admin.from('document_links').insert({organization_id:organization.id,document_id:docId,resource_type:'model',resource_id:m,relationship:'call_sheet',visible_to_model:false,visible_to_partner:false});
          if(ins.error)ins=await admin.from('document_links').insert({organization_id:organization.id,document_id:docId,resource_type:'model',resource_id:m,relationship:'attachment',visible_to_model:false,visible_to_partner:false});
          if(ins.error)throw ins.error;
        }
      }
      const bookingId=UUID.test(clean(body.booking_id,80))?clean(body.booking_id,80):'';
      if(bookingId){
        const {data:b}=await admin.from('bookings').select('id').eq('organization_id',organization.id).eq('id',bookingId).maybeSingle();
        if(b){const ex=await admin.from('document_links').select('id').eq('organization_id',organization.id).eq('resource_type','booking').eq('resource_id',bookingId).eq('document_id',docId).maybeSingle();
          if(!ex.data){const ins=await admin.from('document_links').insert({organization_id:organization.id,document_id:docId,resource_type:'booking',resource_id:bookingId,relationship:'attachment',visible_to_model:share,visible_to_partner:false});if(ins.error)console.warn('[call_sheet] booking link skipped:',ins.error.message);}}
      }
      return json(200,{ok:true,verified:true,document_id:docId,models:modelIds.length,shared:share,persisted_at:new Date().toISOString()});
    }

    return json(400,{error:'Unsupported attachments action'});
  }catch(error){return errorResponse(error);}
};
