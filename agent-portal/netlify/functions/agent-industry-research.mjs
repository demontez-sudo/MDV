import { requireUser, adminClient, assertPermission, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization } from './_lib/agent-bridge.mjs';

function clean(v,n=500){return String(v??'').trim().slice(0,n)}
function providerKey(){return clean(process.env.OPENAI_API_KEY||process.env.CAVYRE_OPENAI_API_KEY||process.env.VEUX_OPENAI_API_KEY,500)}
function model(){return clean(process.env.VEUX_OPENAI_MODEL,120)||'gpt-5.6'}
function textOf(body){
  if(typeof body?.output_text==='string')return body.output_text;
  const out=[];
  for(const item of body?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')out.push(c.text);
  return out.join('\n').trim();
}
function parseLoose(s){try{return JSON.parse(s)}catch{} const m=String(s||'').match(/\{[\s\S]*\}/);if(m)try{return JSON.parse(m[0])}catch{} return null}
function normalizeSources(x){
  const seen=new Set(),out=[];
  for(const s of Array.isArray(x)?x:[]){
    const url=clean(s?.url,1000); if(!/^https?:\/\//i.test(url)||seen.has(url))continue;seen.add(url);
    out.push({title:clean(s?.title,180)||url,url,source:clean(s?.source,120)||null,published_at:clean(s?.published_at,80)||null});
  } return out.slice(0,16);
}
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event),body=parseBody(event);
  const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug||'maison-de-veux'});
  const admin=adminClient();
  if(!await assertPermission(admin,user.id,organization.id,'ai.use'))return json(403,{error:'You do not have permission to use Vera Intelligence'});
  const query=clean(body.query||body.name,240),kind=['contact','company','auto'].includes(body.kind)?body.kind:'auto';
  if(!query)return json(400,{error:'Enter a designer, casting director, casting office, brand, or company.'});
  const key=providerKey(); if(!key)return json(503,{error:'Vera web research is not configured on this deployment.'});
  const instructions=`You are Vera Industry Intelligence for a professional modeling agency.
Research ONLY public professional information from the live web. Focus on fashion designers, casting directors, casting offices, brands and professional relationships.
Distinguish employment/company affiliation from project/client credits. Never describe a brand as an employer merely because a casting director cast a project for that brand.
Prefer official sites, Models.com, Vogue/WWD/Business of Fashion and established fashion publications. Public professional social profiles may supplement, not replace, stronger sources.
Never infer private contact details. Never return private/personal data. Do not invent email addresses.
Return ONLY JSON:
{"entity":{"name":"","entity_type":"casting_director|designer|casting_office|brand|company|other","role":"","primary_company":"","markets":[],"website":"","instagram":"","professional_email":"","summary":""},"relationships":[{"name":"","relationship_type":"works_at|founded|client_credit|casting_credit|designer_for|collaborates_with|other","company":"","project":"","season":"","confidence":0}],"recent_credits":[{"title":"","brand":"","role":"","date":""}],"sources":[{"title":"","url":"","source":"","published_at":""}],"confidence":0,"notes":""}
Every material claim must be supported by at least one source URL returned in sources. If identity is ambiguous, lower confidence and say so in notes.`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:model(),instructions,input:`Research ${kind}: ${query}. Current date: ${new Date().toISOString()}.`,tools:[{type:'web_search'}],store:false})});
  const rb=await r.json().catch(()=>({})); if(!r.ok)return json(502,{error:`Vera web research provider failed (${r.status}).`});
  const parsed=parseLoose(textOf(rb)); if(!parsed)return json(502,{error:'Vera web research returned an unreadable result.'});
  parsed.sources=normalizeSources(parsed.sources); parsed.confidence=Math.max(0,Math.min(100,Number(parsed.confidence)||0));
  const result={query,kind,researched_at:new Date().toISOString(),...parsed};
  await admin.from('ai_jobs').insert({organization_id:organization.id,job_type:'report',status:'complete',requested_by:user.id,input:{compat:'industry-research-16.11.36',query,kind},result,provider:'openai_web_search',provider_model:model(),started_at:new Date().toISOString(),completed_at:new Date().toISOString()});
  return json(200,result);
 }catch(e){return errorResponse(e)}
};