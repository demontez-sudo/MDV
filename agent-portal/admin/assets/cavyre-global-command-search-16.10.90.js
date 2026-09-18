(function(){
'use strict';
if(window.__CAVYRE_GLOBAL_SEARCH_161090__)return;window.__CAVYRE_GLOBAL_SEARCH_161090__=true;
var cache={at:0,rows:[]},active=0,overlay=null,input=null,list=null,loading=false;
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function org(){try{var s=window.VEUX_AGENT_V4&&VEUX_AGENT_V4.state||{},o=s.org||{};return o.slug||o.id||'maison-de-veux'}catch(e){return'maison-de-veux'}}
function api(path){if(window.VEUX_AGENT_V4&&typeof VEUX_AGENT_V4.api==='function')return VEUX_AGENT_V4.api(path,{method:'GET',headers:{},__fresh:true});return fetch(path,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
function label(o,keys,fallback){for(var i=0;i<keys.length;i++){var v=o&&o[keys[i]];if(v!=null&&String(v).trim())return String(v)}return fallback||'Untitled'}
function sub(parts){return parts.filter(Boolean).join(' · ')}
function push(out,type,route,id,title,subtitle,raw){if(!id&&type!=='calendar')return;out.push({type:type,route:route,id:id||'',title:title||'Untitled',subtitle:subtitle||'',raw:raw||{}})}
function normalize(data){
 var out=[],cal=data.cal||{},fin=data.fin||{},ro=data.ro||{},crm=data.crm||{},packs=data.packs||{},mob=data.mob||{};
 arr(ro.models||ro.roster||ro.talent).forEach(function(x){push(out,'model','roster',x.id||x.model_id,label(x,['display_name','name'],'Model'),sub([x.primary_market_label,x.stage,x.status,x.location]),x)});
 arr(crm.companies||crm.clients||crm.organizations).forEach(function(x){push(out,'client','industrydirectory',x.id||x.company_id,label(x,['name','company_name','display_name'],'Client'),sub([x.category||x.type,x.city||x.location,x.relationship_status||x.status]),x)});
 arr(crm.contacts).forEach(function(x){push(out,'contact','industrydirectory',x.id||x.contact_id,label(x,['display_name','name','full_name','email'],'Contact'),sub([x.title||x.role,x.company_name||x.company&&x.company.name,x.email]),x)});
 arr(cal.bookings).forEach(function(x){push(out,'booking','calendar',x.id||x.booking_id,label(x,['title'],'Booking'),sub([x.company&&x.company.name||x.client_name,x.location,x.market_name||x.market&&x.market.name,x.status]),x)});
 arr(cal.castings).forEach(function(x){push(out,'casting','calendar',x.id||x.casting_id,label(x,['title'],'Casting'),sub([x.company&&x.company.name||x.client_name,x.location,x.market_name||x.market&&x.market.name,x.status]),x)});
 arr(cal.events).forEach(function(x){push(out,'event','calendar',x.id||x.event_id,label(x,['title'],'Calendar Event'),sub([x.event_type||x.type,x.location,x.status]),x)});
 arr(fin.invoices).forEach(function(x){push(out,'invoice','financelegal',x.id||x.invoice_id,label(x,['invoice_number','number','title'],'Invoice'),sub([x.client_name||x.company&&x.company.name,x.status,x.due_date]),x)});
 var pkgRows=[].concat(arr(packs.packages),arr(packs.open_feedback),arr(packs.client_model_signals));
 pkgRows.forEach(function(x){var id=x.package_id||x.id;if(!id)return;push(out,'package','multipackage',id,label(x,['name','title','package_name'],'Package'),sub([x.client_name||x.client&&x.client.name,x.status||x.feedback_type,x.models&&x.models.display_name]),x)});
 arr(mob.travel).forEach(function(x){push(out,'travel','globalmobility',x.id||x.travel_id,label(x,['purpose'],'Travel'),sub([x.origin&&x.destination?x.origin+' → '+x.destination:x.destination,x.status,x.starts_at]),x)});
 arr(mob.visa_cases||mob.visas).forEach(function(x){push(out,'visa','globalmobility',x.id||x.visa_id,label(x,['case_title','visa_type','title'],'Visa'),sub([x.country||x.destination,x.status,x.expires_on||x.expiry_date]),x)});
 return out;
}
async function load(){
 if(cache.rows.length&&Date.now()-cache.at<60000)return cache.rows;
 if(loading)return cache.rows;
 loading=true;
 try{
  var now=new Date(),s=new Date(now);s.setFullYear(s.getFullYear()-1);var e=new Date(now);e.setFullYear(e.getFullYear()+1),o=encodeURIComponent(org());
  var paths=[
   '/api/agent/calendar/v9?organization='+o+'&start='+encodeURIComponent(s.toISOString())+'&end='+encodeURIComponent(e.toISOString()),
   '/api/agent/finance?organization='+o,
   '/api/agent/roster/v10?organization='+o,
   '/api/agent/crm/v9?organization='+o,
   '/api/agent/packages?organization='+o,
   '/api/agent/mobility?organization='+o
  ];
  var res=await Promise.allSettled(paths.map(api)),v=function(i){return res[i].status==='fulfilled'?(res[i].value||{}):{}};
  cache={at:Date.now(),rows:normalize({cal:v(0),fin:v(1),ro:v(2),crm:v(3),packs:v(4),mob:v(5)})};
 }finally{loading=false}
 return cache.rows;
}
function score(row,q){
 q=q.toLowerCase().trim();if(!q)return 1;
 var title=row.title.toLowerCase(),subt=row.subtitle.toLowerCase(),type=row.type.toLowerCase(),s=0;
 if(title===q)s+=120;else if(title.indexOf(q)===0)s+=90;else if(title.indexOf(q)>=0)s+=70;
 if(type===q||type.indexOf(q)===0)s+=35;
 if(subt.indexOf(q)>=0)s+=25;
 q.split(/\s+/).filter(Boolean).forEach(function(w){if(title.indexOf(w)>=0)s+=15;if(subt.indexOf(w)>=0)s+=6});
 return s;
}
function results(q){return cache.rows.map(function(r){return {r:r,s:score(r,q)}}).filter(function(x){return x.s>0}).sort(function(a,b){return b.s-a.s||a.r.title.localeCompare(b.r.title)}).slice(0,30).map(function(x){return x.r})}
function typeLabel(t){return {model:'Model',client:'Client',contact:'Contact',booking:'Booking',casting:'Casting',event:'Calendar',invoice:'Invoice',package:'Package',travel:'Travel',visa:'Visa'}[t]||t}
function render(){
 if(!list)return;var q=input.value.trim(),rows=results(q);active=Math.max(0,Math.min(active,rows.length-1));
 if(!cache.rows.length&&loading){list.innerHTML='<div class="vx161090-empty">Loading agency index…</div>';return}
 if(!rows.length){list.innerHTML='<div class="vx161090-empty">No matching agency records.</div>';return}
 list.innerHTML=rows.map(function(r,i){return '<button class="vx161090-result '+(i===active?'on':'')+'" data-i="'+i+'"><span class="vx161090-type">'+esc(typeLabel(r.type))+'</span><div><b>'+esc(r.title)+'</b><small>'+esc(r.subtitle||'Open record')+'</small></div><em>↵</em></button>'}).join('');
 list.querySelectorAll('.vx161090-result').forEach(function(b){b.onmouseenter=function(){active=Number(b.dataset.i);paintActive()};b.onclick=function(){openRow(rows[Number(b.dataset.i)])}});
}
function paintActive(){if(!list)return;list.querySelectorAll('.vx161090-result').forEach(function(b){b.classList.toggle('on',Number(b.dataset.i)===active)});var n=list.querySelector('.vx161090-result.on');if(n)n.scrollIntoView({block:'nearest'})}
function focusContract(r){
 try{sessionStorage.setItem('cavyre.command.focus',JSON.stringify({type:r.type,id:r.id,source:'global-search',at:Date.now()}))}catch(e){}
 try{window.dispatchEvent(new CustomEvent('cavyre:command-focus',{detail:{type:r.type,id:r.id,source:'global-search'}}))}catch(e){}
}
function openRow(r){
 if(!r)return;focusContract(r);close();
 if(typeof window.navTo==='function')window.navTo(r.route);
 setTimeout(function(){try{window.dispatchEvent(new CustomEvent('cavyre:global-search-open',{detail:r}))}catch(e){}},180);
}
function open(){
 ensure();overlay.hidden=false;document.documentElement.classList.add('vx161090-search-open');active=0;
 requestAnimationFrame(function(){input.focus();input.select()});
 load().then(render).catch(function(){if(list)list.innerHTML='<div class="vx161090-empty">Search index could not be loaded.</div>'});
 render();
}
function close(){if(!overlay)return;overlay.hidden=true;document.documentElement.classList.remove('vx161090-search-open')}
function ensure(){
 if(overlay)return;
 overlay=document.createElement('div');overlay.id='vx161090-search';overlay.className='vx161090-search';overlay.hidden=true;
 overlay.innerHTML='<div class="vx161090-backdrop"></div><section role="dialog" aria-modal="true" aria-label="Global agency search"><header><span>GLOBAL COMMAND</span><button type="button" aria-label="Close">×</button></header><div class="vx161090-inputwrap"><i>⌕</i><input autocomplete="off" spellcheck="false" placeholder="Search models, clients, bookings, travel, invoices…"><kbd>ESC</kbd></div><div class="vx161090-list"></div><footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>⌘K</kbd> Search anywhere</span></footer></section>';
 document.body.appendChild(overlay);input=overlay.querySelector('input');list=overlay.querySelector('.vx161090-list');
 overlay.querySelector('.vx161090-backdrop').onclick=close;overlay.querySelector('header button').onclick=close;
 input.oninput=function(){active=0;render()};
 input.onkeydown=function(e){var rows=results(input.value.trim());if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(rows.length-1,active+1);paintActive()}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);paintActive()}else if(e.key==='Enter'){e.preventDefault();openRow(rows[active])}else if(e.key==='Escape'){e.preventDefault();close()}};
}
function attach(){
 var cmd=document.querySelector('.vx73-command');if(!cmd||cmd.querySelector('.vx161090-search-btn'))return;
 var b=document.createElement('button');b.type='button';b.className='vx161090-search-btn';b.title='Global Search · ⌘K';b.setAttribute('aria-label','Open Global Search');b.innerHTML='<span>⌕</span><small>Search</small>';
 b.onclick=function(e){e.preventDefault();e.stopPropagation();open()};cmd.appendChild(b);
}
document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();open()}else if(e.key==='Escape'&&overlay&&!overlay.hidden)close()});
window.addEventListener('veux:agency-v16-shell-ready',function(){setTimeout(attach,0)});
window.addEventListener('veux:shell-ready',function(){setTimeout(attach,0)});
new MutationObserver(function(){attach()}).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
window.CAVYRE_GLOBAL_SEARCH={open:open,close:close,refresh:function(){cache={at:0,rows:[]};return load()},version:'16.10.90'};
})();