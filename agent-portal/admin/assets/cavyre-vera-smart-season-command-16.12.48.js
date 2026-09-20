/* CAVYRE 16.12.48 — Vera Smart Season Command */
(function(){'use strict';
if(window.__CAVYRE_SMART_SEASON_161248__)return;window.__CAVYRE_SMART_SEASON_161248__=1;
var S={data:null,seasonId:null,tab:'overview',filter:'all',query:'',vera:'insights'};
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('CAVYRE secure bridge is not ready');return VEUX_AGENT_V4}
function org(){var s=bridge().state||{};return s.org&&s.org.slug||'maison-de-veux'}
function get(){return bridge().api('/api/agent/season/v9?organization='+encodeURIComponent(org()),{method:'GET',headers:{}})}
function pd(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v))?new Date(v+'T12:00:00'):new Date(v)} function dt(v){if(!v)return'—';try{return pd(v).toLocaleDateString([],{month:'short',day:'2-digit',year:'numeric'})}catch(e){return v}}
function short(v){if(!v)return'—';try{return pd(v).toLocaleDateString([],{month:'short',day:'numeric'})}catch(e){return v}}
function days(v){if(!v)return null;return Math.ceil((pd(v)-new Date())/86400000)}
function current(){var ss=(S.data&&S.data.seasons)||[];return ss.find(function(x){return x.id===S.seasonId})||ss.find(function(x){return x.status==='active'})||ss[0]||null}
function models(){var c=current();return ((S.data&&S.data.season_models)||[]).filter(function(x){return c&&x.season_id===c.id})}
function shows(){var c=current();return ((S.data&&S.data.shows)||[]).filter(function(x){return c&&x.season_id===c.id})}
function readiness(m){return Array.isArray(m.season_readiness_items)?m.season_readiness_items:[]}
function missing(m){return readiness(m).filter(function(x){return ['missing','blocked','in_progress'].includes(String(x.status||'').toLowerCase())})}
function status(m){var st=String(m.status||'planned').toLowerCase(),r=Number(m.readiness_percent||0);if(st==='at_risk'||r<60)return'at_risk';if(r>=85||st==='confirmed')return'ready';return'development'}
function label(s){return String(s||'').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase()})}
function modelName(m){return m.models&&m.models.display_name||'Model'}
function stats(){var ms=models(),sh=shows();return{models:ms.length,ready:ms.filter(function(x){return status(x)==='ready'}).length,dev:ms.filter(function(x){return status(x)==='development'}).length,risk:ms.filter(function(x){return status(x)==='at_risk'}).length,shows:sh.length,confirmed:sh.filter(function(x){return x.status==='confirmed'}).length,travel:((S.data&&S.data.travel)||[]).filter(function(x){var c=current();return c&&(!x.starts_at||(!c.starts_on||new Date(x.starts_at)>=new Date(c.starts_on))&&(!c.ends_on||new Date(x.starts_at)<=new Date(c.ends_on))) }).length}}
function health(){var x=stats();return x.models?Math.round(x.ready/x.models*100):0}
function riskModels(){return models().filter(function(x){return status(x)!=='ready'||missing(x).length}).sort(function(a,b){return Number(a.readiness_percent||0)-Number(b.readiness_percent||0)})}
function keyReq(m){var a=missing(m).slice(0,2);return a.length?a.map(function(x){return'<span class="ss48-req '+(x.status==='blocked'?'bad':'warn')+'">'+E(label(x.item_type||x.title||x.name||'Requirement'))+'</span>'}).join(''):'<span class="ss48-muted">—</span>'}
function assigned(m){var id=m.model_id,a=[];shows().forEach(function(sh){(sh.season_show_models||[]).forEach(function(sm){if(sm.model_id===id)a.push(sh.title)})});return a}
function nav(p){if(typeof window.navTo==='function')window.navTo(p)}
function modelOpen(m){var id=m.model_id;if(window.VEUX_V10&&VEUX_V10.openModel)return VEUX_V10.openModel(id);window._veuxV10ModelId=id;nav('modelpage')}
function topSeasonTabs(){var ss=(S.data&&S.data.seasons)||[];return ss.slice(0,5).map(function(x){return'<button class="'+(current()&&x.id===current().id?'on':'')+'" data-ss-season="'+E(x.id)+'">'+E(x.name)+'</button>'}).join('')}
function timeline(c){var sh=shows().filter(function(x){return x.starts_at}).slice(0,5);var pts=[];if(c&&c.starts_on)pts.push({d:c.starts_on,t:'Market Start'});sh.slice(0,3).forEach(function(x){pts.push({d:x.starts_at,t:x.title})});if(c&&c.ends_on)pts.push({d:c.ends_on,t:'Market End'});return'<div class="ss48-timeline">'+pts.slice(0,5).map(function(x){return'<div><b>'+E(short(x.d))+'</b><span>'+E(x.t)+'</span><i></i></div>'}).join('')+'</div>'}
function showCards(){var sh=shows().slice(0,5);return sh.length?sh.map(function(x){return'<button class="ss48-show" data-ss-tab="shows"><time>'+E(short(x.starts_at))+'</time><b>'+E(x.title||'Show')+'</b><span>'+E(x.companies&&x.companies.name||x.location||label(x.status))+'</span></button>'}).join(''):'<div class="ss48-empty">No shows added to this season yet.</div>'}
function rows(){
 var q=S.query.toLowerCase(),ms=models().filter(function(m){var ok=S.filter==='all'||status(m)===S.filter;return ok&&(!q||modelName(m).toLowerCase().includes(q))});
 if(!ms.length)return'<div class="ss48-empty big">No season models match this view.</div>';
 return ms.map(function(m){var st=status(m),as=assigned(m);return'<div class="ss48-row" data-model="'+E(m.model_id)+'"><span class="ss48-check"></span><button class="ss48-person" data-open-model="'+E(m.model_id)+'"><i>'+E(modelName(m).split(/\s+/).map(function(x){return x[0]}).slice(0,2).join(''))+'</i><b>'+E(modelName(m))+'</b></button><span class="ss48-status '+st+'"><i></i>'+E(label(st))+'</span><span class="ss48-ready"><b>'+Number(m.readiness_percent||0)+'%</b><i><em style="width:'+Math.min(100,Number(m.readiness_percent||0))+'%"></em></i></span><span class="ss48-reqs">'+keyReq(m)+'</span><span class="ss48-shows">'+(as.length?as.slice(0,3).map(function(x){return'<b>'+E(x)+'</b>'}).join(''):'—')+'</span><span>'+E(short(m.arrival_at))+' – '+E(short(m.departure_at))+'</span><button class="ss48-more" data-open-model="'+E(m.model_id)+'">•••</button></div>'}).join('')
}
function veraPanel(){
 var st=stats(),risks=riskModels().slice(0,5),h=health(),c=current();
 var rec=[];risks.forEach(function(m){var miss=missing(m)[0];rec.push({n:modelName(m),x:miss?'Resolve '+label(miss.item_type||miss.title||'readiness requirement'):'Review '+status(m),sev:status(m)==='at_risk'?'URGENT':'HIGH'})});
 var content='';
 if(S.vera==='insights')content='<section class="ss48-health"><div class="ss48-ring" style="--p:'+h+'"><strong>'+h+'%</strong></div><div><b>'+(h>=80?'On Track':h>=60?'Needs Focus':'At Risk')+'</b><span>'+st.ready+' of '+st.models+' models ready</span><small><i class="g"></i>'+st.ready+' Ready &nbsp; <i class="y"></i>'+st.dev+' Development &nbsp; <i class="r"></i>'+st.risk+' At Risk</small></div></section><section><header>TOP PRIORITIES <button data-ss-vera="actions">View All →</button></header>'+risks.map(function(m,i){var miss=missing(m)[0];return'<button class="ss48-priority" data-open-model="'+E(m.model_id)+'"><i>'+(i+1)+'</i><span><b>'+E(modelName(m))+'</b><small>'+E(miss?label(miss.item_type||miss.title||'Readiness item')+' needs attention':Number(m.readiness_percent||0)+'% season readiness')+'</small></span><em class="'+(status(m)==='at_risk'?'urgent':'high')+'">'+(status(m)==='at_risk'?'URGENT':'HIGH')+'</em></button>'}).join('')+'</section><section><header>VERA RECOMMENDS</header>'+rec.slice(0,5).map(function(x){return'<button class="ss48-rec" data-ss-vera="actions"><span>✦</span><b>'+E(x.x)+'</b><small>'+E(x.n)+'</small><i>›</i></button>'}).join('')+'</section>';
 else if(S.vera==='actions')content='<section><header>SEASON ACTION QUEUE</header>'+risks.map(function(m){return'<button class="ss48-priority" data-open-model="'+E(m.model_id)+'"><span><b>'+E(modelName(m))+'</b><small>'+E(Number(m.readiness_percent||0)+'% ready · '+missing(m).length+' open requirement'+(missing(m).length===1?'':'s'))+'</small></span><em class="'+(status(m)==='at_risk'?'urgent':'high')+'">OPEN</em></button>'}).join('')+'</section><section><header>QUICK ACTIONS</header><button class="ss48-rec" data-go="calendar"><span>◫</span><b>Open Orbit Calendar</b><i>›</i></button><button class="ss48-rec" data-go="globalmobility"><span>✈</span><b>Review Movement</b><i>›</i></button><button class="ss48-rec" data-go="multipackage"><span>□</span><b>Build Season Package</b><i>›</i></button></section>';
 else if(S.vera==='research')content='<section class="ss48-vera-copy"><header>SEASON RESEARCH</header><h3>Research the market with Vera</h3><p>Use Vera live public research for designers, casting teams, clients and professional relationships relevant to '+E(c&&c.name||'this season')+'.</p><button class="ss48-primary" data-go="industrydirectory">Open Relationships Research →</button></section>';
 else content='<section class="ss48-vera-copy"><header>VERA COMMAND</header><h3>What do you want to accomplish?</h3><p>Ask Vera to prioritize the season, identify readiness gaps, prepare movement, or surface models requiring attention.</p><div class="ss48-command"><input id="ss48-vera-q" placeholder="Ask Vera about this season…"><button data-ss-ask>→</button></div><div id="ss48-answer"></div></section>';
 return'<aside class="ss48-vera"><div class="ss48-vera-title"><i>✦</i><div><h2>VERA INTELLIGENCE</h2><span>Season · '+E(c&&c.name||'—')+'</span></div></div><nav><button class="'+(S.vera==='insights'?'on':'')+'" data-ss-vera="insights">INSIGHTS</button><button class="'+(S.vera==='actions'?'on':'')+'" data-ss-vera="actions">ACTIONS</button><button class="'+(S.vera==='research'?'on':'')+'" data-ss-vera="research">RESEARCH</button><button class="'+(S.vera==='chat'?'on':'')+'" data-ss-vera="chat">CHAT</button></nav>'+content+'</aside>'
}
function mainContent(){
 var c=current(),st=stats();if(!c)return'<div class="ss48-empty big">No seasons have been created yet.</div>';
 if(S.tab==='overview'||S.tab==='talent')return'<div class="ss48-kpis"><div><i>♟</i><strong>'+st.models+'</strong><span>MODELS</span></div><div><i>◆</i><strong>'+st.ready+'</strong><span>READY</span></div><div><i>◉</i><strong>'+st.dev+'</strong><span>IN DEVELOPMENT</span></div><div><i>●</i><strong>'+st.risk+'</strong><span>AT RISK</span></div><div><i>♟</i><strong>'+st.shows+'</strong><span>SHOWS</span></div><div><i>◔</i><strong>'+st.confirmed+'</strong><span>CONFIRMED</span></div><div><i>✈</i><strong>'+st.travel+'</strong><span>MOVEMENTS</span></div></div><div class="ss48-middle"><section><header>SEASON TIMELINE</header>'+timeline(c)+'</section><section><header>SHOW CALENDAR <button data-ss-tab="shows">View All Shows →</button></header><div class="ss48-showgrid">'+showCards()+'</div></section></div><section class="ss48-talent"><header><h2>SEASON TALENT</h2><div class="ss48-filters"><button class="'+(S.filter==='all'?'on':'')+'" data-ss-filter="all">ALL '+st.models+'</button><button class="'+(S.filter==='ready'?'on':'')+'" data-ss-filter="ready">READY '+st.ready+'</button><button class="'+(S.filter==='development'?'on':'')+'" data-ss-filter="development">DEVELOPMENT '+st.dev+'</button><button class="'+(S.filter==='at_risk'?'on':'')+'" data-ss-filter="at_risk">AT RISK '+st.risk+'</button></div><input id="ss48-search" value="'+E(S.query)+'" placeholder="Search models…"></header><div class="ss48-tablehead"><span></span><span>MODEL</span><span>STATUS</span><span>READINESS</span><span>KEY REQUIREMENTS</span><span>SHOWS</span><span>MARKET DATES</span><span>ACTIONS</span></div>'+rows()+'</section>';
 if(S.tab==='shows')return'<section class="ss48-focus"><header><div><small>SEASON COMMAND</small><h2>Shows</h2><p>'+st.shows+' shows connected to '+E(c.name)+'.</p></div></header><div class="ss48-showlist">'+shows().map(function(x){return'<article><time>'+E(short(x.starts_at))+'</time><div><h3>'+E(x.title)+'</h3><p>'+E(x.location||x.companies&&x.companies.name||'Location not set')+'</p></div><b>'+E(label(x.status))+'</b><span>'+((x.season_show_models||[]).length)+' models</span></article>'}).join('')+'</div></section>';
 if(S.tab==='development')return'<section class="ss48-focus"><header><div><small>SEASON COMMAND</small><h2>Development</h2><p>Models that require work before or during '+E(c.name)+'.</p></div></header>'+riskModels().map(function(m){return'<article class="ss48-dev" data-open-model="'+E(m.model_id)+'"><div><h3>'+E(modelName(m))+'</h3><p>'+Number(m.readiness_percent||0)+'% ready · '+missing(m).length+' open readiness items</p></div><b>'+E(label(status(m)))+'</b><span>'+keyReq(m)+'</span></article>'}).join('')+'</section>';
 if(S.tab==='movement'||S.tab==='visa')return'<section class="ss48-focus"><header><div><small>SEASON COMMAND</small><h2>'+(S.tab==='movement'?'Movement':'Visa & Compliance')+'</h2><p>Season-linked operational readiness.</p></div><button class="ss48-primary" data-go="'+(S.tab==='movement'?'globalmobility':'visa')+'">Open Full Desk →</button></header>'+riskModels().map(function(m){return'<article class="ss48-dev" data-open-model="'+E(m.model_id)+'"><div><h3>'+E(modelName(m))+'</h3><p>'+E(short(m.arrival_at))+' – '+E(short(m.departure_at))+'</p></div><b>'+Number(m.readiness_percent||0)+'%</b><span>'+keyReq(m)+'</span></article>'}).join('')+'</section>';
 return'<section class="ss48-focus"><header><div><small>SEASON COMMAND</small><h2>'+E(label(S.tab))+'</h2><p>Connected season intelligence and operating context.</p></div></header><div class="ss48-empty big">This view uses the current season record. Open Vera Intelligence for priorities and next actions.</div></section>'
}
function render(el){
 var c=current(),d=days(c&&c.starts_on);el.innerHTML='<div class="ss48"><div class="ss48-top"><div><small>SEASON</small><h1>'+E(c&&c.name||'Season')+' <span>⌄</span></h1><p>'+E(dt(c&&c.starts_on))+' – '+E(dt(c&&c.ends_on))+'</p></div><div class="ss48-season-tabs">'+topSeasonTabs()+'</div><div class="ss48-state"><b>● '+E(label(c&&c.status||'planning'))+'</b>'+(d!=null?'<span>'+Math.abs(d)+' DAYS '+(d>=0?'TO MARKET':'IN MARKET')+'</span>':'')+'</div></div><div class="ss48-tabs">'+['overview','talent','development','casting & clients','shows','movement','visa & compliance','results'].map(function(x){var k=x.replace(/ & /g,'').replace(/\s/g,'');if(x==='casting & clients')k='casting';if(x==='visa & compliance')k='visa';return'<button class="'+(S.tab===k||(S.tab==='overview'&&x==='overview')?'on':'')+'" data-ss-tab="'+k+'">'+x.toUpperCase()+'</button>'}).join('')+'</div><div class="ss48-layout"><main>'+mainContent()+'</main>'+veraPanel()+'</div></div>';
 bind(el)
}
function ask(){
 var q=(document.getElementById('ss48-vera-q')||{}).value||'',a=document.getElementById('ss48-answer'),st=stats(),r=riskModels();if(!a||!q.trim())return;
 var low=q.toLowerCase(),ans;if(/attention|priority|urgent|risk/.test(low))ans=r.length?(r.slice(0,3).map(function(m){return modelName(m)+' ('+m.readiness_percent+'% ready)'}).join(', ')+' need the most attention.'):'No current readiness risks are recorded.';else if(/ready|readiness/.test(low))ans=st.ready+' of '+st.models+' models are currently season-ready ('+health()+'%).';else if(/show|casting/.test(low))ans=st.shows+' shows are connected to this season, with '+st.confirmed+' confirmed.';else ans='For this season, '+st.ready+' models are ready, '+st.dev+' are in development and '+st.risk+' are at risk. Use Actions for the operational queue or Research for live public intelligence.';a.innerHTML='<div class="ss48-answer"><small>VERA ANALYSIS · CAVYRE DATA</small><p>'+E(ans)+'</p></div>'
}
function bind(el){
 el.querySelectorAll('[data-ss-season]').forEach(function(b){b.onclick=function(){S.seasonId=b.dataset.ssSeason;S.filter='all';S.query='';render(el)}});
 el.querySelectorAll('[data-ss-tab]').forEach(function(b){b.onclick=function(){S.tab=b.dataset.ssTab;render(el)}});
 el.querySelectorAll('[data-ss-filter]').forEach(function(b){b.onclick=function(){S.filter=b.dataset.ssFilter;render(el)}});
 el.querySelectorAll('[data-ss-vera]').forEach(function(b){b.onclick=function(){S.vera=b.dataset.ssVera;render(el)}});
 el.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){nav(b.dataset.go)}});
 el.querySelectorAll('[data-open-model]').forEach(function(b){b.onclick=function(){var m=models().find(function(x){return x.model_id===b.dataset.openModel});if(m)modelOpen(m)}});
 var q=el.querySelector('#ss48-search');if(q)q.oninput=function(){S.query=q.value;var body=el.querySelector('.ss48-talent');if(body){var head=body.querySelector('header').outerHTML,th=body.querySelector('.ss48-tablehead').outerHTML;body.innerHTML=head+th+rows();bind(el)}};
 var askb=el.querySelector('[data-ss-ask]');if(askb)askb.onclick=ask;
}
async function smartRender(el){el.innerHTML='<div class="ss48-loading">VERA · Building Season Command…</div>';try{S.data=await get();var ss=S.data.seasons||[];if(!S.seasonId)S.seasonId=(ss.find(function(x){return x.status==='active'})||ss[0]||{}).id||null;render(el)}catch(e){el.innerHTML='<div class="ss48-loading bad"><b>Season Command could not load.</b><span>'+E(e.message||e)+'</span></div>'}}
function seasonHost(){return document.getElementById('p-seasonmanagement')||document.getElementById('p-season')||document.querySelector('[data-page-root="seasonmanagement"],[data-page-root="season"]')}
function routeRepair(){
  if(window.VEUX_V15_ROUTE_RENDERERS){
    window.VEUX_V15_ROUTE_RENDERERS.seasonmanagement=smartRender;
    window.VEUX_V15_ROUTE_RENDERERS.season=smartRender;
  }
}
function lockName(name){
  try{
    var current=window[name];
    if(current&&current!==smartRender)smartRender.__legacy=current;
    var d=Object.getOwnPropertyDescriptor(window,name);
    if(d&&d.get&&d.get.__cavyreSeason161250)return;
    var getter=function(){return smartRender}; getter.__cavyreSeason161250=true;
    Object.defineProperty(window,name,{
      configurable:true,
      enumerable:true,
      get:getter,
      set:function(v){if(v&&v!==smartRender)smartRender.__legacy=v}
    });
  }catch(_e){window[name]=smartRender}
}
function takeover(){
  smartRender.__smart161248=true;
  smartRender.__smart161250=true;
  lockName('renderSeasonManagement');
  lockName('renderSeasonSchedule');
  lockName('renderSeasonGameplan');
  routeRepair();
  var el=seasonHost();
  if(el&&(el.classList.contains('on')||el.offsetParent!==null)){
    var marker=el.querySelector('.ss48');
    if(!marker)smartRender(el);
  }
}
function install(){takeover()}
setTimeout(install,0);
setTimeout(install,350);
setTimeout(install,1200);
['veux:v15.5-ready','veux:agency-v16-ready','veux:v13-6-ready','veux:shell-ready','veux:assets-ready'].forEach(function(ev){window.addEventListener(ev,function(){setTimeout(takeover,0)})});
window.addEventListener('veux:page-rendered',function(e){
  var p=e&&e.detail&&e.detail.page;
  if(!p||p==='season'||p==='seasonmanagement')setTimeout(takeover,0);
});
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('[data-p="season"],[data-p="seasonmanagement"],[data-page="season"],[data-page="seasonmanagement"],[data-nav="season"],[data-nav="seasonmanagement"]');
  if(b)setTimeout(takeover,40);
},true);
window.CAVYRE_SMART_SEASON_161248={render:smartRender,install:install,takeover:takeover,state:S,release:'16.12.50'};
})();