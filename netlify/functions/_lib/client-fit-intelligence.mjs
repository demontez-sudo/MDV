const T=v=>String(v==null?'':v).trim();
const L=v=>T(v).toLowerCase();
const num=v=>{if(v==null||v==='')return null;if(typeof v==='number'&&Number.isFinite(v))return v;const m=String(v).replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
const active=v=>!/cancelled|canceled|closed|released|declined|archived|expired/i.test(L(v));
const bookedStatus=v=>/confirmed|accepted|completed|booked/i.test(L(v));
const positiveCasting=v=>/confirmed|attended|callback|selected|shortlist|option/i.test(L(v));
const marketKey=v=>L(v).replace(/[^a-z0-9]/g,'');
const median=xs=>{const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const uniq=xs=>[...new Set(xs.filter(Boolean))];
const sensitive=/race|ethnic|relig|faith|sexual|orientation|gender identity|trans|disab|health|medical|pregnan|politic|nationality|citizenship|age|birth|minor/i;
function safeTag(t){const name=T(t?.name),category=T(t?.category);if(!name||sensitive.test(name)||sensitive.test(category))return null;return {id:t?.id||null,name,category:category||null};}
function modelMeasurement(mm,key){const aliases={height_cm:['height_cm','height','height_display'],bust_cm:['bust_cm','bust','bust_display'],chest_cm:['chest_cm','chest','chest_display'],waist_cm:['waist_cm','waist','waist_display'],hips_cm:['hips_cm','hips','hips_display'],shoe:['shoe','shoe_size']}[key]||[key];for(const a of aliases){const n=num(mm?.[a]);if(n!=null)return n;}return null;}
function distribution(values){const vals=values.filter(Number.isFinite);if(!vals.length)return null;return {count:vals.length,min:Math.min(...vals),max:Math.max(...vals),median:median(vals)};}
function similarity(value,d){if(value==null||!d)return null;if(value>=d.min&&value<=d.max)return 100;const base=Math.max(1,Math.abs(d.median||value)*0.1);const dist=value<d.min?d.min-value:value-d.max;return Math.max(0,Math.round(100-(dist/base)*35));}
export function buildClientFitContext({companyId,models=[],measurements=[],bookingModels=[],bookings=[],castingModels=[],castings=[],packages=[],packageModels=[],packageRecipients=[],tagAssignments=[]}={}){
 const cid=String(companyId||'');if(!cid)return null;
 const modelMap=new Map(models.map(x=>[String(x.id),x]));const mmMap=new Map(measurements.map(x=>[String(x.model_id),x]));
 const bookingMap=new Map(bookings.map(x=>[String(x.id),x]));const castingMap=new Map(castings.map(x=>[String(x.id),x]));
 const clientBookings=bookings.filter(b=>String(b.company_id||'')===cid&&active(b.status));
 const bookedLinks=bookingModels.filter(l=>{const b=bookingMap.get(String(l.booking_id));return b&&String(b.company_id||'')===cid&&active(b.status)&&(bookedStatus(l.status)||bookedStatus(b.status));});
 const clientCastings=castings.filter(c=>String(c.company_id||'')===cid&&active(c.status));
 const castingPositive=castingModels.filter(l=>{const c=castingMap.get(String(l.casting_id));return c&&String(c.company_id||'')===cid&&positiveCasting(l.status);});
 const clientPackages=packages.filter(p=>String(p.company_id||'')===cid);const packageIds=new Set(clientPackages.map(x=>String(x.id)));
 const viewedPackageIds=new Set(packageRecipients.filter(r=>String(r.company_id||'')===cid&&((num(r.view_count)||0)>0||r.opened_at||r.first_viewed_at||r.last_viewed_at)).map(r=>String(r.package_id)));
 const engagedPackageModels=packageModels.filter(pm=>packageIds.has(String(pm.package_id))&&viewedPackageIds.has(String(pm.package_id)));
 const bookedModelIds=uniq(bookedLinks.map(x=>String(x.model_id)));const positiveCastingIds=uniq(castingPositive.map(x=>String(x.model_id)));const engagedModelIds=uniq(engagedPackageModels.map(x=>String(x.model_id)));
 const measurementKeys=['height_cm','bust_cm','chest_cm','waist_cm','hips_cm','shoe'];const measurementProfile={};for(const k of measurementKeys){measurementProfile[k]=distribution(bookedModelIds.map(id=>modelMeasurement(mmMap.get(id),k)).filter(v=>v!=null));}
 const tagsByModel=new Map();for(const a of tagAssignments){const id=String(a.model_id||'');const tag=safeTag(a.model_tags||a.tag||a);if(!id||!tag)continue;if(!tagsByModel.has(id))tagsByModel.set(id,[]);tagsByModel.get(id).push(tag);}
 const tagCounts=new Map();for(const id of bookedModelIds){for(const tag of tagsByModel.get(id)||[]){const k=L(tag.name);tagCounts.set(k,{...tag,count:(tagCounts.get(k)?.count||0)+1});}}
 const preferredTags=[...tagCounts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,10);
 const marketCounts=new Map();for(const id of bookedModelIds){const m=modelMap.get(id);const key=T(m?.primary_market_label);if(key)marketCounts.set(key,(marketCounts.get(key)||0)+1);}const preferredMarkets=[...marketCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count})).slice(0,8);
 const jobCounts=new Map();for(const b of clientBookings){const j=T(b.job_type||b.category||b.metadata?.calendar_event_type);if(j)jobCounts.set(j,(jobCounts.get(j)||0)+1);}const preferredJobTypes=[...jobCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count})).slice(0,8);
 const sample=bookedLinks.length;const confidence=sample>=8?'high':sample>=3?'medium':sample>=1?'low':'insufficient';
 const profile={company_id:cid,verified_booking_count:bookedLinks.length,verified_booked_models:bookedModelIds.length,positive_casting_count:castingPositive.length,engaged_package_models:engagedModelIds.length,confidence,measurements:measurementProfile,preferred_tags:preferredTags,preferred_markets:preferredMarkets,preferred_job_types:preferredJobTypes,policy:{historical_signal_only:true,protected_traits_excluded:true,agent_final_decision:true}};
 function scoreModel(modelId){const id=String(modelId||'');const model=modelMap.get(id)||{};const mm=mmMap.get(id)||{};const directBookings=bookedLinks.filter(x=>String(x.model_id)===id).length;const directCastings=castingPositive.filter(x=>String(x.model_id)===id).length;const engaged=engagedPackageModels.filter(x=>String(x.model_id)===id).length;
   const comps=[];if(directBookings)comps.push({key:'direct_history',label:'Verified client bookings',score:Math.min(100,60+directBookings*20),weight:30,evidence:directBookings});
   if(directCastings)comps.push({key:'casting_history',label:'Positive casting history',score:Math.min(100,55+directCastings*15),weight:15,evidence:directCastings});
   if(engaged)comps.push({key:'package_engagement',label:'Viewed package history',score:Math.min(100,55+engaged*10),weight:10,evidence:engaged});
   const sims=[];for(const k of measurementKeys){const s=similarity(modelMeasurement(mm,k),measurementProfile[k]);if(s!=null)sims.push(s);}if(sims.length>=2)comps.push({key:'measurement_pattern',label:'Historical measurement pattern',score:Math.round(sims.reduce((a,x)=>a+x,0)/sims.length),weight:25,evidence:sims.length});
   const pt=new Set(preferredTags.map(x=>L(x.name))),mt=(tagsByModel.get(id)||[]).map(x=>L(x.name));const overlap=uniq(mt.filter(x=>pt.has(x)));if(pt.size&&mt.length)comps.push({key:'professional_tags',label:'Professional tag overlap',score:Math.round((overlap.length/Math.max(1,Math.min(pt.size,mt.length)))*100),weight:10,evidence:overlap.length,matched:overlap});
   const pm=new Set(preferredMarkets.map(x=>marketKey(x.name))),mk=marketKey(model.primary_market_label);if(pm.size&&mk)comps.push({key:'market_pattern',label:'Client market pattern',score:pm.has(mk)?100:45,weight:10,evidence:model.primary_market_label||null});
   if(!comps.length)return {score:null,confidence:'insufficient',label:'No verified client-fit history',components:[],direct_bookings:0,positive_castings:0,package_engagement:0,reasons:['No verified historical signal for this model/client pair.']};
   const ws=comps.reduce((a,x)=>a+x.weight,0)||1;const score=Math.round(comps.reduce((a,x)=>a+x.score*x.weight,0)/ws);const evidenceCount=directBookings+directCastings+engaged+sims.length+overlap.length;const c=directBookings>=2||evidenceCount>=8?'high':evidenceCount>=3?'medium':'low';const reasons=[];if(directBookings)reasons.push(`${directBookings} verified booking${directBookings===1?'':'s'} with client`);if(directCastings)reasons.push(`${directCastings} positive casting outcome${directCastings===1?'':'s'}`);if(overlap.length)reasons.push(`${overlap.length} professional preference tag match${overlap.length===1?'':'es'}`);if(sims.length>=2)reasons.push('Measurements compared with verified client booking history');return {score,confidence:c,label:score>=85?'Strong historical fit':score>=70?'Good historical fit':score>=55?'Historical fit needs review':'Limited historical fit',components:comps,direct_bookings:directBookings,positive_castings:directCastings,package_engagement:engaged,reasons};
 }
 return {profile,scoreModel};
}
