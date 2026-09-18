import { requireUser, adminClient, assertPermission, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';

function clean(v,n=1000){return String(v??'').trim().slice(0,n)}
function clamp(v){return Math.max(0,Math.min(100,Number(v)||0))}
function rows(q){return q.then(({data,error})=>{if(error)throw error;return data||[]})}
function one(q){return q.then(({data,error})=>{if(error)throw error;return data||null})}
function sourceUrls(r){return (Array.isArray(r?.sources)?r.sources:[]).map(x=>clean(x?.url,1000)).filter(x=>/^https?:\/\//i.test(x))}
function providerKey(){return clean(process.env.OPENAI_API_KEY||process.env.CAVYRE_OPENAI_API_KEY||process.env.VEUX_OPENAI_API_KEY,500)}
function model(){return clean(process.env.VEUX_OPENAI_MODEL,120)||'gpt-5.6'}
function textOf(body){if(typeof body?.output_text==='string')return body.output_text;const out=[];for(const item of body?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')out.push(c.text);return out.join('\n').trim()}
function parseLoose(s){try{return JSON.parse(s)}catch{}const m=String(s||'').match(/\{[\s\S]*\}/);if(m)try{return JSON.parse(m[0])}catch{}return null}
function normalizeSources(x){const seen=new Set(),out=[];for(const s of Array.isArray(x)?x:[]){const url=clean(s?.url,1000);if(!/^https?:\/\//i.test(url)||seen.has(url))continue;seen.add(url);out.push({title:clean(s?.title,180)||url,url,source:clean(s?.source,120)||null,published_at:clean(s?.published_at,80)||null})}return out.slice(0,20)}
function supported(result){
 const urls=sourceUrls(result),blob=JSON.stringify(result||{});
 if(!urls.length)return false;
 // Research may synthesize, but cannot claim sourced verification with zero URLs.
 return blob.length>20;
}
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event),body=parseBody(event);
  const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug||'maison-de-veux'});
  const admin=adminClient();
  if(!await assertPermission(admin,user.id,organization.id,'ai.use'))return json(403,{error:'You do not have permission to use Vera Intelligence'});
  const query=clean(body.query||body.name,300),modelId=clean(body.model_id,100)||null,companyId=clean(body.company_id,100)||null,contactId=clean(body.contact_id,100)||null;
  if(!query)return json(400,{error:'Vera needs a research objective.'});
  const key=providerKey();if(!key)return json(503,{error:'Vera live research is not configured on this deployment.'});

  const [talent,measurements,media,blocks,company,contact,activity,bookings,castings]=await Promise.all([
   modelId?one(admin.from('models').select('id,display_name,stage,status,location,primary_market_label,metadata').eq('organization_id',organization.id).eq('id',modelId).maybeSingle()):null,
   modelId?one(admin.from('model_measurements').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('updated_at',{ascending:false}).limit(1).maybeSingle()):null,
   modelId?rows(admin.from('model_media').select('media_type,category,url,is_primary,is_public').eq('organization_id',organization.id).eq('model_id',modelId).eq('is_public',true).limit(30)):[],
   modelId?rows(admin.from('availability_blocks').select('starts_at,ends_at,block_type,status,reason').eq('organization_id',organization.id).eq('model_id',modelId).gte('ends_at',new Date().toISOString()).limit(30)):[],
   companyId?one(admin.from('companies').select('id,name,company_type,status,tier,website,specialties,notes,metadata').eq('organization_id',organization.id).eq('id',companyId).maybeSingle()):null,
   contactId?one(admin.from('contacts').select('id,display_name,role,company_id,market,status,notes,metadata').eq('organization_id',organization.id).eq('id',contactId).maybeSingle()):null,
   (companyId||contactId)?rows(admin.from('crm_activity').select('activity_type,direction,subject,summary,occurred_at,company_id,contact_id').eq('organization_id',organization.id).or([companyId&&`company_id.eq.${companyId}`,contactId&&`contact_id.eq.${contactId}`].filter(Boolean).join(',')).order('occurred_at',{ascending:false}).limit(60)):[],
   modelId?rows(admin.from('booking_models').select('booking_id,status,feedback,internal_notes,bookings(id,title,status,starts_at,ends_at,location,company_id)').eq('organization_id',organization.id).eq('model_id',modelId).limit(60)):[],
   modelId?rows(admin.from('casting_models').select('casting_id,status,feedback,internal_notes,castings(id,title,status,starts_at,ends_at,location,company_id,brief)').eq('organization_id',organization.id).eq('model_id',modelId).limit(80)):[]
  ]);
  const internal={talent,measurements,media:media.map(x=>({...x,url:x.url?clean(x.url,500):null})),availability_blocks:blocks,company,contact,relationship_activity:activity,bookings,castings};
  const instructions=`You are Vera Deep Research + Agency Intelligence for CAVYRE.
Complete the research objective using live public web research and the supplied private CAVYRE context.
Never expose private CAVYRE data as a public-source claim. Separate evidence into PUBLIC RESEARCH, CAVYRE DATA, and VERA ANALYSIS.
Every material PUBLIC RESEARCH claim must be supported by a URL in sources. Do not invent professional credits, employers, emails, relationships or dates.
For talent-fit work, score only dimensions supported by the supplied model data and public research. Explain missing evidence instead of filling gaps.
For relationship intelligence, distinguish works_at/founded from client/project credits.
Return ONLY JSON:
{"objective":"","subject":{"name":"","type":"","summary":""},"public_research":{"identity":"","markets":[],"style":[],"recent_work":[],"relationships":[]},"cavyre_context":{"summary":"","existing_relationship":false,"signals":[]},"fit_analysis":{"model_id":"","model_name":"","score":0,"portfolio_value":"unknown|low|medium|high","market_value":"unknown|low|medium|high","strengths":[],"risks":[],"missing_evidence":[]},"relationship_intelligence":{"priority":"low|medium|high|unknown","warm_paths":[],"gaps":[],"recommended_positioning":""},"recommendation":{"decision":"proceed|consider|hold|insufficient_evidence","reason":"","next_actions":[]},"sources":[{"title":"","url":"","source":"","published_at":""}],"confidence":0,"notes":""}`;
  const input=`Objective: ${query}
Current date: ${new Date().toISOString()}
PRIVATE CAVYRE CONTEXT (do not treat as public evidence):
${JSON.stringify(internal).slice(0,45000)}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:model(),instructions,input,tools:[{type:'web_search'}],store:false})});
  const rb=await r.json().catch(()=>({}));if(!r.ok)return json(502,{error:`Vera research provider failed (${r.status}).`});
  const parsed=parseLoose(textOf(rb));if(!parsed)return json(502,{error:'Vera deep research returned an unreadable result.'});
  parsed.sources=normalizeSources(parsed.sources);parsed.confidence=clamp(parsed.confidence);
  if(parsed.fit_analysis)parsed.fit_analysis.score=clamp(parsed.fit_analysis.score);
  const result={ok:true,verified_public_sources:supported(parsed),researched_at:new Date().toISOString(),query,model_id:modelId,company_id:companyId,contact_id:contactId,...parsed};
  await admin.from('ai_jobs').insert({organization_id:organization.id,job_type:'report',status:'complete',requested_by:user.id,input:{compat:'vera-deep-intelligence-16.11.83',query,model_id:modelId,company_id:companyId,contact_id:contactId},result,provider:'openai_web_search',provider_model:model(),started_at:new Date().toISOString(),completed_at:new Date().toISOString()});
  return json(200,result);
 }catch(e){return errorResponse(e)}
};