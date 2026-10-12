import crypto from 'node:crypto';
import { adminClient, json, errorResponse, parseBody } from './_lib/auth.mjs';

const PROD_SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const PROD_SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
const PRIVATE_BUCKET='veux-private';
const MAX_FILES=6;
const MIN_FILES=2;
const SLOTS={full_length:'Full length',full_length_profile:'Full length profile',portrait:'Portrait length',close_up:'Close up (hair pulled back)',close_up_profile:'Close up profile (hair pulled back)',personality:'Personality pic'};
const REQUIRED_SLOTS=['full_length','close_up'];
const OFFICES=['New York','Paris'];
const MAX_FILE_BYTES=10*1024*1024;
const ALLOWED_MIME=new Set(['image/jpeg','image/png','image/webp']);
const noStore={'Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'};

function clean(v,max=500){return String(v==null?'':v).trim().slice(0,max);}
function safeFileName(v){return clean(v,160).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'photo.jpg';}
function ipHash(event){const ip=event.headers?.['x-nf-client-connection-ip']||event.headers?.['x-forwarded-for']||event.headers?.['client-ip']||'unknown';return crypto.createHash('sha256').update(String(ip).split(',')[0].trim()).digest('hex');}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function org(admin){return one(admin.from('organizations').select('id,name,slug').eq('slug','maison-de-veux').maybeSingle());}
const bad=msg=>Object.assign(new Error(msg),{statusCode:400});
const yes=v=>v===true||/^(yes|true|on|1)$/i.test(String(v==null?'':v).trim());
export function ageFrom(dob,now=new Date()){const d=new Date(`${dob}T00:00:00Z`);if(Number.isNaN(d.getTime()))return null;let a=now.getUTCFullYear()-d.getUTCFullYear();const m=now.getUTCMonth()-d.getUTCMonth();if(m<0||(m===0&&now.getUTCDate()<d.getUTCDate()))a--;return a;}
export function parseHeightCm(text,units){const t=String(text||'').trim();if(!t)return null;const ft=t.match(/^(\d)\s*(?:'|ft|feet|′|\s)\s*(\d{1,2})?/i);if(units!=='cm'&&ft){const cm=(Number(ft[1])*12+Number(ft[2]||0))*2.54;return cm>=120&&cm<=230?Math.round(cm*10)/10:null;}const n=parseFloat(t.replace(',','.'));if(!Number.isFinite(n))return null;const cm=units==='cm'||n>100?n:n*2.54;return cm>=120&&cm<=230?Math.round(cm*10)/10:null;}
function legacyFields(fields){
  const name=clean(fields.name,160),email=clean(fields.email,240).toLowerCase(),location=clean(fields.location,240),dob=clean(fields.dob,20),gender=clean(fields.gender,20),board=clean(fields.board,40);
  if(!name)throw bad('Full name is required');
  if(!/^\S+@\S+\.\S+$/.test(email))throw bad('A valid email is required');
  if(!location)throw bad('City / Country is required');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dob))throw bad('Date of birth is required');
  if(!['Women','Men'].includes(gender))throw bad('Select Women or Men for gender');
  const allowed=gender==='Women'?['Women','Development','Creator']:['Men','Creator'];
  if(board&&!allowed.includes(board))throw bad('Board selection does not match the selected gender');
  return {name,email,location,dob,gender,board,phone:clean(fields.phone,80),instagram:clean(fields.instagram,160),height:clean(fields.height,80),message:clean(fields.message,5000),market:clean(fields.market,40)};
}
/* The in-depth application (version 2). Also writes the original keys the intake RPC reads (name, location, height, message, market). */
export function validateFields(fields){
  fields=fields&&typeof fields==='object'?fields:{};
  if(clean(fields.website,200))throw bad('Submission rejected');
  if(String(fields.application_version||'')!=='2')return legacyFields(fields);
  const first=clean(fields.first_name,80),last=clean(fields.last_name,80),email=clean(fields.email,240).toLowerCase(),dob=clean(fields.dob,20),gender=clean(fields.gender,20),board=clean(fields.board,40);
  const city=clean(fields.city,120),country=clean(fields.country,120),phone=clean(fields.phone,80);
  if(!first||!last)throw bad('First and last name are required');
  if(!/^\S+@\S+\.\S+$/.test(email))throw bad('A valid email is required');
  if(phone.replace(/\D/g,'').length<7)throw bad('A phone number is required');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dob))throw bad('Date of birth is required');
  const age=ageFrom(dob);if(age==null||age<13||age>80)throw bad('Please check your date of birth');
  if(!['Women','Men'].includes(gender))throw bad('Select Women or Men for gender');
  const allowed=gender==='Women'?['Women','Development','Creator']:['Men','Creator'];
  if(board&&!allowed.includes(board))throw bad('Board selection does not match the selected gender');
  if(!city||!country)throw bad('City and country are required');
  const units=fields.units==='cm'?'cm':'in';
  const m={height:clean(fields.height,40),bust_chest:clean(fields.bust_chest,20),waist:clean(fields.waist,20),hips:clean(fields.hips,20),shoe:clean(fields.shoe,20),dress_suit:clean(fields.dress_suit,20),cup:clean(fields.cup,10),hair:clean(fields.hair,40),eyes:clean(fields.eyes,40)};
  if(!m.height)throw bad('Height is required');
  if(!m.bust_chest||!m.waist||!m.hips)throw bad('Bust / chest, waist and hips are required');
  const story=clean(fields.story,3000);if(story.length<20)throw bad('Tell us a little about yourself (a few sentences)');
  const represented=yes(fields.represented)?'yes':(String(fields.represented||'')==='no'?'no':'');
  if(!represented)throw bad('Tell us whether you already have representation');
  if(!yes(fields.confirm))throw bad('Please confirm the information and photos are your own');
  const offices=(Array.isArray(fields.offices)?fields.offices:String(fields.offices||'').split(',')).map(x=>clean(x,40)).filter(x=>OFFICES.includes(x)).filter((x,i,arr)=>arr.indexOf(x)===i);
  const guardian={name:clean(fields.guardian_name,160),relationship:clean(fields.guardian_relationship,60),email:clean(fields.guardian_email,240).toLowerCase(),phone:clean(fields.guardian_phone,80),consent:yes(fields.guardian_consent)};
  if(age<18){
    if(!guardian.name)throw bad('A parent or guardian name is required for applicants under 18');
    if(!/^\S+@\S+\.\S+$/.test(guardian.email))throw bad('A parent or guardian email is required for applicants under 18');
    if(!guardian.consent)throw bad('A parent or guardian must consent for applicants under 18');
  }
  const app={version:2,first_name:first,last_name:last,email,phone,dob,age,gender,board,city,country,state:clean(fields.state,120),postal_code:clean(fields.postal_code,30),address:clean(fields.address,240),
    instagram:clean(fields.instagram,160),tiktok:clean(fields.tiktok,160),followers:clean(fields.followers,40),offices,units,measurements:m,
    story,goals:clean(fields.goals,2000),experience:clean(fields.experience,80),represented,represented_agency:clean(fields.represented_agency,160),represented_notes:clean(fields.represented_notes,500),
    travel:clean(fields.travel,40),passport:clean(fields.passport,40),guardian:age<18?guardian:null,confirmed:true,submitted_at:new Date().toISOString()};
  const meas=`height ${m.height}, bust/chest ${m.bust_chest}, waist ${m.waist}, hips ${m.hips}${m.shoe?`, shoe ${m.shoe}`:''}${m.dress_suit?`, size ${m.dress_suit}`:''}${m.cup?`, cup ${m.cup}`:''}${m.hair?`, hair ${m.hair}`:''}${m.eyes?`, eyes ${m.eyes}`:''}`;
  const message=[`About: ${story}`,app.goals&&`Goals: ${app.goals}`,`Representation: ${represented==='yes'?`Yes${app.represented_agency?` (${app.represented_agency})`:''}${app.represented_notes?` — ${app.represented_notes}`:''}`:'No'}`,app.experience&&`Experience: ${app.experience}`,`Measurements (${units}): ${meas}`,app.travel&&`Open to travel: ${app.travel}`,app.passport&&`Passport: ${app.passport}`,offices.length&&`Offices: ${offices.join(' + ')}`,app.followers&&`Followers: ${app.followers}`,age<18?`UNDER 18. Guardian: ${guardian.name}${guardian.relationship?` (${guardian.relationship})`:''}, ${guardian.email}${guardian.phone?`, ${guardian.phone}`:''}. Consent given.`:''].filter(Boolean).join('\n').slice(0,5000);
  return {name:`${first} ${last}`,email,location:`${city}, ${country}`,dob,gender,board,phone,instagram:app.instagram,height:m.height,message,market:offices.length===2?'New York + Paris':(offices[0]||''),application:app};
}
export function validateFiles(files){
  if(!Array.isArray(files)||files.length<MIN_FILES||files.length>MAX_FILES)throw bad(`Upload ${MIN_FILES}–${MAX_FILES} photos`);
  const v2=files.some(f=>f&&f.slot);
  if(!v2&&files.length>4)throw bad('Upload 2–4 photos');
  const seen=new Set();
  const out=files.map((f,i)=>{
    const name=safeFileName(f?.name),type=clean(f?.type,100).toLowerCase(),size=Number(f?.size||0),slot=v2?clean(f?.slot,40):'';
    if(!ALLOWED_MIME.has(type))throw bad('Photos must be JPG, PNG, or WEBP');
    if(!Number.isFinite(size)||size<=0||size>MAX_FILE_BYTES)throw bad('Each photo must be 10 MB or smaller');
    if(v2){if(!SLOTS[slot])throw bad('Unknown photo slot');if(seen.has(slot))throw bad('Each photo slot can be used once');seen.add(slot);}
    return {name,type,size,sort_order:i,slot};
  });
  if(v2){const miss=REQUIRED_SLOTS.filter(k=>!seen.has(k));if(miss.length)throw bad(`Please add: ${miss.map(k=>SLOTS[k]).join(' and ')}`);}
  return out;
}
/* After the intake RPC creates the prospect, fill in the richer profile. Best effort: never blocks the application. */
export function buildProspectUpdate(app,existingMeta){
  if(!app||app.version!==2)return null;
  const m=app.measurements||{},cm=parseHeightCm(m.height,app.units);
  const q={...(existingMeta?.questionnaire||{}),why_modeling:app.story,...(app.goals?{career_goals:app.goals}:{}),...(app.experience?{experience:app.experience}:{}),...(app.travel?{travel_ready:app.travel}:{}),...(app.passport?{passport_status:app.passport}:{}),representation_history:app.represented==='yes'?`Yes${app.represented_agency?` — ${app.represented_agency}`:''}${app.represented_notes?` (${app.represented_notes})`:''}`:'No',...(app.followers||app.instagram?{social_presence:[app.instagram,app.followers&&`${app.followers} followers`].filter(Boolean).join(' · ')}:{})};
  return {row:{first_name:app.first_name,last_name:app.last_name,city:app.city,country:app.country,...(app.tiktok?{tiktok:app.tiktok}:{}),age_reported:app.age,...(cm?{height_cm:cm}:{}),height_display:m.height?`${m.height}${app.units==='cm'&&!/cm/i.test(m.height)?' cm':''}`:null,
    tags:['website-application',...(app.age<18?['minor']:[]),...(app.offices||[]).map(o=>`office:${o.toLowerCase().replace(/\s+/g,'-')}`)]},
    metadata:{...(existingMeta||{}),application:app,questionnaire:q}};
}
async function rateLimit(admin,organizationId,hash){const since=new Date(Date.now()-60*60*1000).toISOString();const {count,error}=await admin.from('agency_form_submissions').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('form_key','get-scouted').contains('metadata',{ip_hash:hash}).gte('created_at',since);if(error)throw error;if(Number(count||0)>=8)throw Object.assign(new Error('Too many submissions from this connection. Please try again later.'),{statusCode:429});}

