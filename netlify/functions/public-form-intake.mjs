import crypto from 'node:crypto';
import { adminClient, json, errorResponse, parseBody } from './_lib/auth.mjs';

const PROD_SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const PROD_SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
const PRIVATE_BUCKET='veux-private';
const MAX_FILES=4;
const MIN_FILES=2;
const MAX_FILE_BYTES=10*1024*1024;
const ALLOWED_MIME=new Set(['image/jpeg','image/png','image/webp']);
const noStore={'Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'};

function clean(v,max=500){return String(v==null?'':v).trim().slice(0,max);}
function safeFileName(v){return clean(v,160).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'photo.jpg';}
function ipHash(event){const ip=event.headers?.['x-nf-client-connection-ip']||event.headers?.['x-forwarded-for']||event.headers?.['client-ip']||'unknown';return crypto.createHash('sha256').update(String(ip).split(',')[0].trim()).digest('hex');}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function org(admin){return one(admin.from('organizations').select('id,name,slug').eq('slug','maison-de-veux').maybeSingle());}
function validateFields(fields){
  const name=clean(fields.name,160),email=clean(fields.email,240).toLowerCase(),location=clean(fields.location,240),dob=clean(fields.dob,20),gender=clean(fields.gender,20),board=clean(fields.board,40);
  if(!name)throw Object.assign(new Error('Full name is required'),{statusCode:400});
  if(!/^\S+@\S+\.\S+$/.test(email))throw Object.assign(new Error('A valid email is required'),{statusCode:400});
  if(!location)throw Object.assign(new Error('City / Country is required'),{statusCode:400});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dob))throw Object.assign(new Error('Date of birth is required'),{statusCode:400});
  if(!['Women','Men'].includes(gender))throw Object.assign(new Error('Select Women or Men for gender'),{statusCode:400});
  const allowed=gender==='Women'?['Women','Development','Creator']:['Men','Creator'];
  if(board&&!allowed.includes(board))throw Object.assign(new Error('Board selection does not match the selected gender'),{statusCode:400});
  return {name,email,location,dob,gender,board,phone:clean(fields.phone,80),instagram:clean(fields.instagram,160),height:clean(fields.height,80),message:clean(fields.message,5000),market:clean(fields.market,40)};
}
function validateFiles(files){
  if(!Array.isArray(files)||files.length<MIN_FILES||files.length>MAX_FILES)throw Object.assign(new Error('Upload 2–4 photos'),{statusCode:400});
  return files.map((f,i)=>{const name=safeFileName(f?.name),type=clean(f?.type,100).toLowerCase(),size=Number(f?.size||0);if(!ALLOWED_MIME.has(type))throw Object.assign(new Error('Photos must be JPG, PNG, or WEBP'),{statusCode:400});if(!Number.isFinite(size)||size<=0||size>MAX_FILE_BYTES)throw Object.assign(new Error('Each photo must be 10 MB or smaller'),{statusCode:400});return {name,type,size,sort_order:i};});
}
async function rateLimit(admin,organizationId,hash){const since=new Date(Date.now()-60*60*1000).toISOString();const {count,error}=await admin.from('agency_form_submissions').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('form_key','get-scouted').contains('metadata',{ip_hash:hash}).gte('created_at',since);if(error)throw error;if(Number(count||0)>=8)throw Object.assign(new Error('Too many submissions from this connection. Please try again later.'),{statusCode:429});}

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'},{...noStore,Allow:'POST'});
  try{
    const body=parseBody(event),action=clean(body.action,40),admin=adminClient(),organization=await org(admin);
    if(!organization)throw new Error('Maison de Veux organization is unavailable');
    if(action==='prepare'){
      const fields=validateFields(body.fields||{}),files=validateFiles(body.files),hash=ipHash(event);
      await rateLimit(admin,organization.id,hash);
      const submission=await one(admin.from('agency_form_submissions').insert({organization_id:organization.id,form_key:'get-scouted',form_label:'Get Scouted Application',source:'website',status:'uploading',submitted_name:fields.name,email:fields.email,phone:fields.phone||null,payload:fields,metadata:{ip_hash:hash,user_agent:clean(event.headers?.['user-agent'],500),file_specs:files}}).select('id').single());
      const uploads=[];
      for(const f of files){
        const ext=(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        const path=`forms/${organization.id}/get-scouted/${submission.id}/${String(f.sort_order+1).padStart(2,'0')}-${crypto.randomUUID()}.${ext}`;
        const {data,error}=await admin.storage.from(PRIVATE_BUCKET).createSignedUploadUrl(path);if(error)throw error;
        const {error:fileRowError}=await admin.from('agency_form_files').insert({organization_id:organization.id,submission_id:submission.id,original_name:f.name,mime_type:f.type,size_bytes:f.size,storage_bucket:PRIVATE_BUCKET,storage_path:path,sort_order:f.sort_order,metadata:{prepared:true}});if(fileRowError)throw fileRowError;
        uploads.push({name:f.name,type:f.type,size:f.size,bucket:PRIVATE_BUCKET,path,token:data.token});
      }
      return json(200,{ok:true,submission_id:submission.id,supabase_url:PROD_SUPABASE_URL,supabase_publishable_key:PROD_SUPABASE_PUBLISHABLE_KEY,uploads},noStore);
    }
    if(action==='finalize'){
      const submissionId=clean(body.submission_id,80);if(!/^[0-9a-f-]{36}$/i.test(submissionId))return json(400,{error:'Invalid submission'},noStore);
      const submission=await one(admin.from('agency_form_submissions').select('*').eq('organization_id',organization.id).eq('id',submissionId).maybeSingle());
      if(!submission)return json(404,{error:'Submission not found'},noStore);
      if(submission.status!=='uploading')return json(200,{ok:true,submission_id:submission.id,status:submission.status,already_finalized:true},noStore);
      const fileRows=await rows(admin.from('agency_form_files').select('*').eq('organization_id',organization.id).eq('submission_id',submission.id).order('sort_order'));
      if(fileRows.length<MIN_FILES)return json(409,{error:'Upload at least two photos before submitting'},noStore);
      // Verify the signed-upload destinations now exist before accepting the application.
      const verified=[];
      for(const f of fileRows){const dir=f.storage_path.split('/').slice(0,-1).join('/'),base=f.storage_path.split('/').pop();const {data,error}=await admin.storage.from(f.storage_bucket).list(dir,{limit:100,search:base});if(error)throw error;if(!(data||[]).some(x=>x.name===base))return json(409,{error:`Photo upload did not finish: ${f.original_name}`},noStore);verified.push(f);}
      const {data:finalized,error:finalizeError}=await admin.rpc('finalize_get_scouted_submission_v1',{target_org:organization.id,target_submission:submission.id});
      if(finalizeError)throw finalizeError;
      return json(201,{ok:true,submission_id:finalized?.submission_id||submission.id,prospect_id:finalized?.prospect_id||null,status:finalized?.status||'new'},noStore);
    }
    return json(400,{error:'Unsupported form action'},noStore);
  }catch(error){const r=errorResponse(error);r.headers={...r.headers,...noStore};return r;}
};
