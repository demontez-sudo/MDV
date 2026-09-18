
(function(){
'use strict';

(function(){
  var id='cavyre-agency-desk-runtime-style-161110';
  var old=document.getElementById(id); if(old) old.remove();
  var s=document.createElement('style'); s.id=id;
  s.textContent=`
  .vx17-command[data-mode="desk"] .vx3d-command-queue{
    display:block!important;width:100%!important;max-width:100%!important;margin:20px 0 22px!important;
    border:1px solid rgba(255,255,255,.14)!important;border-radius:14px!important;overflow:hidden!important;
    background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012) 58%,rgba(0,0,0,.16))!important;
    box-shadow:0 24px 52px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.05)!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-command-queue>header{
    display:grid!important;grid-template-columns:minmax(0,1fr) minmax(360px,460px)!important;gap:22px!important;
    align-items:end!important;padding:20px 22px!important;border-bottom:1px solid rgba(255,255,255,.10)!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-command-queue>header h3{margin:5px 0!important;font-size:20px!important;line-height:1.15!important}
  .vx17-command[data-mode="desk"] .vx3d-command-queue>header p{margin:0!important;font-size:12px!important;line-height:1.5!important}
  .vx17-command[data-mode="desk"] .vx3d-command-queue>header small{font-size:9px!important;line-height:1.3!important}
  .vx17-command[data-mode="desk"] .vx3d-counts{
    display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:8px!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-count{
    display:block!important;min-width:0!important;min-height:60px!important;padding:10px!important;
    border:1px solid rgba(255,255,255,.12)!important;border-radius:9px!important;
    background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.015))!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-count b{display:block!important;font-size:18px!important;line-height:1!important}
  .vx17-command[data-mode="desk"] .vx3d-count span{display:block!important;margin-top:6px!important;font-size:9px!important;line-height:1.25!important}
  .vx17-command[data-mode="desk"] .vx3d-priority-grid{
    display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;
    width:100%!important;padding:16px!important;margin:0!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-priority-grid>button.vx3d-priority-card{
    display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;
    width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:158px!important;
    margin:0!important;padding:16px!important;white-space:normal!important;text-align:left!important;overflow:hidden!important;
    border:1px solid rgba(255,255,255,.13)!important;border-radius:11px!important;
    background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.018) 62%,rgba(0,0,0,.16))!important;
    box-shadow:0 14px 30px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05)!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-priority-top{
    display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;margin:0 0 12px!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-priority-top em{
    display:flex!important;align-items:center!important;justify-content:center!important;width:27px!important;height:27px!important;
    flex:0 0 27px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:50%!important;font-size:10px!important;font-style:normal!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-priority-top small{display:block!important;font-size:9px!important;line-height:1.3!important}
  .vx17-command[data-mode="desk"] .vx3d-priority-card>b{
    display:block!important;width:100%!important;font-size:13px!important;line-height:1.38!important;white-space:normal!important;overflow-wrap:anywhere!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-priority-card>span{
    display:block!important;width:100%!important;margin-top:8px!important;font-size:11px!important;line-height:1.45!important;
    white-space:normal!important;overflow-wrap:anywhere!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-priority-card>i{
    display:block!important;margin-top:auto!important;padding-top:12px!important;font-size:9px!important;line-height:1.2!important;font-style:normal!important;
  }
  .vx17-command[data-mode="desk"] .vx3d-priority-card.urgent{border-top:2px solid #e7b85a!important}
  .vx17-command[data-mode="desk"] .vx3d-priority-card.critical{border-top:2px solid #ff916b!important}
  .vx17-command[data-mode="desk"] .vx3d-priority-card.blocked{border-top:2px solid #ff6b6b!important}
  .vx17-command[data-mode="desk"] .vx3d-priority-card.action_required{border-top:2px solid var(--skin-accent,var(--gold))!important}
  @media(max-width:1180px){
    .vx17-command[data-mode="desk"] .vx3d-command-queue>header{grid-template-columns:1fr!important}
    .vx17-command[data-mode="desk"] .vx3d-priority-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  }
  @media(max-width:760px){
    .vx17-command[data-mode="desk"] .vx3d-counts{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    .vx17-command[data-mode="desk"] .vx3d-priority-grid{grid-template-columns:1fr!important;padding:12px!important}
  }`;
  document.head.appendChild(s);

  s.textContent += `
  /* 16.11.11 Agency Overview chart geometry authority */
  .vx17-command[data-mode="overview"] .vx17-main-grid{
    align-items:start!important;
  }
  .vx17-command[data-mode="overview"] .vx17-overview-panel{
    display:grid!important;
    grid-template-rows:auto auto 188px!important;
    height:auto!important;min-height:0!important;max-height:none!important;
    align-self:start!important;overflow:hidden!important;
  }
  .vx17-command[data-mode="overview"] .vx17-overview-panel>.vx17-bars{
    position:relative!important;display:flex!important;align-items:flex-end!important;
    width:100%!important;height:188px!important;min-height:188px!important;max-height:188px!important;
    margin:0!important;padding:20px 18px 30px!important;gap:12px!important;overflow:hidden!important;
  }
  .vx17-command[data-mode="overview"] .vx17-overview-panel .vx17-bar{
    flex:1 1 0!important;align-self:flex-end!important;height:var(--h,40%)!important;
    min-height:22px!important;max-height:132px!important;margin:0!important;
    border-radius:7px 7px 2px 2px!important;
  }
  .vx17-command[data-mode="overview"] .vx17-overview-panel .vx17-bar span{
    bottom:-19px!important;font-size:9px!important;line-height:1!important;
  }
  @media(min-width:1500px){
    .vx17-command[data-mode="overview"] .vx17-overview-panel{grid-template-rows:auto auto 200px!important}
    .vx17-command[data-mode="overview"] .vx17-overview-panel>.vx17-bars{height:200px!important;min-height:200px!important;max-height:200px!important}
    .vx17-command[data-mode="overview"] .vx17-overview-panel .vx17-bar{max-height:142px!important}
  }
  @media(max-width:760px){
    .vx17-command[data-mode="overview"] .vx17-overview-panel{grid-template-rows:auto auto 160px!important}
    .vx17-command[data-mode="overview"] .vx17-overview-panel>.vx17-bars{height:160px!important;min-height:160px!important;max-height:160px!important;padding:16px 10px 28px!important;gap:7px!important}
    .vx17-command[data-mode="overview"] .vx17-overview-panel .vx17-bar{max-height:108px!important}
  }`;

  // Keep this style node last if a skin or late stylesheet is injected later.
  new MutationObserver(function(){
    if(s.parentNode===document.head && s!==document.head.lastElementChild){
      document.head.appendChild(s);
    }
  }).observe(document.head,{childList:true});
})();
if(window.__VEUX_SMART_PORTAL_161111__)return;window.__VEUX_SMART_PORTAL_161111__=true;
var MODE='overview';
var WAVES={
classic:['#C9A66B','#E2C58F','rgba(201,166,107,.14)','rgba(201,166,107,.06)','rgba(201,166,107,.31)','#15120e','#060504','#F1E4D4','#CBBBA5','#93816D'],
green:['#50E3A4','#8FF7CC','rgba(80,227,164,.14)','rgba(80,227,164,.06)','rgba(80,227,164,.30)','#0C1A15','#020605','#E7FFF5','#B2D7C8','#73998A'],
blue:['#5B9DFF','#93BEFF','rgba(91,157,255,.14)','rgba(91,157,255,.06)','rgba(91,157,255,.30)','#0D1522','#020408','#EDF5FF','#B7C9DF','#7D91AA'],
red:['#FF645F','#FF9A94','rgba(255,100,95,.14)','rgba(255,100,95,.06)','rgba(255,100,95,.31)','#21100F','#070202','#FFF0ED','#D8B8B3','#A17D79'],
white:['#F4F4F1','#FFFFFF','rgba(244,244,241,.115)','rgba(244,244,241,.05)','rgba(244,244,241,.24)','#121418','#040506','#F8F8F5','#C8CBD0','#8D929A'],
purple:['#9B78D0','#CBB3EF','rgba(155,120,208,.14)','rgba(155,120,208,.06)','rgba(155,120,208,.31)','#171020','#080510','#F7F0FF','#CBBBD8','#91829F'],
burntOrange:['#C8753E','#E6A06C','rgba(200,117,62,.14)','rgba(200,117,62,.06)','rgba(200,117,62,.31)','#21130C','#0D0603','#FFF2E8','#D8B9A3','#9C7C68'],
turquoise:['#4FBDB5','#83DDD6','rgba(79,189,181,.14)','rgba(79,189,181,.06)','rgba(79,189,181,.30)','#0B211F','#020B0B','#EDFFFD','#B2D7D3','#789B98'],
blueNude:['#8EAFC3','#BDD0DB','rgba(142,175,195,.13)','rgba(142,175,195,.055)','rgba(142,175,195,.27)','#152630','#071016','#F1F7FA','#C0CED5','#879AA4'],
greenNude:['#9BA58A','#C4CBB8','rgba(155,165,138,.13)','rgba(155,165,138,.055)','rgba(155,165,138,.27)','#192018','#080B07','#F4F6EF','#C6CBBD','#8F9786'],
galaxy:['#A98BFF','#D8C8FF','rgba(169,139,255,.16)','rgba(169,139,255,.065)','rgba(169,139,255,.34)','#10111D','#03040A','#F8F5FF','#CAC5DB','#85829A'],
christmas:['#D5B56D','#F5DCA0','rgba(213,181,109,.15)','rgba(213,181,109,.06)','rgba(213,181,109,.31)','#111915','#030705','#F9F4E8','#D3CBB9','#918B7F'],
earth:['#55D7C1','#91F4E1','rgba(85,215,193,.15)','rgba(85,215,193,.06)','rgba(85,215,193,.31)','#0B1718','#010606','#EEFFFB','#B8D9D4','#759995'],
waterfall:['#52D6E0','#A5F7FA','rgba(82,214,224,.15)','rgba(82,214,224,.06)','rgba(82,214,224,.31)','#0A171A','#010609','#F0FEFF','#B8D8DC','#71969B']
};
function arr(v){return Array.isArray(v)?v:[]}function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function bridge(){return window.VEUX_AGENT_V4}function org(){var s=bridge()&&bridge().state||{};return s.org&&s.org.slug||'maison-de-veux'}function api(path){return bridge().api(path,{method:'GET',headers:{},__fresh:true})}
function money(n,c){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:0,notation:Number(n)>=100000?'compact':'standard'}).format(Number(n||0))}catch(e){return '$'+Number(n||0).toLocaleString()}}
function dkey(v){var d=new Date(v);return isNaN(d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}function clock(tz){try{return new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit'}).format(new Date())}catch(e){return '—'}}
function nav(p){if(window.navTo)window.navTo(p)}function openVera(){var b=document.getElementById('_asst-btn');if(b)b.click()}function range(){var s=new Date();s.setHours(0,0,0,0);var e=new Date(s);e.setDate(e.getDate()+8);return{s:s,e:e}}
function amount(x){var rates=arr(x.booking_rates);if(rates.length)return rates.reduce(function(n,r){return n+(Number(r.talent_gross)||((Number(r.quantity)||1)*(Number(r.unit_amount)||0)))},0);var m=x.metadata||{};return Number(m.pay_amount||x.pay_amount||x.rate_amount||x.total_amount||x.amount||0)||0}
function rosterFromCalendar(cal){var seen={};['bookings','castings','events'].forEach(function(k){arr(cal[k]).forEach(function(x){var links=x[k==='bookings'?'booking_models':k==='castings'?'casting_models':'event_models'];arr(links).forEach(function(m){var q=m.models||m;if(q&&q.id)seen[q.id]=q})})});return Object.values(seen)}
function conflicts(cal){var it=[];function add(kind,x,links){it.push({k:kind+x.id,s:+new Date(x.starts_at),e:+new Date(x.ends_at||new Date(x.starts_at).getTime()+3600000),m:arr(links).map(function(z){return z.model_id||(z.models&&z.models.id)}).filter(Boolean)})}arr(cal.bookings).forEach(function(x){add('b',x,x.booking_models)});arr(cal.castings).forEach(function(x){add('c',x,x.casting_models)});arr(cal.events).forEach(function(x){add('e',x,x.event_models)});var o={};it.forEach(function(a,i){it.forEach(function(b,j){if(i>=j)return;if(a.s<b.e&&b.s<a.e&&a.m.some(function(id){return b.m.indexOf(id)>=0})){o[a.k]=1;o[b.k]=1}})});return Object.keys(o).length}
function taskSummary(d){var all=arr(d.tasks),open=all.filter(function(x){return !/done|complete|cancel/i.test(x.status||'')});return{open:open,urgent:open.filter(function(x){return /urgent|critical|high/i.test(x.priority||'')}),approvals:arr(d.approvals).filter(function(x){return /pending|review/i.test(x.status||'pending')})}}
function financeSummary(d){var dash=d.dashboard||d.summary||{},inv=arr(d.invoices),payments=arr(d.payments),accounts=arr(d.model_accounts||d.accounts),now=Date.now(),over=inv.filter(function(x){return /overdue/i.test(x.status||'')||(+new Date(x.due_date)<now&&Number(x.amount_due||x.balance_due||0)>0)}),dueSoon=inv.filter(function(x){var due=+new Date(x.due_date),bal=Number(x.amount_due||x.balance_due||0);return bal>0&&due>=now&&due<=now+7*86400000}),unpaid=inv.filter(function(x){return Number(x.amount_due||x.balance_due||0)>0}),paid=inv.filter(function(x){return /paid|settled/i.test(x.status||'')||Number(x.amount_due||x.balance_due||0)<=0}),outstanding=Number(dash.outstanding_total||unpaid.reduce(function(a,x){return a+Number(x.amount_due||x.balance_due||0)},0)),overdueTotal=over.reduce(function(a,x){return a+Number(x.amount_due||x.balance_due||0)},0);return{outstanding:outstanding,overdue:over,overdueTotal:overdueTotal,dueSoon:dueSoon,unpaid:unpaid,paid:paid,invoices:inv,payments:payments,accounts:accounts,currency:dash.currency||'USD',collectionRisk:over.length?Math.min(100,Math.round((over.length/Math.max(1,unpaid.length))*100)):0}}
function pkgSignal(d){return arr(d.open_feedback).length+arr(d.client_model_signals).filter(function(x){return Number(x.weighted_score||0)>0}).length}
function marketCount(cal,name){var rx=name==='Paris'?/paris|france/i:/new york|nyc|brooklyn|manhattan/i,n=0;['bookings','castings','events'].forEach(function(k){arr(cal[k]).forEach(function(x){if(rx.test([x.location,x.market_name,x.market,x.markets&&x.markets.name].filter(Boolean).join(' ')))n++})});return n}
function series(cal){var r=range(),o=[];for(var i=0;i<7;i++){var d=new Date(r.s);d.setDate(d.getDate()+i);o.push({k:dkey(d),l:d.toLocaleDateString([],{weekday:'narrow'}),v:0})}['bookings','castings','events'].forEach(function(k){arr(cal[k]).forEach(function(x){var f=o.find(function(z){return z.k===dkey(x.starts_at)});if(f)f.v++})});return o}
function mobilitySignals(d){var bookings=arr(d.lookups&&d.lookups.bookings),all=[],counts={blocked:0,critical:0,watch:0,action_required:0};bookings.forEach(function(b){var m=b.mobility||{},c=m.conflict;if(!c&&m.status&&m.status!=='clear')c={severity:m.status,code:'mobility_'+m.status,message:'Mobility readiness is '+String(m.status).replaceAll('_',' ')+'.',recommended_action:'Open Travel & Visa and review readiness.'};if(!c)return;var sev=String(c.severity||m.status||'watch').toLowerCase();if(counts[sev]!==undefined)counts[sev]++;else counts.watch++;all.push({booking:b,severity:sev,code:c.code||'mobility_conflict',message:c.message||'Mobility conflict detected.',recommended_action:c.recommended_action||'Review Travel & Visa.',arrival_buffer_minutes:m.arrival_buffer_minutes,travel_status:m.travel_status});});all.sort(function(a,b){var rank={blocked:0,critical:1,action_required:2,watch:3};return (rank[a.severity]??9)-(rank[b.severity]??9)});return{items:all,counts:counts,total:all.length};}
function relationshipSignals(d){var companies=arr(d.companies||d.clients||d.organizations),activity=arr(d.activity||d.activities||d.timeline),contacts=arr(d.contacts),now=Date.now(),stale=[],hot=[];companies.forEach(function(c){var last=c.last_activity_at||c.last_contact_at||c.updated_at,days=last?Math.floor((now-new Date(last).getTime())/86400000):9999,score=Number(c.relationship_score||c.score||0),status=String(c.relationship_status||c.status||'').toLowerCase();if(days>30||/cold|stale|inactive|at_risk/.test(status))stale.push({company:c,days:days,score:score});if(score>=70||/hot|priority|vip|key_account|preferred/.test(status))hot.push({company:c,days:days,score:score});});stale.sort(function(a,b){return b.days-a.days});hot.sort(function(a,b){return b.score-a.score});return{companies:companies,contacts:contacts,activity:activity,stale:stale,hot:hot,total:companies.length};}
async function load(){var r=range(),s=encodeURIComponent(org()),paths=['/api/agent/calendar/v9?organization='+s+'&start='+encodeURIComponent(r.s.toISOString())+'&end='+encodeURIComponent(r.e.toISOString()),'/api/agent/finance?organization='+s,'/api/agent/tasks/v10?organization='+s,'/api/agent/packages?organization='+s,'/api/agent/roster/v10?organization='+s,'/api/agent/mobility?organization='+s,'/api/agent/crm/v9?organization='+s],res=await Promise.allSettled(paths.map(api)),v=function(i){return res[i].status==='fulfilled'?(res[i].value||{}):{}},failures=res.map(function(x,i){return x.status==='rejected'?{index:i,error:String(x.reason&&x.reason.message||x.reason||'Request failed')}:null}).filter(Boolean),cal=v(0),fin=financeSummary(v(1)),tasks=taskSummary(v(2)),packs=v(3),ro=v(4),mob=v(5),crm=v(6),models=arr(ro.models||ro.roster||ro.talent);if(!models.length)models=rosterFromCalendar(cal);var ready=models.filter(function(m){return !/inactive|archive|paused|hold/i.test(String(m.status||m.roster_status||''))}).length;var mobility=mobilitySignals(mob),relationships=relationshipSignals(crm);return{cal:cal,finance:fin,tasks:tasks,packs:packs,mobilityRaw:mob,mobility:mobility,crmRaw:crm,relationships:relationships,module_failures:failures,models:models,ready:ready,bookings:arr(cal.bookings),castings:arr(cal.castings),events:arr(cal.events),conflicts:conflicts(cal),pkg:pkgSignal(packs)}}
function veraSignals(p){var q=[],rank={blocked:0,critical:1,urgent:2,action_required:3,watch:4,clear:5};function add(s,d,title,detail,nav,type,id){s=String(s||'watch').toLowerCase();if(rank[s]==null)s='watch';q.push({severity:s,domain:d,title:title,detail:detail,nav:nav,recordType:type||'',recordId:id||''});}
arr(p.mobility&&p.mobility.items).forEach(function(x){var b=x.booking||{},s=String(x.severity||'watch').toLowerCase();add(s==='blocked'?'blocked':s==='critical'?'critical':s==='action_required'?'action_required':'watch','Mobility',b.title||'Travel / visa readiness',x.message||x.recommended_action||'Review mobility readiness.','globalmobility','booking',b.id||b.booking_id);});
if(p.conflicts)add('critical','Calendar',p.conflicts+' schedule conflict'+(p.conflicts===1?'':'s'),'Assigned talent has overlapping calendar movement.','calendar','calendar','conflicts');
arr(p.tasks&&p.tasks.urgent).forEach(function(x){add('urgent','Tasks',x.title||'High-priority task',x.priority||x.status||'Requires agency action.','tasksconsolidated','task',x.id);});
arr(p.finance&&p.finance.overdue).forEach(function(x){add('urgent','Finance',x.invoice_number||'Overdue invoice',money(x.amount_due||x.balance_due||0,x.currency||p.finance.currency)+' remains due.','financelegal','invoice',x.id||x.invoice_id);});
arr(p.finance&&p.finance.dueSoon).forEach(function(x){add('watch','Finance',x.invoice_number||'Invoice due soon','Payment is due within 7 days.','financelegal','invoice',x.id||x.invoice_id);});
arr(p.relationships&&p.relationships.stale).slice(0,5).forEach(function(x){add('watch','Relationship',(x.company&&x.company.name)||'Client follow-up',x.days>999?'No recent relationship activity.':x.days+' days since relationship activity.','industrydirectory','client',x.company&&(x.company.id||x.company.company_id));});
arr(p.tasks&&p.tasks.approvals).forEach(function(x){add('action_required','Approval',x.title||'Human approval required',x.status||'Decision is waiting for approval.','approvals','approval',x.id);});
arr(p.packs&&p.packs.open_feedback).slice(0,5).forEach(function(x){add('action_required','Packages',(x.models&&x.models.display_name)||'Package response',x.feedback_type||'Client package activity requires review.','multipackage','package',x.package_id||x.id);});
if(!arr(p.packs&&p.packs.open_feedback).length&&p.pkg)add('watch','Packages',p.pkg+' package/client signal'+(p.pkg===1?'':'s'),'Package activity suggests a follow-up opportunity.','multipackage','package','');
arr(p.models).filter(function(m){return /missing|incomplete|expired|blocked/i.test(String(m.readiness_status||m.materials_status||m.compliance_status||''))}).slice(0,5).forEach(function(m){add('action_required','Model',m.display_name||m.name||'Model readiness','Model profile or readiness requires review.','roster','model',m.id||m.model_id);});
arr(p.module_failures).forEach(function(f){add('watch','System','Intelligence source unavailable','A portal intelligence source failed to load. Vera is operating with partial context.','overview','system',String(f.index));});
q.sort(function(a,b){return rank[a.severity]-rank[b.severity]});if(!q.length)add('clear','Agency','Operations clear','No blocked, urgent, action-required or watch signal is active.','overview','','');return q;}
function priority(p){return veraSignals(p).slice(0,6).map(function(s){return[s.domain+' '+s.severity.replaceAll('_',' '),s.title,s.detail,s.nav]})}
function veraActionQueue(p){return veraSignals(p).slice(0,12);}
function veraQueueHTML(p){
 var q=veraActionQueue(p),c={blocked:0,critical:0,urgent:0,action_required:0,watch:0,clear:0};
 q.forEach(function(x){c[x.severity]=(c[x.severity]||0)+1});
 var counts=['blocked','critical','urgent','action_required','watch'].map(function(k){
   return '<div class="vx3d-count '+k+'"><b>'+c[k]+'</b><span>'+k.replaceAll('_',' ')+'</span></div>';
 }).join('');
 var cards=q.map(function(x,i){
   return '<button class="vx3d-priority-card '+esc(x.severity)+'" data-vx17-nav="'+esc(x.nav)+'" data-vx17-record-type="'+esc(x.recordType)+'" data-vx17-record-id="'+esc(x.recordId)+'">'+
   '<div class="vx3d-priority-top"><em>'+(i+1)+'</em><small>'+esc(x.severity.replaceAll('_',' '))+' · '+esc(x.domain)+'</small></div>'+
   '<b>'+esc(x.title)+'</b><span>'+esc(x.detail)+'</span><i>Open →</i></button>';
 }).join('');
 return '<section class="vx3d-command-queue"><header><div><small>Vera · Unified Command Queue</small><h3>Agency Action Priority</h3><p>One signal authority across Travel, Calendar, Tasks, Finance, Relationships, Packages, Models and Approvals.</p></div><div class="vx3d-counts">'+counts+'</div></header><div class="vx3d-priority-grid">'+cards+'</div></section>';
}
function attention(p){var a=[];if(p.mobility&&p.mobility.total){var top=p.mobility.items[0];a.push('resolve '+p.mobility.total+' mobility conflict'+(p.mobility.total===1?'':'s')+(top?' — '+top.message:''));}if(p.relationships&&p.relationships.stale.length)a.push('follow up with '+p.relationships.stale.length+' relationship'+(p.relationships.stale.length===1?'':'s'));if(p.conflicts)a.push('resolve '+p.conflicts+' calendar conflict'+(p.conflicts===1?'':'s'));if(p.tasks.urgent.length)a.push('clear '+p.tasks.urgent.length+' high-priority task'+(p.tasks.urgent.length===1?'':'s'));if(p.finance.overdue.length)a.push('review '+p.finance.overdue.length+' overdue invoice'+(p.finance.overdue.length===1?'':'s'));if(p.pkg)a.push('follow up on '+p.pkg+' client signal'+(p.pkg===1?'':'s'));return a.length?a.slice(0,3).join(', ').replace(/^./,function(x){return x.toUpperCase()})+'.':'Agency operations are balanced. Vera is watching calendar movement, client response, roster readiness and finance state.'}
function orb(){var m=window.__VEUX_AGENT_MOUNT__;if(m==null)m=/^\/(?:admin|team)(?:\/|$)/.test(location.pathname)?'/admin':'';return m+'/assets/vera/vera-mark.svg?v=16.10.22'}
function smartCards(){return[['♙','Smart Roster','Readiness, materials, market coverage and model context.','roster'],['□','Four Calendars','Orbit, Runway Timeline, Week Command and Season Matrix.','calendar'],['◎','Agency Model','Connected model context across bookings, development and mobility.','roster'],['◇','Client Signals','Packages, relationships and follow-up intelligence.','multipackage']].map(function(x){return'<button class="vx17-smart-card" data-vx17-nav="'+x[3]+'"><i>'+x[0]+'</i><b>'+x[1]+'</b><span>'+x[2]+'</span><em>Open smart surface →</em></button>'}).join('')}
function desk(p){var q=[];arr(p.mobility&&p.mobility.items).slice(0,3).forEach(function(x){q.push(['✈',(x.booking&&x.booking.title)||'Mobility conflict',String(x.severity).replaceAll('_',' ')+' · '+x.message,'globalmobility'])});arr(p.relationships&&p.relationships.stale).slice(0,2).forEach(function(x){q.push(['◎',(x.company&&x.company.name)||'Client relationship',(x.days>999?'No recent activity':x.days+' days since contact'),'industrydirectory'])});p.finance.overdue.slice(0,2).forEach(function(x){q.push(['$ ',x.invoice_number||'Overdue invoice',money(x.amount_due||x.balance_due||0,x.currency||p.finance.currency)+' overdue','financelegal'])});p.tasks.open.slice(0,3).forEach(function(x){q.push(['✓',x.title||'Task',x.priority||x.status||'Open','tasksconsolidated'])});p.finance.overdue.slice(0,2).forEach(function(x){q.push(['$',x.invoice_number||'Invoice',money(x.amount_due||0,x.currency||'USD')+' due','financelegal'])});arr(p.packs.open_feedback).slice(0,2).forEach(function(x){q.push(['◇',(x.models&&x.models.display_name)||'Package response',x.feedback_type||'Client action','multipackage'])});if(!q.length)q.push(['✦','No critical desk queue','Vera will surface new action here','overview']);return q.map(function(x){return'<div class="vx17-desk-item" data-vx17-nav="'+x[3]+'"><i>'+x[0]+'</i><div><b>'+esc(x[1])+'</b><span>'+esc(x[2])+'</span></div><em>Open →</em></div>'}).join('')}
function publishVeraSignals(p){var signals=veraSignals(p);try{window.__CAVYRE_VERA_SIGNALS__=signals;window.dispatchEvent(new CustomEvent('cavyre:vera-signals',{detail:{signals:signals,generated_at:new Date().toISOString()}}));}catch(e){}return signals;}
function build(el,p){

publishVeraSignals(p);var total=p.models.length,readyPct=total?Math.round(p.ready/total*100):100,ss=series(p.cal),mx=Math.max.apply(null,ss.map(function(x){return x.v}))||1,bars=ss.map(function(x){return'<div class="vx17-bar" style="--h:'+Math.max(18,Math.round(x.v/mx*100))+'%"><span>'+x.l+'</span></div>'}).join(''),sig=priority(p).map(function(s){return'<button class="vx17-signal" data-vx17-nav="'+s[3]+'"><small>'+esc(s[0])+'</small><b>'+esc(s[1])+'</b><span>'+esc(s[2])+'</span></button>'}).join(''),value=p.bookings.reduce(function(n,x){return n+amount(x)},0)+p.events.reduce(function(n,x){return n+amount(x)},0),hero=MODE==='desk'?'What needs action right now?':'What needs attention today?',h='<div class="vx17-command" data-mode="'+MODE+'">';
h+='<div class="vx17-head"><div><div class="vx17-eye">Vera Command · Live operating view</div><h1>Agency <em>Command</em></h1><p>The agency record becomes a decision-ready operating system: schedule, talent, clients, tasks and finance in one intelligent view.</p><div class="vx17-modebar"><button class="vx17-mode '+(MODE==='overview'?'on':'')+'" data-vx17-mode="overview">Overview</button><button class="vx17-mode '+(MODE==='desk'?'on':'')+'" data-vx17-mode="desk">Agency Desk</button></div></div><div class="vx17-head-actions"><button class="vx17-btn" data-vx17-nav="calendar">Open Smart Calendars</button><button class="vx17-btn primary" data-vx17-vera>Vera Intelligence</button></div></div>';
if(p.module_failures&&p.module_failures.length){h+='<section class="vx161068-module-warning"><b>System connection notice</b><span>'+esc(p.module_failures.length+' intelligence module'+(p.module_failures.length===1?'':'s')+' could not refresh. The rest of Agency Command remains active.')+'</span></section>';}
h+='<section class="vx17-attention"><div><small>Vera Intelligence · Human approval required</small><h2>'+hero+'</h2><p>'+esc(attention(p))+'</p></div><button class="vx17-vera-orb" data-vx17-vera aria-label="Open Vera Intelligence"><svg class="cvy-vera-native" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="46" fill="#09080d" stroke="#9b7548" stroke-width="2"/><path d="M48 20c2.5 14.5 9.5 21.5 24 24-14.5 2.5-21.5 9.5-24 24-2.5-14.5-9.5-21.5-24-24 14.5-2.5 21.5-9.5 24-24Z" fill="#d3a85f"/><circle cx="48" cy="44" r="3.5" fill="#f4dfb8"/></svg></button></section>';
if(MODE==='desk')h+=veraQueueHTML(p);
h+='<section class="vx161061-mobility"><header><div><small>Vera · Mobility Conflict Intelligence</small><h3>Operational Readiness</h3></div><button data-vx17-nav="visa">Open Travel & Visa</button></header>'+(p.mobility&&p.mobility.items.length?p.mobility.items.slice(0,4).map(function(x){var b=x.booking||{},buf=x.arrival_buffer_minutes;return '<article class="'+esc(x.severity)+'"><div><small>'+esc(String(x.severity).replaceAll('_',' '))+' · '+esc(x.code)+'</small><b>'+esc(b.title||'Booking mobility')+'</b><span>'+esc(x.message)+'</span></div><div class="vx161061-mob-meta"><em>'+(buf==null?'No buffer':buf<0?'Late '+Math.abs(Math.round(buf/60*10)/10)+'h':Math.floor(buf/60)+'h '+(buf%60)+'m buffer')+'</em><button data-vx17-nav="visa">'+esc(x.recommended_action)+'</button></div></article>'}).join(''):'<div class="vx161061-clear"><b>Mobility clear</b><span>No booking-level travel/visa conflict is active.</span></div>')+'</section>';
h+='<section class="vx161063-finance"><header><div><small>Vera · Finance Intelligence</small><h3>Revenue Command</h3></div><button data-vx17-nav="agentcommissions">Open Finance</button></header><div class="vx161063-fin-kpis"><div><small>Outstanding</small><b>'+money(p.finance.outstanding,p.finance.currency)+'</b></div><div><small>Overdue</small><b>'+money(p.finance.overdueTotal,p.finance.currency)+'</b></div><div><small>Due ≤ 7 Days</small><b>'+p.finance.dueSoon.length+'</b></div><div><small>Collection Risk</small><b>'+p.finance.collectionRisk+'%</b></div></div>'+(p.finance.overdue.length?'<div class="vx161063-fin-stream">'+p.finance.overdue.slice(0,4).map(function(x){var amt=Number(x.amount_due||x.balance_due||0),days=x.due_date?Math.max(0,Math.floor((Date.now()-new Date(x.due_date).getTime())/86400000)):0;return '<article><div><small>OVERDUE · '+days+'D</small><b>'+esc(x.invoice_number||'Invoice')+'</b><span>'+money(amt,x.currency||p.finance.currency)+' remains due</span></div><button data-vx17-nav="agentcommissions">Review Collection →</button></article>'}).join('')+'</div>':'<div class="vx161063-fin-clear"><b>No overdue invoice risk</b><span>'+p.finance.dueSoon.length+' invoice'+(p.finance.dueSoon.length===1?'':'s')+' due within the next seven days.</span></div>')+'</section>';
h+='<section class="vx161062-relationship"><header><div><small>Vera · Relationship Intelligence</small><h3>Client Relationship Command</h3></div><button data-vx17-nav="industrydirectory">Open CRM</button></header><div class="vx161062-rel-kpis"><div><small>Clients</small><b>'+((p.relationships&&p.relationships.total)||0)+'</b></div><div><small>Priority</small><b>'+arr(p.relationships&&p.relationships.hot).length+'</b></div><div><small>Follow-Up</small><b>'+arr(p.relationships&&p.relationships.stale).length+'</b></div><div><small>Contacts</small><b>'+arr(p.relationships&&p.relationships.contacts).length+'</b></div></div>'+(p.relationships&&p.relationships.stale.length?'<div class="vx161062-rel-stream">'+p.relationships.stale.slice(0,4).map(function(x){var c=x.company||{};return '<article><div><small>FOLLOW-UP SIGNAL</small><b>'+esc(c.name||'Client')+'</b><span>'+(x.days>999?'No recent relationship activity':esc(x.days+' days since activity'))+'</span></div><button data-vx17-nav="industrydirectory">Open Relationship →</button></article>'}).join('')+'</div>':'<div class="vx161062-rel-clear"><b>Relationship coverage clear</b><span>No stale client relationship is currently flagged.</span></div>')+'</section>';
h+='<div class="vx17-market-grid"><div class="vx17-market"><small>New York</small><b>'+clock('America/New_York')+'</b><span>'+marketCount(p.cal,'New York')+' active events · live agency time</span></div><div class="vx17-market"><small>Paris</small><b>'+clock('Europe/Paris')+'</b><span>'+marketCount(p.cal,'Paris')+' active events · live agency time</span></div><div class="vx17-market"><small>Roster Ready</small><b>'+readyPct+'%</b><span>'+p.ready+' ready now · '+Math.max(0,total-p.ready)+' updates</span></div></div>';
h+='<div class="vx17-main-grid"><section class="vx17-panel '+(MODE==='desk'?'vx17-desk-panel':'vx17-overview-panel')+'"><header><h3>'+(MODE==='desk'?'Agency Desk Queue':'Agency Overview')+'</h3><small>Live connected workspace</small></header><div class="vx17-kpis"><div class="vx17-kpi"><small>'+(MODE==='desk'?'Open Tasks':'Bookings')+'</small><b>'+(MODE==='desk'?p.tasks.open.length:p.bookings.length)+'</b><span>'+(MODE==='desk'?p.tasks.urgent.length+' high priority':'This 8-day window')+'</span></div><div class="vx17-kpi"><small>'+(MODE==='desk'?'Conflicts':'Packages')+'</small><b>'+(MODE==='desk'?p.conflicts:arr(p.packs.packages).length)+'</b><span>'+(MODE==='desk'?'Calendar risk':'Client submissions')+'</span></div><div class="vx17-kpi"><small>'+(MODE==='desk'?'Approvals':'Active Talent')+'</small><b>'+(MODE==='desk'?p.tasks.approvals.length:total)+'</b><span>'+(MODE==='desk'?'Human decisions':readyPct+'% ready')+'</span></div><div class="vx17-kpi"><small>'+(MODE==='desk'?'Outstanding':'Calendar Value')+'</small><b>'+(MODE==='desk'?money(p.finance.outstanding,'USD'):money(value,'USD'))+'</b><span>'+(MODE==='desk'?'Finance watch':'Connected pay')+'</span></div></div>'+(MODE==='desk'?'<div class="vx17-desk-queue">'+desk(p)+'</div>':'<div class="vx17-bars">'+bars+'</div>')+'</section>';
h+='<section class="vx17-panel vx17-priority-panel"><header><h3>Priority Stream</h3><small>Why each signal matters</small></header><div class="vx17-priority">'+sig+'</div></section></div><div class="vx17-smart-grid">'+smartCards()+'</div></div>';el.innerHTML=h;bind(el)}
function focusRecord(b){var type=b.dataset.vx17RecordType||'',id=b.dataset.vx17RecordId||'';if(!type||!id)return;try{sessionStorage.setItem('cavyre.command.focus',JSON.stringify({type:type,id:id,source:'vera-command',at:Date.now()}));}catch(e){}try{window.dispatchEvent(new CustomEvent('cavyre:command-focus',{detail:{type:type,id:id,source:'vera-command'}}));}catch(e){}}
function bind(el){el.querySelectorAll('[data-vx17-nav]').forEach(function(b){b.onclick=function(){focusRecord(b);nav(b.dataset.vx17Nav)}});el.querySelectorAll('[data-vx17-vera]').forEach(function(b){b.onclick=openVera});el.querySelectorAll('[data-vx17-mode]').forEach(function(b){b.onclick=function(){MODE=b.dataset.vx17Mode;renderOverview(document.getElementById('p-overview')||el)}})}
async function renderOverview(el){el.innerHTML='<div class="vx17-command"><section class="vx17-attention"><div><small>Vera Command · Synchronizing</small><h2>Building agency intelligence…</h2><p>Connecting calendar, roster, tasks, packages and finance.</p></div></section></div>';try{var p=await load();build(el,p);window.VEUX_SMART_PORTAL.last=p}catch(e){el.innerHTML='<div class="vx17-command"><section class="vx17-attention"><div><small>Vera Command</small><h2>Agency intelligence could not load.</h2><p>'+esc(e&&e.message||e)+'</p></div></section></div>'}}
function applyWave(theme,persist){
  theme=WAVES[theme]?theme:'classic';
  var v=WAVES[theme],r=document.documentElement;
  var n=['--wave','--wave-bright','--wave-soft','--wave-faint','--wave-line','--paper','--void','--ink','--ink2','--mute'];
  r.setAttribute('data-veux-wave',theme);
  if(document.body){document.body.setAttribute('data-veux-wave',theme);document.body.dataset.colorWave=theme;}
  var app=document.getElementById('app');if(app)app.dataset.colorWave=theme;
  n.forEach(function(k,i){r.style.setProperty(k,v[i])});
  r.style.setProperty('--gold',v[0]);r.style.setProperty('--goldl',v[1]);r.style.setProperty('--goldp',v[2]);

  /* Bridge legacy Smart Portal variables into the current full-skin system. */
  r.style.setProperty('--skin-accent',v[0]);
  r.style.setProperty('--skin-accent2',v[1]);
  r.style.setProperty('--skin-soft',v[2]);
  r.style.setProperty('--skin-glow',v[4]);
  r.style.setProperty('--skin-card',v[5]);
  r.style.setProperty('--skin-card2',v[5]);
  r.style.setProperty('--skin-0',v[6]);
  r.style.setProperty('--skin-1',v[5]);
  r.style.setProperty('--skin-2',v[5]);
  r.style.setProperty('--skin-3',v[5]);
  r.style.setProperty('--skin-text',v[7]);
  r.style.setProperty('--skin-text2',v[8]);
  r.style.setProperty('--skin-muted',v[9]);
  r.style.setProperty('--skin-line',v[4]);
  r.style.setProperty('--skin-line2',v[0]);

  if(persist!==false){
    try{
      localStorage.setItem('veux:color-wave',theme);
      localStorage.setItem('veux:color-wave:'+org(),theme);
    }catch(e){}
  }
  document.querySelectorAll('.vx-wave-option').forEach(function(b){
    b.classList.toggle('on',b.dataset.wave===theme);
    b.setAttribute('aria-pressed',b.dataset.wave===theme?'true':'false');
  });
  var s=document.querySelector('.vx-wave-status');
  if(s){
    var labels={burntOrange:'Burnt Orange',blueNude:'Blue Nude',greenNude:'Green Nude',purple:'Purple',turquoise:'Turquoise',classic:'Classic',green:'Green',blue:'Blue',red:'Red',white:'White',galaxy:'Galaxy',christmas:'Christmas',earth:'Earth',waterfall:'Waterfall'};
    s.innerHTML='Active wave: <strong>'+(labels[theme]||theme)+'</strong> · applied across the live portal';
  }
  window.dispatchEvent(new CustomEvent('veux:smart-wave-applied',{detail:{theme:theme}}));
}
function waveRepair(){var old=window.VEUX_COLOR_WAVES&&window.VEUX_COLOR_WAVES.set;if(window.VEUX_COLOR_WAVES){window.VEUX_COLOR_WAVES.set=function(t){try{old&&old.call(window.VEUX_COLOR_WAVES,t)}catch(e){}applyWave(t,true)};window.VEUX_COLOR_WAVES.force=applyWave}document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('.vx-wave-option[data-wave]');if(!b)return;e.preventDefault();e.stopPropagation();applyWave(b.dataset.wave,true)},true);var saved='classic';try{saved=localStorage.getItem('veux:color-wave:'+org())||localStorage.getItem('veux:color-wave')||document.documentElement.getAttribute('data-veux-wave')||'classic'}catch(e){}applyWave(saved,false)}
var CTX={roster:['Smart Roster','Vera watches readiness, market coverage, missing materials and model movement.'],financelegal:['Smart Finance','Vera watches booking value, invoice state, receivables and payout risk.'],multipackage:['Client Signals','Vera watches opens, responses, model interest and follow-up momentum.'],tasksconsolidated:['Smart Tasks','Vera watches due dates, ownership, approvals and blocked workflows.'],globalmobility:['Smart Mobility','Vera watches visa readiness, travel movement and market-entry risk.'],industrydirectory:['Relationship Intelligence','Vera watches client activity, contact strength and booking momentum.'],modeldevelopment:['Development Intelligence','Vera watches evaluations, assets, training and readiness changes.'],team:['Agency Operations','Vera watches ownership, workload and handoff clarity.'],approvals:['Decision Intelligence','Vera surfaces the decisions that require human approval.'],systemsettings:['System Intelligence','Configure the portal environment, Vera and Color Waves.']}
function inject(){var p=window._currentPage,c=CTX[p];if(!c||p==='overview'||p==='calendar')return;var panel=document.getElementById('p-'+p);if(!panel||!panel.classList.contains('on')||panel.querySelector('[data-vx17-context]'))return;var root=panel.querySelector('.v148-page,.v152-page,.v1682-mob')||panel,head=root.querySelector('.v148-head,.v152-head,.v1682-head,.ph');if(!head)return;head.insertAdjacentHTML('afterend','<div class="vx17-context" data-vx17-context><div><small>Vera · '+esc(c[0])+'</small><b>'+esc(c[1])+'</b><span>Context follows the active agency record and current page.</span></div><div class="vx17-context-actions"><button data-vx17-context-vera>Ask Vera</button><button data-vx17-context-refresh>Refresh Intelligence</button></div></div>');var bar=root.querySelector('[data-vx17-context]');bar.querySelector('[data-vx17-context-vera]').onclick=openVera;bar.querySelector('[data-vx17-context-refresh]').onclick=function(){try{window.VEUX_PERF&&VEUX_PERF.invalidate&&VEUX_PERF.invalidate(p);window.rerender&&window.rerender(p)}catch(e){}}}
function claimOverview(){
  window.renderOverview=renderOverview;
  var p=document.getElementById('p-overview');
  if(!p)return;
  var active=p.classList.contains('on')||window._currentPage==='overview'||(!window._currentPage&&document.querySelector('.panel.on')===p);
  if(active&&!p.querySelector('.vx17-command'))renderOverview(p);
}
function start(){
  window.renderOverview=renderOverview;
  waveRepair();inject();claimOverview();
  var scheduled=false;
  function schedule(){
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(function(){scheduled=false;inject();claimOverview();});
  }
  document.addEventListener('click',schedule);
  window.addEventListener('popstate',schedule);
  window.addEventListener('hashchange',schedule);
  window.addEventListener('veux:agency-v16-session',schedule);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VEUX_SMART_PORTAL={version:'16.10.22',last:null,mode:function(m){MODE=m==='desk'?'desk':'overview';var e=document.getElementById('p-overview');if(e)renderOverview(e)},refresh:function(){var e=document.getElementById('p-overview');if(e)renderOverview(e)},applyWave:applyWave,askVera:openVera,claimOverview:claimOverview};
})();
