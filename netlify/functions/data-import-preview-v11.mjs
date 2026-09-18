import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { parseCsv, mapped, splitName } from './_lib/csv.mjs';

function normalize(entity,r,mapping){
  if(entity==='models'){
    const display=mapped(r,mapping,'display_name','name','model','full_name');const parts=splitName(display||'');const first=mapped(r,mapping,'first_name','first')||parts.first_name;const last=mapped(r,mapping,'last_name','last')||parts.last_name;
    const data={display_name:display||[first,last].filter(Boolean).join(' '),first_name:first,last_name:last,email:mapped(r,mapping,'email'),phone:mapped(r,mapping,'phone','mobile'),instagram:mapped(r,mapping,'instagram','ig'),location:mapped(r,mapping,'location','city'),gender:mapped(r,mapping,'gender'),stage:mapped(r,mapping,'stage','board'),status:mapped(r,mapping,'status')||'active',legacy_key:mapped(r,mapping,'legacy_key','id')};
    const errors=[];if(!data.display_name)errors.push('display_name/name is required');if(!data.first_name)errors.push('first_name is required');return {data,errors};
  }
  if(entity==='companies'){
    const data={name:mapped(r,mapping,'name','company','company_name'),type:mapped(r,mapping,'type','category')||'other',website:mapped(r,mapping,'website','url'),city:mapped(r,mapping,'city'),country:mapped(r,mapping,'country','country_code')};return {data,errors:data.name?[]:['name/company is required']};
  }
  if(entity==='contacts'){
    const name=mapped(r,mapping,'name','full_name','contact');const parts=splitName(name||'');const data={display_name:name||[mapped(r,mapping,'first_name')||parts.first_name,mapped(r,mapping,'last_name')||parts.last_name].filter(Boolean).join(' '),first_name:mapped(r,mapping,'first_name')||parts.first_name,last_name:mapped(r,mapping,'last_name')||parts.last_name,email:mapped(r,mapping,'email'),phone:mapped(r,mapping,'phone'),title:mapped(r,mapping,'title','role'),company_name:mapped(r,mapping,'company_name','company')};return {data,errors:data.display_name||data.email?[]:['name or email is required']};
  }
  return {data:r,errors:[]};
}

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);const admin=adminClient();const body=parseBody(event);const org=body.organization_id;const entity=String(body.entity_type||'');
    if(!org||!['models','companies','contacts'].includes(entity))return json(400,{error:'organization_id and supported entity_type are required'});if(!await assertPermission(admin,user.id,org,'data.import'))return json(403,{error:'Data import permission required'});
    const {headers,records}=parseCsv(body.csv,{maxRows:Number(process.env.VEUX_IMPORT_MAX_ROWS||5000)});if(!records.length)return json(400,{error:'No CSV data rows found'});
    const mapping=body.column_mapping||{};const normalized=records.map((r,i)=>{const n=normalize(entity,r,mapping);return {row_number:i+2,raw_data:r,normalized_data:n.data,status:n.errors.length?'invalid':'valid',errors:n.errors};});
    const valid=normalized.filter(r=>r.status==='valid').length;const {data:job,error:jobError}=await admin.from('data_import_jobs').insert({organization_id:org,entity_type:entity,source_type:'csv',source_name:body.source_name||'upload.csv',status:valid===normalized.length?'ready':'validating',total_rows:normalized.length,valid_rows:valid,invalid_rows:normalized.length-valid,column_mapping:mapping,options:body.options||{},requested_by:user.id}).select('*').single();if(jobError)throw jobError;
    const chunks=[];for(let i=0;i<normalized.length;i+=500)chunks.push(normalized.slice(i,i+500).map(r=>({...r,organization_id:org,import_job_id:job.id})));
    for(const chunk of chunks){const {error}=await admin.from('data_import_rows').insert(chunk);if(error)throw error;}
    return json(201,{job:{...job,valid_rows:valid,invalid_rows:normalized.length-valid},headers,preview:normalized.slice(0,25)});
  }catch(error){return errorResponse(error)}
};
