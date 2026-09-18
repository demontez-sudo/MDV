import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
const group=(list,key)=>{const m=new Map();for(const x of list){const k=x[key];if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;};
function clean(v){const s=String(v==null?'':v).trim();return s||null;}
function num(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function questionnaire(body){
  const q=body.questionnaire&&typeof body.questionnaire==='object'?body.questionnaire:{};
  const keys=['why_modeling','career_goals','agency_expectations','experience','runway_experience','shoot_experience','availability','travel_ready','passport_status','school_work_schedule','comfort_level','strengths','growth_areas','social_presence','representation_history','contract_history','support_system','notes_for_agent'];
  const out={}; for(const k of keys){if(q[k]!=null&&String(q[k]).trim()!=='')out[k]=String(q[k]).trim();}
  return out;
}
async function secureMediaRows(admin,organization,media){
  const ids=[...new Set(media.map(x=>String(x.url||'').startsWith('secure-document:')?String(x.url).slice(16):x.metadata?.document_id).filter(Boolean))];
  if(!ids.length)return media;
  const docs=await rows(admin.from('documents').select('id,name,mime_type,storage_bucket,storage_path').eq('organization_id',organization.id).in('id',ids));
  const dm=new Map(docs.map(x=>[x.id,x]));
  const signed=new Map();
  for(const d of docs){try{const {data,error}=await admin.storage.from(d.storage_bucket).createSignedUrl(d.storage_path,3600);if(!error&&data?.signedUrl)signed.set(d.id,data.signedUrl);}catch(_){}}
  return media.map(x=>{const did=String(x.url||'').startsWith('secure-document:')?String(x.url).slice(16):x.metadata?.document_id;return did?{...x,url:signed.get(did)||x.url,document:dm.get(did)||null,secure_document_id:did}:x;});
}
export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const admin=await requirePermission(user.id,organization.id,'scouting.write'),action=String(body.action||'');
      if(action==='create'||action==='update'){
        if(!String(body.display_name||'').trim())return json(400,{error:'display_name is required'});
        const existing=action==='update'&&body.prospect_id?await one(admin.from('scouting_prospects').select('metadata').eq('organization_id',organization.id).eq('id',body.prospect_id).maybeSingle()):null;
        const payload={
          organization_id:organization.id,display_name:String(body.display_name).trim(),first_name:clean(body.first_name),last_name:clean(body.last_name),
          pronouns:clean(body.pronouns),email:clean(body.email),phone:clean(body.phone),instagram:clean(body.instagram),tiktok:clean(body.tiktok),
          city:clean(body.city),country:clean(body.country),date_of_birth:clean(body.date_of_birth),age_reported:num(body.age_reported),
          height_cm:num(body.height_cm),height_display:clean(body.height_display),stage:body.stage||existing?.stage||'new_lead',status:body.status||'active',
          source:clean(body.source),target_market_id:body.target_market_id||null,target_division_id:body.target_division_id||null,assigned_member_id:body.assigned_member_id||null,
          tags:Array.isArray(body.tags)?body.tags:[],notes:clean(body.notes),
          metadata:{...(existing?.metadata||{}),questionnaire:questionnaire(body),preferred_board_id:body.board_id||existing?.metadata?.preferred_board_id||null,last_agent_review_at:new Date().toISOString()}
        };
        let data,error;
        if(action==='create')({data,error}=await admin.from('scouting_prospects').insert({...payload,created_by:user.id}).select('*').single());
        else {if(!body.prospect_id)return json(400,{error:'prospect_id is required'});({data,error}=await admin.from('scouting_prospects').update(payload).eq('organization_id',organization.id).eq('id',body.prospect_id).select('*').single());}
        if(error)throw error;return json(200,{ok:true,verified:true,prospect:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='schedule_meeting'){
        if(!body.prospect_id||!body.starts_at)return json(400,{error:'prospect_id and starts_at are required'});
        const {data,error}=await admin.from('scouting_meetings').insert({organization_id:organization.id,prospect_id:body.prospect_id,meeting_type:body.meeting_type||'intro',starts_at:body.starts_at,ends_at:body.ends_at||null,status:body.status||'scheduled',location:body.location||null,notes:body.notes||null,created_by:user.id}).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,meeting:data,persisted_at:data?.created_at||new Date().toISOString()});
      }
      if(action==='move_stage'){
        const {data,error}=await client.rpc('move_scouting_prospect_stage',{target_org:organization.id,target_prospect:body.prospect_id,target_stage:body.stage,stage_reason:body.reason||null});if(error)throw error;return json(200,{ok:true,verified:true,prospect:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='add_media_document'){
        if(!body.prospect_id||!body.document_id)return json(400,{error:'prospect_id and document_id are required'});
        const doc=await one(admin.from('documents').select('id,name,mime_type').eq('organization_id',organization.id).eq('id',body.document_id).maybeSingle());
        if(!doc)return json(404,{error:'Uploaded document was not found'});
        if(!String(doc.mime_type||'').startsWith('image/'))return json(400,{error:'Scouting media must be an image'});
        const {data,error}=await admin.from('scouting_media').insert({organization_id:organization.id,prospect_id:body.prospect_id,media_type:body.media_type||'image',url:'secure-document:'+doc.id,storage_provider:'supabase',caption:body.caption||doc.name||null,sort_order:Number(body.sort_order||0),metadata:{document_id:doc.id,secure:true}}).select('*').single();if(error)throw error;
        return json(201,{ok:true,verified:true,media:data,persisted_at:data?.created_at||new Date().toISOString()});
      }
      if(action==='convert_to_model'){
        if(!body.prospect_id)return json(400,{error:'prospect_id is required'});
        const {data:saved,error}=await admin.rpc('convert_scouting_prospect_v1',{target_org:organization.id,target_prospect:body.prospect_id,target_market:body.market_id||null,target_division:body.division_id||null,target_board:body.board_id||null,target_model_stage:body.model_stage||'development',target_user:user.id});
        if(error)throw error;if(!saved?.verified||!saved?.model){const e=new Error('Scouting conversion could not be verified.');e.statusCode=500;e.publicMessage='The signed prospect was not confirmed as transferred. Please retry.';throw e;}
        return json(saved.already_converted?200:201,{ok:true,verified:true,model:saved.model,model_id:saved.model_id,already_converted:!!saved.already_converted,board_id:saved.board_id||null,market_id:saved.market_id||null,division_id:saved.division_id||null,website_profile:saved.website_profile||null,persisted_at:saved.persisted_at||null});
      }

      return json(400,{error:'Unsupported scouting action'});
    }
    const admin=await requirePermission(user.id,organization.id,'scouting.read');
    const [prospects,meetings,history,media,markets,divisions,boards,members,profiles]=await Promise.all([
      rows(admin.from('scouting_prospects').select('*').eq('organization_id',organization.id).order('updated_at',{ascending:false}).limit(500)),
      rows(admin.from('scouting_meetings').select('*').eq('organization_id',organization.id).order('starts_at',{ascending:true}).limit(300)),
      rows(admin.from('scouting_stage_history').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(500)),
      rows(admin.from('scouting_media').select('*').eq('organization_id',organization.id).order('sort_order').limit(2000)),
      rows(admin.from('markets').select('id,name,code,city').eq('organization_id',organization.id).eq('active',true).order('sort_order').limit(100)),
      rows(admin.from('divisions').select('id,name,code').eq('organization_id',organization.id).eq('active',true).order('sort_order').limit(100)),
      rows(admin.from('boards').select('id,name,market_id,division_id').eq('organization_id',organization.id).eq('active',true).order('sort_order').limit(200)),
      rows(admin.from('organization_members').select('id,user_id,job_title,metadata').eq('organization_id',organization.id).eq('member_type','staff').eq('status','active').limit(300)),
      rows(admin.from('profiles').select('user_id,display_name').limit(1000))
    ]);
    const resolvedMedia=await secureMediaRows(admin,organization,media);
    const med=group(resolvedMedia,'prospect_id'),marketMap=new Map(markets.map(x=>[x.id,x])),divMap=new Map(divisions.map(x=>[x.id,x])),boardMap=new Map(boards.map(x=>[x.id,x])),profileMap=new Map(profiles.map(x=>[x.user_id,x]));
    const memberMap=new Map(members.map(x=>[x.id,{...x,display_name:profileMap.get(x.user_id)?.display_name||x.job_title||'Staff'}]));
    const prospectRows=prospects.map(x=>({...x,markets:marketMap.get(x.target_market_id)||null,divisions:divMap.get(x.target_division_id)||null,boards:boardMap.get(x.metadata?.preferred_board_id)||null,organization_members:memberMap.get(x.assigned_member_id)||null,scouting_media:med.get(x.id)||[]}));
    const prospectMap=new Map(prospectRows.map(x=>[x.id,x]));
    return json(200,{environment:'veux-desk-v16.8.6-scouting',organization,prospects:prospectRows,meetings:meetings.map(x=>({...x,scouting_prospects:prospectMap.get(x.prospect_id)?{id:x.prospect_id,display_name:prospectMap.get(x.prospect_id).display_name}:null})),stage_history:history,lookups:{markets,divisions,boards,members:[...memberMap.values()]}});
  }catch(error){return errorResponse(error);}
};
