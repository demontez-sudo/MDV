import { requireUser, parseBody, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function optionalRows(q,label){const {data,error}=await q;if(error){console.warn('[CRM optional read]',label,error.code||'',error.message||'');return [];}return data||[];}
async function requireCrmWrite(userId,organizationId){
  const admin=adminClient();
  if(await assertPermission(admin,userId,organizationId,'crm.write'))return admin;

  // Migration-safe fallback: the portal historically exposed CRM creation to active staff
  // before granular crm.write permissions were fully seeded. Keep this limited to active staff.
  const {data:member,error}=await admin.from('organization_members')
    .select('id,member_type,status')
    .eq('organization_id',organizationId)
    .eq('user_id',userId)
    .eq('member_type','staff')
    .eq('status','active')
    .maybeSingle();
  if(error)throw error;
  if(member?.id)return admin;

  const e=new Error('Missing permission: crm.write');e.statusCode=403;throw e;
}
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
function validationError(message,code='CRM_VALIDATION_ERROR'){const e=new Error(message);e.statusCode=400;e.code=code;return e;}
function normalizeAddress(value){
  if(value==null||value==='')return {};
  if(typeof value==='object'&&!Array.isArray(value))return value;
  const text=String(value).trim();if(!text)return {};
  if(text.startsWith('{')){try{const parsed=JSON.parse(text);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;}catch{}}
  return {formatted:text};
}
function normalizeSpecialties(value){return Array.from(new Set((Array.isArray(value)?value:String(value||'').split(',')).map(x=>String(x||'').trim()).filter(Boolean)));}
function normalizeActivityType(value){const allowed=new Set(['email','call','meeting','package','casting','option','booking','invoice','payment','note','follow_up','other']);const k=String(value||'note').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');return allowed.has(k)?k:'other';}
function normalizeDirection(value){const k=String(value||'internal').trim().toLowerCase();return ['inbound','outbound','internal'].includes(k)?k:'internal';}
function normalizeMetadata(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function normalizeCompanyType(value){
  const raw=String(value||'other').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const map={client:'brand',brand_client:'brand',fashion_house:'designer',model_agency:'agency',talent_agency:'agency',production_company:'production',magazine:'media',magazine_media:'media',photography_studio:'photographer',pr_communications:'pr',creative:'creative_agency'};
  return map[raw]||raw||'other';
}
function cleanOptional(value){const s=String(value==null?'':value).trim();return s||null;}
function dbError(error,entity){
  if(!error)return error;
  const e=new Error([entity+' could not be saved.',error.message,error.details,error.hint].filter(Boolean).join(' '));
  e.statusCode=400;e.code=error.code||'CRM_DATABASE_VALIDATION_ERROR';return e;
}
function cleanLinks(value){
  if(!Array.isArray(value))return [];
  const seen=new Set(),out=[];
  for(const item of value){
    const company_id=String(item&&typeof item==='object'?item.company_id||item.id:item||'').trim();
    if(!company_id||seen.has(company_id))continue;seen.add(company_id);
    out.push({company_id,relationship_role:item&&typeof item==='object'?(item.relationship_role||item.role||null):null,is_primary:!!(item&&typeof item==='object'&&item.is_primary)});
  }
  return out;
}
async function syncContactLinks(admin,organizationId,contact,rawLinks){
  let links=cleanLinks(rawLinks);
  const primaryId=contact.company_id||links.find(x=>x.is_primary)?.company_id||links[0]?.company_id||null;
  if(primaryId&&!links.some(x=>x.company_id===primaryId))links.unshift({company_id:primaryId,relationship_role:contact.role||null,is_primary:true});
  links=links.map(x=>({...x,is_primary:x.company_id===primaryId}));
  const ids=links.map(x=>x.company_id);
  if(ids.length){
    const companies=await rows(admin.from('companies').select('id').eq('organization_id',organizationId).in('id',ids));
    const valid=new Set(companies.map(x=>x.id));links=links.filter(x=>valid.has(x.company_id));
  }
  const {error:delError}=await admin.from('contact_company_links').delete().eq('organization_id',organizationId).eq('contact_id',contact.id);if(delError)throw delError;
  if(links.length){const {error:insError}=await admin.from('contact_company_links').insert(links.map(x=>({organization_id:organizationId,contact_id:contact.id,company_id:x.company_id,relationship_role:x.relationship_role||contact.role||null,is_primary:x.is_primary})));if(insError)throw insError;}
  const resolvedPrimary=links.find(x=>x.is_primary)?.company_id||null;
  if((contact.company_id||null)!==resolvedPrimary){const {data,error}=await admin.from('contacts').update({company_id:resolvedPrimary,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',contact.id).select('*').single();if(error)throw error;return data;}
  return contact;
}
export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const admin=await requireCrmWrite(user.id,organization.id);
      const action=String(body.action||'');
      if(action==='create_company'||action==='update_company'){
        const name=String(body.name||'').trim();if(!name)throw validationError('Company name is required.');
        let payload;
        if(action==='create_company'){
          payload={organization_id:organization.id,name,company_type:normalizeCompanyType(body.company_type),status:cleanOptional(body.status)||'active',tier:cleanOptional(body.tier),website:body.website||null,email:body.email||null,phone:body.phone||null,address:normalizeAddress(body.address),specialties:normalizeSpecialties(body.specialties),notes:body.notes||null,metadata:normalizeMetadata(body.metadata)};
        }else{
          if(!body.company_id)throw validationError('company_id is required.');
          payload={name};
          for(const key of ['website','email','phone','notes'])if(own(body,key))payload[key]=cleanOptional(body[key]);
          if(own(body,'company_type'))payload.company_type=normalizeCompanyType(body.company_type);
          if(own(body,'status'))payload.status=cleanOptional(body.status)||'active';
          if(own(body,'tier'))payload.tier=cleanOptional(body.tier);
          if(own(body,'address'))payload.address=normalizeAddress(body.address);
          if(own(body,'specialties'))payload.specialties=normalizeSpecialties(body.specialties);
          if(own(body,'metadata'))payload.metadata=normalizeMetadata(body.metadata);
        }
        let data,error;
        if(action==='create_company')({data,error}=await admin.from('companies').insert(payload).select('*').single());
        else ({data,error}=await admin.from('companies').update(payload).eq('organization_id',organization.id).eq('id',body.company_id).select('*').single());
        if(error)throw dbError(error,'Company');if(!data){const e=new Error('Company not found.');e.statusCode=404;e.code='CRM_COMPANY_NOT_FOUND';throw e;}return json(200,{ok:true,verified:true,company:data,persisted_at:data?.updated_at||new Date().toISOString()});
      }
      if(action==='create_contact'||action==='update_contact'){
        const displayName=String(body.display_name||[body.first_name,body.last_name].filter(Boolean).join(' ')).trim();if(!displayName)throw validationError('Contact name is required.');
        let payload;
        if(action==='create_contact'){
          payload={organization_id:organization.id,company_id:body.company_id||null,first_name:body.first_name||null,last_name:body.last_name||null,display_name:displayName,role:body.role||null,email:body.email||null,phone:body.phone||null,whatsapp:body.whatsapp||null,instagram:body.instagram||null,preferred_contact:body.preferred_contact||null,market:body.market||null,status:body.status||'active',notes:body.notes||null,metadata:normalizeMetadata(body.metadata)};
        }else{
          if(!body.contact_id)throw validationError('contact_id is required.');
          payload={display_name:displayName};
          for(const key of ['company_id','first_name','last_name','role','email','phone','whatsapp','instagram','preferred_contact','market','status','notes'])if(own(body,key))payload[key]=body[key]||null;
          if(own(body,'metadata'))payload.metadata=normalizeMetadata(body.metadata);
        }
        let data,error;
        if(action==='create_contact')({data,error}=await admin.from('contacts').insert(payload).select('*').single());
        else ({data,error}=await admin.from('contacts').update(payload).eq('organization_id',organization.id).eq('id',body.contact_id).select('*').single());
        if(error)throw dbError(error,'Contact');if(!data){const e=new Error('Contact not found.');e.statusCode=404;e.code='CRM_CONTACT_NOT_FOUND';throw e;}
        if(action==='create_contact'||own(body,'linked_companies'))data=await syncContactLinks(admin,organization.id,data,own(body,'linked_companies')?body.linked_companies:(data.company_id?[{company_id:data.company_id,is_primary:true,relationship_role:data.role||null}]:[]));
        return json(200,{ok:true,verified:true,contact:data,persisted_at:data?.updated_at||new Date().toISOString()});
      }
      if(action==='bulk_import_directory'){
        const incomingCompanies=Array.isArray(body.companies)?body.companies:[];
        const incomingContacts=Array.isArray(body.contacts)?body.contacts:[];
        if(!incomingCompanies.length&&!incomingContacts.length)return json(400,{error:'No companies or contacts supplied'});
        const normType=(v)=>{const x=String(v||'other').toLowerCase().trim();if(x.includes('casting'))return'casting_office';if(x.includes('photo'))return'photographer';if(x.includes('agency'))return'agency';if(x.includes('brand'))return'brand';if(x.includes('magazine')||x.includes('editorial')||x.includes('press'))return'media';if(x.includes('production'))return'production';return'other';};
        let importedCompanies=0,importedContacts=0;
        if(incomingCompanies.length){
          const payload=incomingCompanies.filter(x=>x&&x.id&&x.name).map(x=>({organization_id:organization.id,legacy_id:String(x.id),name:String(x.name),company_type:normType(x.type),status:'active',notes:x.notes||null,metadata:{legacy_market:x.market||null,legacy_type:x.type||null,source:'legacy_industry_directory'}}));
          for(let i=0;i<payload.length;i+=100){const chunk=payload.slice(i,i+100);const {error}=await admin.from('companies').upsert(chunk,{onConflict:'organization_id,legacy_id'});if(error)throw error;importedCompanies+=chunk.length;}
        }
        const companyRows=await rows(admin.from('companies').select('id,legacy_id').eq('organization_id',organization.id).not('legacy_id','is',null).limit(1200));
        const companyMap=new Map(companyRows.map(x=>[String(x.legacy_id),x.id]));
        if(incomingContacts.length){
          const payload=incomingContacts.filter(x=>x&&x.id&&x.name).map(x=>{const companyLegacyIds=Array.isArray(x.companies)?x.companies.filter(Boolean).map(String):[];return{organization_id:organization.id,legacy_id:String(x.id),company_id:companyMap.get(companyLegacyIds[0])||null,display_name:String(x.name),role:x.role||null,email:x.email||null,phone:x.phone||null,market:x.market||null,status:'active',notes:x.notes||null,metadata:{legacy_company_ids:companyLegacyIds,source:'legacy_industry_directory'}};});
          for(let i=0;i<payload.length;i+=100){const chunk=payload.slice(i,i+100);const {error}=await admin.from('contacts').upsert(chunk,{onConflict:'organization_id,legacy_id'});if(error)throw error;importedContacts+=chunk.length;}
        }
        return json(200,{ok:true,imported_companies:importedCompanies,imported_contacts:importedContacts});
      }
      if(action==='log_activity'){
        if(!body.company_id&&!body.contact_id)return json(400,{error:'company_id or contact_id is required'});
        const {data,error}=await admin.from('crm_activity').insert({organization_id:organization.id,company_id:body.company_id||null,contact_id:body.contact_id||null,activity_type:normalizeActivityType(body.activity_type),direction:normalizeDirection(body.direction),subject:body.subject||null,summary:body.summary||null,occurred_at:body.occurred_at||new Date().toISOString(),created_by:user.id,metadata:body.metadata||{}}).select('*').single();if(error)throw error;if(!data?.id)throw new Error('CRM activity was not verified as saved.');return json(200,{ok:true,verified:true,activity:data,persisted_at:data.occurred_at||new Date().toISOString()});
      }
      return json(400,{error:'Unsupported CRM action'});
    }
    const admin=await requirePermission(user.id,organization.id,'crm.read'),companyId=(p.company_id&&p.company_id!=='undefined'&&p.company_id!=='null')?p.company_id:null;
    if(companyId){
      const {data:company,error}=await admin.from('companies').select('*').eq('organization_id',organization.id).eq('id',companyId).maybeSingle();if(error)throw error;if(!company)return json(404,{error:'Company not found'});
      const linkedRows=await rows(admin.from('contact_company_links').select('contact_id,company_id,relationship_role,is_primary').eq('organization_id',organization.id).eq('company_id',companyId));
      const linkedContactIds=[...new Set(linkedRows.map(x=>x.contact_id))];
      const [contacts,activity,bookings,castings,packages,invoices,signals,rates,models]=await Promise.all([
        linkedContactIds.length?rows(admin.from('contacts').select('*').eq('organization_id',organization.id).in('id',linkedContactIds).order('display_name')):rows(admin.from('contacts').select('*').eq('organization_id',organization.id).eq('company_id',companyId).order('display_name')),
        rows(admin.from('crm_activity').select('*').eq('organization_id',organization.id).eq('company_id',companyId).order('occurred_at',{ascending:false}).limit(250)),
        rows(admin.from('bookings').select('id,title,status,starts_at,currency').eq('organization_id',organization.id).eq('company_id',companyId).order('starts_at',{ascending:false}).limit(100)),
        rows(admin.from('castings').select('id,title,status,starts_at').eq('organization_id',organization.id).eq('company_id',companyId).order('starts_at',{ascending:false}).limit(100)),
        rows(admin.from('packages').select('id,title,status,created_at').eq('organization_id',organization.id).eq('company_id',companyId).order('created_at',{ascending:false}).limit(100)),
        rows(admin.from('invoices').select('id,invoice_number,status,total,amount_due,currency,issue_date,due_date').eq('organization_id',organization.id).eq('company_id',companyId).order('issue_date',{ascending:false}).limit(100)),
        rows(admin.from('client_model_signals').select('*').eq('organization_id',organization.id).eq('company_id',companyId).order('weighted_score',{ascending:false}).limit(50)),
        rows(admin.from('booking_rates').select('*').eq('organization_id',organization.id).limit(1500)),
        rows(admin.from('models').select('id,display_name').eq('organization_id',organization.id).limit(1000))
      ]);
      const rateMap=new Map();for(const r of rates){if(!rateMap.has(r.booking_id))rateMap.set(r.booking_id,[]);rateMap.get(r.booking_id).push(r);}const mm=new Map(models.map(x=>[x.id,x]));
      const compatibleInvoices=invoices.map(i=>({...i,total_amount:i.total,balance_due:i.amount_due,issued_on:i.issue_date,due_on:i.due_date}));
      return json(200,{environment:'veux-saas-v16.9.57',organization,company,contacts:contacts.map(c=>({...c,company_links:linkedRows.filter(l=>l.contact_id===c.id)})),contact_links:linkedRows,activity,bookings:bookings.map(b=>({...b,booking_rates:rateMap.get(b.id)||[]})),castings,packages,invoices:compatibleInvoices,signals:signals.map(s=>({...s,models:mm.get(s.model_id)||null}))});
    }
    const [companies,contacts,activity,contactLinks]=await Promise.all([
      rows(admin.from('companies').select('*').eq('organization_id',organization.id).order('name').limit(700)),
      rows(admin.from('contacts').select('*').eq('organization_id',organization.id).order('display_name').limit(900)),
      optionalRows(admin.from('crm_activity').select('*').eq('organization_id',organization.id).order('occurred_at',{ascending:false}).limit(240),'crm_activity'),
      optionalRows(admin.from('contact_company_links').select('contact_id,company_id,relationship_role,is_primary').eq('organization_id',organization.id).limit(1800),'contact_company_links')
    ]);
    const cm=new Map(companies.map(x=>[x.id,x]));
    const linksByContact=new Map();for(const l of contactLinks){if(!linksByContact.has(l.contact_id))linksByContact.set(l.contact_id,[]);linksByContact.get(l.contact_id).push({...l,company:cm.get(l.company_id)||null});}
    return json(200,{environment:'veux-saas-v16.9.57',organization,companies,contact_links:contactLinks,contacts:contacts.map(x=>({...x,companies:cm.get(x.company_id)||null,company_links:linksByContact.get(x.id)||[]})),recent_activity:activity.map(x=>({...x,companies:cm.get(x.company_id)||null,contacts:contacts.find(c=>c.id===x.contact_id)||null}))});
  }catch(error){return errorResponse(error);}
};
