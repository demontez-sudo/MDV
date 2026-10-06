/* Shared travel-gate logic (kept identical to agent-portal/netlify/functions/agent-mobility-desk.mjs). */
const PLACE_CODES=[['FR',/\b(france|paris|lyon|nice|marseille)\b/i],['IT',/\b(italy|milan|milano|rome|roma|florence)\b/i],['GB',/\b(united kingdom|uk|england|london|manchester)\b/i],['US',/\b(united states|usa|new york|nyc|los angeles|miami|atlanta|chicago)\b/i],['DE',/\b(germany|berlin|munich|hamburg)\b/i],['ES',/\b(spain|madrid|barcelona)\b/i],['NL',/\b(netherlands|amsterdam)\b/i],['PT',/\b(portugal|lisbon|porto)\b/i],['BE',/\b(belgium|brussels)\b/i],['CH',/\b(switzerland|zurich|geneva)\b/i],['DK',/\b(denmark|copenhagen)\b/i],['SE',/\b(sweden|stockholm)\b/i],['JP',/\b(japan|tokyo)\b/i],['CN',/\b(china|shanghai|beijing)\b/i],['CA',/\b(canada|toronto|vancouver|montreal)\b/i],['AU',/\b(australia|sydney|melbourne)\b/i],['AE',/\b(uae|dubai|abu dhabi)\b/i],['ZA',/\b(south africa|cape town|johannesburg)\b/i],['NG',/\b(nigeria|lagos)\b/i],['BR',/\b(brazil|sao paulo|são paulo|rio)\b/i]];
const SCHENGEN=new Set(['FR','IT','DE','ES','NL','PT','BE','CH','DK','SE','AT','GR','FI','NO','PL','CZ','HU','LU','MT','IS','EE','LV','LT','SK','SI','LI','HR']);
function placeCountry(text){const t=String(text||'').trim();if(!t)return null;const tail=t.match(/[,\s]([A-Za-z]{2})$/);if(tail&&/,\s*[A-Za-z]{2}$/.test(t))return tail[1].toUpperCase();for(const [code,re] of PLACE_CODES)if(re.test(t))return code;return null;}
/* Passport check for a trip start date: ok / expiring (<6 months of validity left, the usual entry rule) / expired / missing. */
function passportStateFor(passports,start){
  const act=(passports||[]).filter(p=>!/^(lost|cancelled)$/.test(String(p.status||'')));
  if(!act.length)return {state:'missing',expires_on:null};
  const ref=start||new Date().toISOString().slice(0,10);
  const best=act.slice().sort((a,b)=>String(b.expires_on||'9999-12-31').localeCompare(String(a.expires_on||'9999-12-31')))[0];
  const exp=best.expires_on?String(best.expires_on).slice(0,10):null;
  if(exp&&exp<ref)return {state:'expired',expires_on:exp};
  if(exp){const six=new Date(ref+'T12:00:00');six.setMonth(six.getMonth()+6);if(exp<six.toISOString().slice(0,10))return {state:'expiring',expires_on:exp};}
  return {state:'ok',expires_on:exp};
}
/* The travel gate. `blocking` is what actually stops a trip from being booked/confirmed:
   an unapproved or lapsed visa, an expired passport, or no visa/waiver at all on a trip that is
   certainly international. Domestic trips and trips to a country the model holds a passport for are clear. */
function visaGateFor(trip,visas,passports=[]){
  const code=placeCountry(trip.destination);
  const start=trip.starts_at?String(trip.starts_at).slice(0,10):null;
  const mineP=(passports||[]).filter(p=>p.model_id===trip.model_id);
  const passport=passportStateFor(mineP,start);
  const withPassport=g=>({...g,passport,blocking:!!g.blocking||passport.state==='expired',message:passport.state==='expired'?`Passport expires ${passport.expires_on} — before this trip starts. ${g.message||''}`.trim():g.message});
  if(!code)return withPassport({state:'unknown',country_code:null,blocking:false,message:'Destination country not recognised — add the country to check visa clearance.'});
  const origin=placeCountry(trip.origin);
  if(origin&&origin===code)return withPassport({state:'domestic',country_code:code,blocking:false,message:'Domestic travel — no visa needed.'});
  if(mineP.some(p=>p.country_code===code&&!/^(lost|cancelled)$/.test(String(p.status||''))))return withPassport({state:'domestic',country_code:code,blocking:false,message:`Model holds a ${code} passport — no visa needed.`});
  const mine=visas.filter(v=>v.model_id===trip.model_id&&(v.country_code===code||(/schengen/i.test(String(v.visa_type||''))&&SCHENGEN.has(code)&&SCHENGEN.has(v.country_code))));
  const international=!!origin||mineP.length>0;
  if(!mine.length)return withPassport({state:'none',country_code:code,blocking:international,message:international?`No visa case or waiver on file for ${code}. Start a visa case, or mark "visa not required" if the model can enter without one.`:`No visa case on file for ${code}. Confirm the model does not need one.`});
  const good=mine.filter(v=>/^(approved|issued)$/.test(String(v.status||'')));
  const valid=good.find(v=>!v.expires_on||!start||String(v.expires_on).slice(0,10)>=start);
  if(valid)return withPassport({state:'clear',country_code:code,blocking:false,visa_case_id:valid.id,waiver:!!valid.metadata?.waiver,message:valid.metadata?.waiver?`Visa not required for ${code} (recorded).`:`Visa ${valid.status}${valid.expires_on?` · valid to ${String(valid.expires_on).slice(0,10)}`:''}.`});
  if(good.length)return withPassport({state:'expired',country_code:code,blocking:true,visa_case_id:good[0].id,message:`Visa expires before this trip starts (${String(good[0].expires_on).slice(0,10)}).`});
  const open=mine.find(v=>!/^(refused|cancelled|expired)$/.test(String(v.status||'')))||mine[0];
  return withPassport({state:'pending',country_code:code,blocking:true,visa_case_id:open.id,message:`Visa ${String(open.status||'not started').replace(/_/g,' ')} — must be approved before travel is confirmed.`});
}

export { placeCountry, passportStateFor, visaGateFor };
