/* My Shoot Plan (model portal): the shoot plan your agent chose to share with you. Read only. */
(function(){
'use strict';
if(window.MDV_MODEL_SHOOT)return;
var UI={plan:null,tab:null};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function boot(){return window.VEUX_MODEL&&VEUX_MODEL.getBoot?VEUX_MODEL.getBoot():{};}
function plans(){var p=boot().shoot_plans;return Array.isArray(p)?p:[];}
function list(a){a=a||[];return a.length?'<ul class="msp-ul">'+a.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'';}
function blk(b){return '<div class="msp-blk'+(b.avoid?' avoid':'')+'"><h5>'+esc(b.title)+'</h5>'+(b.text||[]).map(function(t){return '<p>'+esc(t)+'</p>';}).join('')+list(b.items)+'</div>';}
function paras(a){return (a||[]).map(function(t,i){return '<p class="'+(i===0?'msp-lede':'')+'">'+esc(t)+'</p>';}).join('');}
function viewBrief(b){
  var shift=(b.shift||[]).length?'<h5 class="msp-h">'+esc(b.shiftTitle||'The shift')+'</h5><div class="msp-shift">'+b.shift.map(function(s){return '<div><span>'+esc(s.from)+'</span><b>'+esc(s.to)+'</b></div>';}).join('')+'</div>':'';
  return '<div class="msp-eyebrow">'+esc(b.eyebrow)+'</div><h2 class="msp-title">'+esc(b.heading)+'</h2><div class="msp-two"><div>'+paras(b.paragraphs)+'</div><div>'+(b.blocks||[]).map(blk).join('')+'</div></div>'+shift;
}
function viewShoot(s){
  var cols=(s.shots&&s.shots.columns)||[],rows=(s.shots&&s.shots.rows)||[];
  var table=rows.length?'<h5 class="msp-h">Shot list · '+rows.length+' shots</h5><div class="msp-tw"><table><thead><tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.cells.map(function(c,i){var cls=i===0?' class="n"':(i===1?' class="shot"':(i===r.cells.length-1?' class="use'+(r.hero?' hero':'')+'"':''));return '<td'+cls+'>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>':'';
  var day=(s.day&&s.day.items&&s.day.items.length)?'<h5 class="msp-h">'+esc(s.day.title||'Run of day')+'</h5><div class="msp-day">'+s.day.items.map(function(d){return '<div><time>'+esc(d.time)+'</time><span>'+esc(d.text)+'</span></div>';}).join('')+'</div>':'';
  return '<div class="msp-eyebrow">'+esc(s.eyebrow)+'</div><h2 class="msp-title"><i>'+esc(s.roman)+'</i> '+esc(s.name)+' <em>'+esc(s.tag)+'</em></h2>'
   +'<div class="msp-two"><div>'+paras(s.paragraphs)+((s.words||[]).length?'<div class="msp-words">'+s.words.map(function(w){return '<span>'+esc(w)+'</span>';}).join('')+'</div>':'')+'</div><div>'+(s.refs||[]).map(blk).join('')+'</div></div>'
   +((s.specs||[]).length?'<div class="msp-specs">'+s.specs.map(blk).join('')+'</div>':'')+((s.direction||[]).length?'<div class="msp-dir">'+s.direction.map(blk).join('')+'</div>':'')+table+day;
}
function viewBook(b){return '<div class="msp-eyebrow">'+esc(b.eyebrow)+'</div><h2 class="msp-title">'+esc(b.heading)+'</h2>'+(b.intro?'<p class="msp-lede">'+esc(b.intro)+'</p>':'')+'<div class="msp-book">'+(b.pages||[]).map(function(x){return '<div class="'+(x.cut?'cut':'')+'"><span>'+esc(x.pg)+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.sub)+'</small></div>';}).join('')+'</div>';}
function viewPrep(b){return '<div class="msp-eyebrow">'+esc(b.eyebrow)+'</div><h2 class="msp-title">'+esc(b.heading)+'</h2><div class="msp-prep">'+(b.groups||[]).map(blk).join('')+'</div>';}
function tabsOf(p){
  var t=[];if(p.brief)t.push(['brief','Brief']);
  (p.shoots||[]).forEach(function(s){t.push([s.key,(s.roman?s.roman+' · ':'')+s.name]);});
  if(p.book)t.push(['book','Book order']);if(p.prep)t.push(['prep','Prep']);return t;
}
function bodyFor(p,tab){
  if(tab==='brief'&&p.brief)return viewBrief(p.brief);
  if(tab==='book'&&p.book)return viewBook(p.book);
  if(tab==='prep'&&p.prep)return viewPrep(p.prep);
  var s=(p.shoots||[]).filter(function(x){return x.key===tab;})[0];return s?viewShoot(s):'';
}
function render(el){
  var all=plans();
  var head='<header class="v15m-head"><div><div class="v15m-kicker">DEVELOPMENT · SHOOT PLAN</div><h1>My Shoot Plan</h1><p>Your agent shared this with you. It covers what we are shooting, what to wear and prepare, and how each day runs.</p></div></header>';
  if(!all.length){el.innerHTML='<div class="v15m-page msp">'+head+'<div class="v15m-card"><div class="v15m-empty">Nothing has been shared with you yet.</div></div></div>';return;}
  var cur=all.filter(function(x){return x.id===UI.plan;})[0]||all[0];if(UI.plan!==cur.id){UI.plan=cur.id;UI.tab=null;}
  var tabs=tabsOf(cur),tab=tabs.some(function(t){return t[0]===UI.tab;})?UI.tab:(tabs[0]&&tabs[0][0]);UI.tab=tab;
  var sel=all.length>1?'<select class="msp-sel" id="msp-plan">'+all.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===cur.id?' selected':'')+'>'+esc(x.title)+'</option>';}).join('')+'</select>':'';
  var facts=(cur.facts||[]).length?'<dl class="msp-facts">'+cur.facts.map(function(f){return '<div><dt>'+esc(f.k)+'</dt><dd>'+esc(f.v)+'</dd></div>';}).join('')+'</dl>':'';
  el.innerHTML='<div class="v15m-page msp">'+head+'<div class="v15m-card"><div class="msp-meta"><div><b>'+esc(cur.title)+'</b><span>'+esc(cur.eyebrow||'')+'</span></div>'+sel+'</div>'+facts
    +'<nav class="msp-tabs">'+tabs.map(function(t){return '<button type="button" class="'+(t[0]===tab?'on':'')+'" data-msp="'+esc(t[0])+'">'+esc(t[1])+'</button>';}).join('')+'</nav><div class="msp-body">'+bodyFor(cur,tab)+'</div></div></div>';
  [].forEach.call(el.querySelectorAll('[data-msp]'),function(b){b.onclick=function(){UI.tab=b.getAttribute('data-msp');render(el);};});
  var s=el.querySelector('#msp-plan');if(s)s.onchange=function(){UI.plan=s.value;UI.tab=null;render(el);};
}
window.MDV_MODEL_SHOOT={render:render,has:function(){return plans().length>0;}};
})();
