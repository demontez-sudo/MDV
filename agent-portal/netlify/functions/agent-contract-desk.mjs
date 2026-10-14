import { requireUser, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
function byId(xs){return new Map((xs||[]).map(x=>[String(x.id),x]));}

export const handler=async(event)=>{
 if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event);const body=event.httpMethod==='POST'?parseBody(event):{};
  const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
  const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});
  const admin=await requirePermission(user.id,organization.id,'contracts.read');
  if(event.httpMethod==='GET'){
   const modelId=event.queryStringParameters?.model_id||null;
   let cq=admin.from('contracts').select('*').eq('organization_id',organization.id).order('updated_at',{ascending:false});if(modelId)cq=cq.eq('model_id',modelId);
   const canReadUsage=await assertPermission(admin,user.id,organization.id,'usage.read');
   let uq=admin.from('usage_rights').select('*').eq('organization_id',organization.id).order('ends_on',{ascending:true});if(modelId)uq=uq.eq('model_id',modelId);
   const [contractsRaw,usageRaw,models,companies,partners]=await Promise.all([
    rows(cq.limit(300)),canReadUsage?rows(uq.limit(300)):Promise.resolve([]),
    rows(admin.from('models').select('id,display_name').eq('organization_id',organization.id)),
    rows(admin.from('companies').select('id,name').eq('organization_id',organization.id)),
    rows(admin.from('partner_agencies').select('id,company_id,partner_type').eq('organization_id',organization.id))
   ]);
   const mm=byId(models),cm=byId(companies),pm=byId(partners);
   const partnerView=id=>{const p=id?pm.get(String(id)):null;return p?{...p,name:cm.get(String(p.company_id))?.name||'Partner Agency'}:null;};
   const contracts=contractsRaw.map(x=>({...x,models:x.model_id?mm.get(String(x.model_id))||null:null,companies:x.company_id?cm.get(String(x.company_id))||null:null,partner_agencies:partnerView(x.partner_agency_id)}));
   const usage=usageRaw.map(x=>({...x,models:x.model_id?mm.get(String(x.model_id))||null:null,companies:x.company_id?cm.get(String(x.company_id))||null:null}));
   const contractIds=contracts.map(x=>x.id);
   const [parties,signatures,events]=contractIds.length?await Promise.all([
    rows(admin.from('contract_parties').select('*').eq('organization_id',organization.id).in('contract_id',contractIds).order('signing_order')),
    rows(admin.from('signature_requests').select('*').eq('organization_id',organization.id).in('contract_id',contractIds).order('created_at',{ascending:false})),
    rows(admin.from('contract_events').select('*').eq('organization_id',organization.id).in('contract_id',contractIds).order('occurred_at',{ascending:false}))
   ]):[[],[],[]];
   let signers=[];const reqIds=signatures.map(x=>x.id);if(reqIds.length)signers=await rows(admin.from('signature_signers').select('*').eq('organization_id',organization.id).in('signature_request_id',reqIds).order('signing_order'));
   const signersBy=new Map();for(const s of signers){const k=String(s.signature_request_id);if(!signersBy.has(k))signersBy.set(k,[]);signersBy.get(k).push(s);}const signature_requests=signatures.map(x=>({...x,signature_signers:signersBy.get(String(x.id))||[]}));
   return json(200,{environment:'veux-saas-v13.23-legal-resilient',organization,contracts,parties,signature_requests,contract_events:events,usage_rights:usage,models,companies});
  }
  await requirePermission(user.id,organization.id,'contracts.write');
  const action=String(body.action||'');
  if(action==='upsert_contract'){
   const src=body.contract||{};const id=body.contract_id||null;if(!String(src.title||'').trim()||!String(src.contract_type||'').trim()){const e=new Error('title and contract_type are required');e.statusCode=400;throw e;}
   const allowed=['contract_number','contract_type','title','status','booking_id','model_id','company_id','partner_agency_id','effective_on','expires_on','termination_notice_days','structured_terms','internal_notes'];const payload={organization_id:organization.id,created_by:user.id};for(const k of allowed)if(src[k]!==undefined)payload[k]=src[k]===''?null:src[k];let q=id?admin.from('contracts').update(payload).eq('organization_id',organization.id).eq('id',id):admin.from('contracts').insert(payload);const {data:contract,error}=await q.select('*').single();if(error)throw error;return json(id?200:201,{ok:true,verified:true,contract,persisted_at:contract?.updated_at||contract?.created_at||new Date().toISOString()});
  }
  if(action==='delete_contract'){if(!body.contract_id){const e=new Error('contract_id is required');e.statusCode=400;throw e;}const {data,error}=await admin.from('contracts').delete().eq('organization_id',organization.id).eq('id',body.contract_id).select('id').single();if(error)throw error;return json(200,{ok:true,verified:true,deleted_id:data.id,persisted_at:new Date().toISOString()});}
  if(action==='upsert_usage_right'){await requirePermission(user.id,organization.id,'usage.write');const src=body.usage||{};const id=body.usage_right_id||null;if(!src.model_id){const e=new Error('model_id is required');e.statusCode=400;throw e;}const allowed=['booking_id','contract_id','model_id','company_id','campaign_name','status','starts_on','ends_on','media','territories','competitor_categories','exclusivity_description','fee_amount','currency','renewal_fee_amount','renewal_terms','notes','metadata'];const payload={organization_id:organization.id};for(const k of allowed)if(src[k]!==undefined)payload[k]=src[k]===''?null:src[k];let q=id?admin.from('usage_rights').update(payload).eq('organization_id',organization.id).eq('id',id):admin.from('usage_rights').insert(payload);const {data:usage,error}=await q.select('*').single();if(error)throw error;return json(id?200:201,{ok:true,verified:true,usage_right:usage,persisted_at:usage?.updated_at||usage?.created_at||new Date().toISOString()});}
  if(action==='create_signature_request'){
   const contractId=String(body.contract_id||'');if(!contractId){const e=new Error('contract_id is required');e.statusCode=400;throw e;}
   const {data:saved,error}=await admin.rpc('create_signature_request_v1',{target_org:organization.id,target_contract:contractId,target_provider:body.provider||'veux_sign',target_expires:body.expires_at||null,target_user:user.id,target_delivery:body.delivery||'email'});
   if(error)throw error;if(!saved?.verified||!saved?.signature_request){const e=new Error('Signature request save could not be verified.');e.statusCode=500;throw e;}
   return json(201,{ok:true,verified:true,signature_request:saved.signature_request,signers:saved.signers||[],persisted_at:saved.persisted_at});
  }

  /* The signed PDF (or any contract document) is uploaded through the secure storage flow, then attached here.
     The reference lives in the contract's structured_terms.documents so it travels with the contract. */
  if(action==='attach_contract_document'||action==='remove_contract_document'){
   const contractId=String(body.contract_id||''),documentId=String(body.document_id||'');
   if(!contractId||!documentId){const e=new Error('contract_id and document_id are required');e.statusCode=400;throw e;}
   const {data:contract,error:ce}=await admin.from('contracts').select('id,structured_terms').eq('organization_id',organization.id).eq('id',contractId).maybeSingle();if(ce)throw ce;
   if(!contract){const e=new Error('Contract not found');e.statusCode=404;throw e;}
   const terms=contract.structured_terms&&typeof contract.structured_terms==='object'&&!Array.isArray(contract.structured_terms)?{...contract.structured_terms}:{};
   let docs=Array.isArray(terms.documents)?terms.documents.slice(0,20):[];
   let label=documentId;
   if(action==='attach_contract_document'){
    const {data:doc,error:de}=await admin.from('documents').select('id,name,mime_type,size_bytes,status').eq('organization_id',organization.id).eq('id',documentId).maybeSingle();if(de)throw de;
    if(!doc){const e=new Error('Uploaded document was not found');e.statusCode=404;throw e;}
    label=doc.name||documentId;
    docs=docs.filter(x=>x&&x.id!==doc.id);
    docs.push({id:doc.id,name:doc.name||'Contract.pdf',mime_type:doc.mime_type||null,size_bytes:doc.size_bytes||null,attached_at:new Date().toISOString(),attached_by:user.id});
   }else{
    const hit=docs.find(x=>x&&x.id===documentId);label=hit?.name||documentId;
    docs=docs.filter(x=>x&&x.id!==documentId);
   }
   terms.documents=docs;
   const {data:saved,error:ue}=await admin.from('contracts').update({structured_terms:terms}).eq('organization_id',organization.id).eq('id',contractId).select('*').single();if(ue)throw ue;
   try{await admin.from('contract_events').insert({organization_id:organization.id,contract_id:contractId,event_type:action==='attach_contract_document'?'document_attached':'document_removed',actor_user_id:user.id,note:String(label).slice(0,200)});}catch(_e){/* the history entry is best effort */}
   return json(200,{ok:true,verified:true,contract:saved,documents:docs,persisted_at:saved?.updated_at||new Date().toISOString()});
  }
  /* Add the people who need to sign (name + email) to an existing signature request. */
  if(action==='add_signers'){
   const reqId=String(body.signature_request_id||'');if(!reqId){const e=new Error('signature_request_id is required');e.statusCode=400;throw e;}
   const list=Array.isArray(body.signers)?body.signers.slice(0,10):[];
   const emailRx=/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
   const {data:reqRow,error:re}=await admin.from('signature_requests').select('id,status').eq('organization_id',organization.id).eq('id',reqId).maybeSingle();if(re)throw re;
   if(!reqRow){const e=new Error('Signature request not found');e.statusCode=404;throw e;}
   const existing=await rows(admin.from('signature_signers').select('id,email,signing_order').eq('organization_id',organization.id).eq('signature_request_id',reqId));
   const have=new Set(existing.map(x=>String(x.email||'').toLowerCase()));let order=existing.reduce((m,x)=>Math.max(m,Number(x.signing_order)||0),0);
   const out=[];
   for(const raw of list){
    const email=String(raw&&raw.email||'').trim().toLowerCase(),name=String(raw&&raw.display_name||raw&&raw.name||'').trim().slice(0,120);
    if(!emailRx.test(email)){const e=new Error(`"${email||'(blank)'}" is not a valid email address`);e.statusCode=400;throw e;}
    if(have.has(email))continue;have.add(email);order+=1;
    const {data:row,error:ie}=await admin.from('signature_signers').insert({organization_id:organization.id,signature_request_id:reqId,display_name:name||email,email,status:'pending',signing_order:order}).select('*').single();if(ie)throw ie;
    out.push(row);
   }
   return json(200,{ok:true,verified:true,signers:out,persisted_at:new Date().toISOString()});
  }
  if(action==='record_contract_event'){if(!body.contract_id||!body.event_type){const e=new Error('contract_id and event_type are required');e.statusCode=400;throw e;}const {data:record,error}=await admin.from('contract_events').insert({organization_id:organization.id,contract_id:body.contract_id,event_type:body.event_type,actor_user_id:user.id,actor_label:body.actor_label||null,note:body.note||null,metadata:body.metadata||{}}).select('*').single();if(error)throw error;return json(201,{ok:true,verified:true,event:record,persisted_at:record?.occurred_at||record?.created_at||new Date().toISOString()});}
  if(action==='resolve_usage_conflict'){await requirePermission(user.id,organization.id,'usage.write');const required=['booking_id','model_id','usage_right_id','resolution'];for(const k of required)if(!body[k]){const e=new Error(`${k} is required`);e.statusCode=400;throw e;}const {data:record,error}=await admin.from('usage_conflict_resolutions').upsert({organization_id:organization.id,booking_id:body.booking_id,model_id:body.model_id,usage_right_id:body.usage_right_id,resolution:body.resolution,resolved_by:user.id,note:body.note||null,metadata:body.metadata||{}},{onConflict:'booking_id,model_id,usage_right_id'}).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,resolution:record,persisted_at:record?.updated_at||record?.created_at||new Date().toISOString()});}
  return json(400,{error:'Unsupported contract action'});
 }catch(error){return errorResponse(error);}
};