async function enrichProspect(admin,organizationId,prospectId,app,fileRows){
  if(!app||app.version!==2)return;
  const existing=await one(admin.from('scouting_prospects').select('metadata,tags').eq('organization_id',organizationId).eq('id',prospectId).maybeSingle());
  const upd=buildProspectUpdate(app,existing?.metadata);if(!upd)return;
  const tags=[...new Set([...(Array.isArray(existing?.tags)?existing.tags:[]),...upd.row.tags])];
  const {error}=await admin.from('scouting_prospects').update({...upd.row,tags,metadata:upd.metadata}).eq('organization_id',organizationId).eq('id',prospectId);if(error)throw error;
  const media=await rows(admin.from('scouting_media').select('id,sort_order').eq('organization_id',organizationId).eq('prospect_id',prospectId).order('sort_order'));
  const slots=(fileRows||[]).slice().sort((a,b)=>a.sort_order-b.sort_order).map(f=>f.metadata?.slot);
  for(let i=0;i<media.length&&i<slots.length;i++){if(SLOTS[slots[i]])await admin.from('scouting_media').update({caption:SLOTS[slots[i]]}).eq('id',media[i].id);}
}

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
        const {error:fileRowError}=await admin.from('agency_form_files').insert({organization_id:organization.id,submission_id:submission.id,original_name:f.name,mime_type:f.type,size_bytes:f.size,storage_bucket:PRIVATE_BUCKET,storage_path:path,sort_order:f.sort_order,metadata:{prepared:true,...(f.slot?{slot:f.slot}:{})}});if(fileRowError)throw fileRowError;
        uploads.push({name:f.name,type:f.type,size:f.size,slot:f.slot||null,bucket:PRIVATE_BUCKET,path,token:data.token});
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
      const prospectId=finalized?.prospect_id||null;
      if(prospectId){try{await enrichProspect(admin,organization.id,prospectId,submission.payload?.application,fileRows);}catch(e){console.warn('[get-scouted] profile enrichment skipped',e?.message||e);}}
      return json(201,{ok:true,submission_id:finalized?.submission_id||submission.id,prospect_id:prospectId,status:finalized?.status||'new'},noStore);
    }
    return json(400,{error:'Unsupported form action'},noStore);
  }catch(error){const r=errorResponse(error);r.headers={...r.headers,...noStore};return r;}
};
