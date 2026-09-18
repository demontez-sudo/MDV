import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { buildClientFitContext } from './_lib/client-fit-intelligence.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function safeRows(q,warnings,label){try{return await rows(q);}catch(e){warnings.push({source:label,error:String(e?.message||e)});return [];}}
async function safeOne(q,warnings,label){try{const {data,error}=await q;if(error)throw error;return data||null;}catch(e){warnings.push({source:label,error:String(e?.message||e)});return null;}}
const T=v=>String(v==null?'':v).trim();
const L=v=>T(v).toLowerCase();
const active=v=>!/cancelled|canceled|closed|released|declined|archived|expired/i.test(L(v));
const dateMs=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:null;};
const overlap=(a1,a2,b1,b2)=>{const x1=dateMs(a1),x2=dateMs(a2||a1),y1=dateMs(b1),y2=dateMs(b2||b1);if(x1==null||y1==null)return false;return x1<=(y2??y1)&&(x2??x1)>=y1;};
const group=(list,key)=>{const m=new Map();for(const x of list||[]){const k=String(x?.[key]||'');if(!k)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;};
const num=v=>{if(v==null||v==='')return null;if(typeof v==='number'&&Number.isFinite(v))return v;const s=String(v).replace(',','.');const m=s.match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
const marketKey=v=>L(v).replace(/[^a-z0-9]/g,'');
function parseRequirements(raw){if(!raw)return{};try{const x=typeof raw==='string'?JSON.parse(raw):raw;return x&&typeof x==='object'?x:{};}catch{return{};}}
function rangeScore(value,min,max){if(value==null)return{score:null,matched:null};if(min==null&&max==null)return{score:null,matched:null};if(min!=null&&value<min)return{score:0,matched:false};if(max!=null&&value>max)return{score:0,matched:false};return{score:100,matched:true};}
function measurementScore(mm,req){const specs=[['height_cm','height_min_cm','height_max_cm'],['bust_cm','bust_min_cm','bust_max_cm'],['chest_cm','chest_min_cm','chest_max_cm'],['waist_cm','waist_min_cm','waist_max_cm'],['hips_cm','hips_min_cm','hips_max_cm'],['shoe','shoe_min','shoe_max']];const checks=[];for(const [field,minK,maxK] of specs){const min=num(req[minK]),max=num(req[maxK]);if(min==null&&max==null)continue;let v=num(mm?.[field]);if(v==null){const alt={bust_cm:['bust','bust_display'],chest_cm:['chest','chest_display'],waist_cm:['waist','waist_display'],hips_cm:['hips','hips_display'],height_cm:['height','height_display'],shoe:['shoe_size']}[field]||[];for(const a of alt){v=num(mm?.[a]);if(v!=null)break;}}const s=rangeScore(v,min,max);checks.push({field,value:v,min,max,score:s.score,matched:s.matched});}
 if(!checks.length)return{score:null,checks:[],label:'No explicit measurement requirement'};const known=checks.filter(x=>x.score!=null);if(!known.length)return{score:0,checks,label:'Measurement data missing'};return{score:Math.round(known.reduce((a,x)=>a+x.score,0)/known.length),checks,label:known.every(x=>x.matched)?'Measurements match':'Measurement review required'};}
function normalizeMarket(context,markets){const targetId=T(context.market_id),targetName=T(context.market||context.market_name);let market=null;if(targetId)market=markets.find(x=>String(x.id)===targetId)||null;if(!market&&targetName){const mk=marketKey(targetName);market=markets.find(x=>marketKey(x.name)===mk||marketKey(x.city)===mk||marketKey(x.code)===mk)||null;}return market||{id:targetId||null,name:targetName||null,code:null,city:null};}
function currentTravel(rows,start,end){return (rows||[]).filter(x=>active(x.status)&&overlap(x.starts_at,x.ends_at,start,end));}
function scoreCandidate(ctx){
 const {model,measurement,market,marketAssignments,availability,bookingLinks,bookingMap,castingLinks,castingMap,options,travel,visa,workAuth,history,requirements,target,clientFit}=ctx;
 const start=target.starts_at||target.start||null,end=target.ends_at||target.end||start;
 const reasons=[],blockers=[],signals=[];
 const blocked=(availability||[]).filter(x=>active(x.status)&&overlap(x.starts_at,x.ends_at,start,end));
 const bookingConf=(bookingLinks||[]).map(x=>bookingMap.get(String(x.booking_id))).filter(Boolean).filter(b=>active(b.status)&&String(b.id)!==String(target.booking_id||'')&&overlap(b.starts_at,b.ends_at,start,end));
 const castingConf=(castingLinks||[]).map(x=>castingMap.get(String(x.casting_id))).filter(Boolean).filter(c=>active(c.status)&&String(c.id)!==String(target.casting_id||'')&&overlap(c.starts_at,c.ends_at,start,end));
 const travels=currentTravel(travel,start,end);
 const assignments=(marketAssignments||[]).filter(x=>active(x.status));
 const mk=marketKey(market?.name||market?.city||market?.code||target.market||'');
 const assignedMarket=!mk?null:assignments.some(x=>marketKey(x.markets?.name||x.markets?.city||x.markets?.code)===mk);
 const travelMarket=!mk?null:travels.some(x=>marketKey(x.destination||x.destination_city||'')===mk);
 const primaryMarket=!mk?null:marketKey(model.primary_market_label||'')===mk;
 const inMarket=mk?(travelMarket||assignedMarket||primaryMarket):null;
 const wa=(workAuth||[]).filter(x=>active(x.status));
 const vc=(visa||[]).filter(x=>active(x.status));
 const authRelevant=!mk?[]:wa.filter(x=>marketKey(x.market_name||x.country_code||x.country||x.market||'')===mk||String(x.market_id||'')===String(market?.id||''));
 const visaRelevant=!mk?[]:vc.filter(x=>marketKey(x.market_name||x.country_code||x.country||x.market||'')===mk||String(x.market_id||'')===String(market?.id||''));
 let visaClear=null;if(authRelevant.some(x=>/approved|valid|clear|granted|active/i.test(L(x.status))))visaClear=true;else if(visaRelevant.some(x=>/approved|valid|clear|granted|active/i.test(L(x.status))))visaClear=true;else if(authRelevant.length||visaRelevant.length)visaClear=false;
 const activeOptions=(options||[]).filter(x=>active(x.status)&&String(x.booking_id||'')!==String(target.booking_id||''));
 const challenged=activeOptions.some(x=>L(x.status)==='challenged');
 if(blocked.length){blockers.push('Availability conflict');reasons.push(`${blocked.length} overlapping availability block${blocked.length===1?'':'s'}`);}else signals.push('Availability clear');
 if(bookingConf.length){blockers.push('Booking conflict');reasons.push(`${bookingConf.length} overlapping booking${bookingConf.length===1?'':'s'}`);}else signals.push('No booking overlap');
 if(castingConf.length){reasons.push(`${castingConf.length} overlapping casting${castingConf.length===1?'':'s'}`);}else signals.push('No casting overlap');
 if(mk&&inMarket===false){blockers.push('Movement / market presence');reasons.push(`Not currently evidenced in ${market?.name||target.market||'target market'}`);}else if(inMarket===true)signals.push('Market presence clear');
 if(mk&&visaClear===false){blockers.push('Visa / work authorization');reasons.push('Work authorization requires review');}else if(visaClear===true)signals.push('Work authorization clear');
 if(activeOptions.length)reasons.push(`${activeOptions.length} active option${activeOptions.length===1?'':'s'}${challenged?' including challenged position':''}`);
 const readinessBase=Math.max(0,100-(blocked.length?35:0)-(bookingConf.length?40:0)-(castingConf.length?12:0)-(inMarket===false?25:0)-(visaClear===false?35:0)-(activeOptions.length?Math.min(20,activeOptions.length*8):0));
 let readinessState=blockers.length?'not_ready':(activeOptions.length||castingConf.length||inMarket==null||visaClear==null?'conditional':'ready');
 if(readinessBase>=85&&!blockers.length)readinessState='ready'; else if(readinessBase<55&&blockers.length)readinessState='not_ready'; else if(readinessState!=='ready')readinessState='conditional';
 const ms=measurementScore(measurement,requirements);
 const histCount=(history||[]).length;const histScore=target.company_id?Math.min(100,histCount*25):null;
 const optionScore=activeOptions.length?Math.max(0,100-activeOptions.length*25-(challenged?20:0)):100;
 const availabilityScore=blocked.length?0:100;
 const cf=clientFit||{score:null,confidence:'insufficient',label:'No verified client-fit history',components:[],reasons:[]};
 const components=[
   {key:'readiness',label:'Market readiness',score:readinessBase,weight:40,available:true},
   {key:'availability',label:'Availability',score:availabilityScore,weight:15,available:!!start},
   {key:'measurements',label:'Measurements',score:ms.score,weight:20,available:ms.score!=null},
   {key:'options',label:'Option position',score:optionScore,weight:10,available:true},
   {key:'client_fit',label:'Client fit',score:cf.score,weight:20,available:cf.score!=null},
   {key:'client_history',label:'Direct client history',score:histScore,weight:10,available:histScore!=null}
 ];
 const usable=components.filter(x=>x.available&&x.score!=null),weightSum=usable.reduce((a,x)=>a+x.weight,0)||1;
 let total=Math.round(usable.reduce((a,x)=>a+x.score*x.weight,0)/weightSum);
 if(blockers.length)total=Math.min(total,69);if(blocked.length||bookingConf.length)total=Math.min(total,49);
 const tier=total>=85&&!blockers.length?'strong_match':total>=70?'good_match':total>=55?'review':'hold';
 return {model_id:model.id,model_name:model.display_name||model.name||'Model',primary_market:model.primary_market_label||null,score:total,tier,client_fit:cf,readiness:{state:readinessState,score:readinessBase,in_market:inMarket,visa_clear:visaClear,conflicts:blocked.length+bookingConf.length+castingConf.length},measurement_fit:ms,availability:{score:availabilityScore,blocked:blocked.length,blocks:blocked.slice(0,5)},option_position:{score:optionScore,active:activeOptions.length,challenged},client_history:{score:histScore,bookings:histCount},conflicts:{bookings:bookingConf.slice(0,5),castings:castingConf.slice(0,5),count:bookingConf.length+castingConf.length},components,reasons:[...new Set(reasons)],signals:[...new Set(signals)],blockers:[...new Set(blockers)]};
}

export const handler=async(event)=>{
 if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
 try{
  const {user,client}=await requireUser(event);const p=event.queryStringParameters||{};const {organization}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});const admin=await requirePermission(user.id,organization.id,'bookings.read');const warnings=[];
  let target={booking_id:T(p.booking_id)||null,casting_id:T(p.casting_id)||null,company_id:T(p.company_id)||null,market_id:T(p.market_id)||null,market:T(p.market)||null,starts_at:T(p.starts_at)||null,ends_at:T(p.ends_at)||null,title:T(p.title)||null,type:T(p.type)||null};
  if(target.booking_id){const b=await safeOne(admin.from('bookings').select('*').eq('organization_id',organization.id).eq('id',target.booking_id).maybeSingle(),warnings,'booking');if(b)target={...target,...b,booking_id:b.id,type:'booking'};}
  if(target.casting_id){const c=await safeOne(admin.from('castings').select('*').eq('organization_id',organization.id).eq('id',target.casting_id).maybeSingle(),warnings,'casting');if(c)target={...target,...c,casting_id:c.id,type:'casting'};}
  const requirements=parseRequirements(p.requirements);
  const [models,measurements,marketAssignments,markets,availability,bookingLinks,bookings,castingLinks,castings,options,travel,visa,workAuth,packages,packageModels,packageRecipients,tagAssignments]=await Promise.all([
    safeRows(admin.from('models').select('*').eq('organization_id',organization.id).limit(1000),warnings,'models'),
    safeRows(admin.from('model_measurements').select('*').eq('organization_id',organization.id).limit(1500),warnings,'model_measurements'),
    safeRows(admin.from('model_market_assignments').select('model_id,is_primary,status,market_id,markets(id,name,code,city)').eq('organization_id',organization.id).limit(4000),warnings,'model_market_assignments'),
    safeRows(admin.from('markets').select('id,name,code,city').eq('organization_id',organization.id).eq('active',true).limit(300),warnings,'markets'),
    safeRows(admin.from('availability_blocks').select('*').eq('organization_id',organization.id).limit(4000),warnings,'availability_blocks'),
    safeRows(admin.from('booking_models').select('*').eq('organization_id',organization.id).limit(6000),warnings,'booking_models'),
    safeRows(admin.from('bookings').select('*').eq('organization_id',organization.id).limit(2500),warnings,'bookings'),
    safeRows(admin.from('casting_models').select('*').eq('organization_id',organization.id).limit(6000),warnings,'casting_models'),
    safeRows(admin.from('castings').select('*').eq('organization_id',organization.id).limit(2500),warnings,'castings'),
    safeRows(admin.from('booking_options').select('*').eq('organization_id',organization.id).limit(3000),warnings,'booking_options'),
    safeRows(admin.from('travel_records').select('*').eq('organization_id',organization.id).limit(3000),warnings,'travel_records'),
    safeRows(admin.from('visa_cases').select('*').eq('organization_id',organization.id).limit(3000),warnings,'visa_cases'),
    safeRows(admin.from('work_authorizations').select('*').eq('organization_id',organization.id).limit(2000),warnings,'work_authorizations'),
    safeRows(admin.from('packages').select('*').eq('organization_id',organization.id).limit(2000),warnings,'packages'),
    safeRows(admin.from('package_models').select('*').eq('organization_id',organization.id).limit(6000),warnings,'package_models'),
    safeRows(admin.from('package_recipients').select('*').eq('organization_id',organization.id).limit(5000),warnings,'package_recipients'),
    safeRows(admin.from('model_tag_assignments').select('model_id,model_tags(id,name,category)').eq('organization_id',organization.id).limit(6000),warnings,'model_tag_assignments')
  ]);
  const market=normalizeMarket(target,markets);if(!target.market_id&&market?.id)target.market_id=market.id;if(!target.market&&market?.name)target.market=market.name;
  const mm=new Map(measurements.map(x=>[String(x.model_id),x])),ma=group(marketAssignments,'model_id'),ab=group(availability,'model_id'),bl=group(bookingLinks,'model_id'),cl=group(castingLinks,'model_id'),op=group(options,'model_id'),tr=group(travel,'model_id'),vi=group(visa,'model_id'),wa=group(workAuth,'model_id'),bm=new Map(bookings.map(x=>[String(x.id),x])),cm=new Map(castings.map(x=>[String(x.id),x]));
  const historyByModel=new Map();if(target.company_id){for(const link of bookingLinks){const b=bm.get(String(link.booking_id));if(!b||String(b.company_id)!==String(target.company_id)||!active(b.status)||String(b.id)===String(target.booking_id||''))continue;const k=String(link.model_id);if(!historyByModel.has(k))historyByModel.set(k,[]);historyByModel.get(k).push(b);}}
  const clientFitContext=target.company_id?buildClientFitContext({companyId:target.company_id,models,measurements,bookingModels:bookingLinks,bookings,castingModels:castingLinks,castings,packages,packageModels,packageRecipients,tagAssignments}):null;
  let candidates=models.filter(m=>m&&m.id&&!/inactive|archived|terminated/i.test(L(m.status))&&m.active!==false).map(model=>scoreCandidate({model,measurement:mm.get(String(model.id))||{},market,marketAssignments:ma.get(String(model.id))||[],availability:ab.get(String(model.id))||[],bookingLinks:bl.get(String(model.id))||[],bookingMap:bm,castingLinks:cl.get(String(model.id))||[],castingMap:cm,options:op.get(String(model.id))||[],travel:tr.get(String(model.id))||[],visa:vi.get(String(model.id))||[],workAuth:wa.get(String(model.id))||[],history:historyByModel.get(String(model.id))||[],clientFit:clientFitContext?clientFitContext.scoreModel(model.id):null,requirements,target}));
  candidates.sort((a,b)=>b.score-a.score||a.model_name.localeCompare(b.model_name));const limit=Math.max(1,Math.min(Number(p.limit||100),250));candidates=candidates.slice(0,limit);
  const summary={total:candidates.length,strong_match:candidates.filter(x=>x.tier==='strong_match').length,good_match:candidates.filter(x=>x.tier==='good_match').length,review:candidates.filter(x=>x.tier==='review').length,hold:candidates.filter(x=>x.tier==='hold').length};
  return json(200,{environment:'cavyre-decision-engine-v1',release:'16.13.14',organization:{id:organization.id,slug:organization.slug,name:organization.name},generated_at:new Date().toISOString(),target,market,requirements,client_profile:clientFitContext?.profile||null,summary,candidates,warnings,policy:{read_only:true,ranking:'deterministic',writes:false,agent_final_decision:true}});
 }catch(error){return errorResponse(error);}
};
