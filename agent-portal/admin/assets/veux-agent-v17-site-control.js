/* VEUX DESK 17.0 — Site Control: admin-only public-site diagnostics card on System Settings */
(function(){
'use strict';
if(window.__VEUX_SITE_CONTROL_170__)return;window.__VEUX_SITE_CONTROL_170__=true;
function bridge(){return window.VEUX_AGENT_V4;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function org(){var b=bridge();return (b&&b.state&&b.state.org&&b.state.org.slug)||'maison-de-veux';}
function openModel(id){window._veuxV10ModelId=id;if(window.VEUX_PERF&&VEUX_PERF.invalidate)VEUX_PERF.invalidate('modelpage');if(typeof window.navTo==='function')window.navTo('modelpage');}
window.VEUX_SITE_CONTROL={openModel:openModel};

function list(title,items,emptyMsg){
  if(!items||!items.length)return '<div class="vx170-sc-row"><b>'+esc(title)+'</b><span class="vx170-sc-ok">'+esc(emptyMsg||'None')+'</span></div>';
  return '<div class="vx170-sc-row"><b>'+esc(title)+'</b><div class="vx170-sc-chips">'+items.slice(0,12).map(function(m){
    return '<button type="button" class="vx170-sc-chip" onclick="VEUX_SITE_CONTROL.openModel(\''+esc(m.id)+'\')">'+esc(m.display_name||'Model')+'</button>';
  }).join('')+(items.length>12?'<span class="vx170-sc-more">+'+(items.length-12)+' more</span>':'')+'</div></div>';
}

function cardHtml(d){
  var c=d.counts||{};
  return '<div class="v152-card" id="vx170-site-control"><header><b>Site Control · maisondeveux.com</b><span style="font:9px var(--fM,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)">Demontez &amp; Admin only</span></header>'
  +'<div class="vx170-sc-stats"><div><b>'+Number(c.published||0)+'</b><span>Published</span></div><div><b>'+Number(c.draft||0)+'</b><span>Draft</span></div><div><b>'+Number(c.no_profile||0)+'</b><span>No Profile</span></div><div><b>'+Number(c.no_media||0)+'</b><span>No Photos</span></div><div><b>'+Number(c.no_public_headshot||0)+'</b><span>No Public Headshot</span></div></div>'
  +list('Published with no public Headshot — their site photo is broken right now',d.published_missing_headshot,'All published profiles have a public Headshot')
  +list('No photos uploaded at all — cannot appear correctly on the site',d.no_media,'Every model has at least one photo')
  +list('Website profile never created',d.no_profile,'Every model has a website profile record')
  +'</div>';
}

async function inject(){
  var host=document.querySelector('#p-systemsettings .v152-page, #p-systemsettings');
  if(!host||host.querySelector('#vx170-site-control'))return;
  var b=bridge();if(!b||!b.api)return;
  try{
    var d=await b.api('/api/agent/site-control?organization='+encodeURIComponent(org()),{method:'GET',headers:{}});
    if(!d||d.ok!==true)return; // not permitted or unavailable — render nothing, no error shown
    var wrap=document.createElement('div');wrap.innerHTML=cardHtml(d);
    var target=host.classList.contains('v152-page')?host:host.querySelector('.v152-page')||host;
    target.appendChild(wrap.firstElementChild);
  }catch(_e){/* silent: most users simply lack the permission */}
}

function injectStyle(){
  if(document.getElementById('vx170-sc-style'))return;
  var s=document.createElement('style');s.id='vx170-sc-style';
  s.textContent='#vx170-site-control{margin-top:16px}.vx170-sc-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:12px 0}.vx170-sc-stats>div{border:1px solid var(--line);background:var(--ivory);padding:9px 10px;text-align:center}.vx170-sc-stats b{display:block;font:500 18px/1.2 var(--fD,serif);color:var(--ink)}.vx170-sc-stats span{display:block;margin-top:3px;font:8px/1.3 var(--fM,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}.vx170-sc-row{padding:10px 0;border-top:1px solid var(--line)}.vx170-sc-row b{display:block;font-size:12px;color:var(--ink2);margin-bottom:6px}.vx170-sc-ok{font-size:11px;color:var(--mute)}.vx170-sc-chips{display:flex;flex-wrap:wrap;gap:6px}.vx170-sc-chip{border:1px solid var(--line);background:var(--paper,transparent);padding:5px 9px;font-size:11px;color:var(--ink2);cursor:pointer;border-radius:6px}.vx170-sc-chip:hover{border-color:var(--gold);color:var(--gold)}.vx170-sc-more{align-self:center;font-size:10px;color:var(--mute)}';
  document.head.appendChild(s);
}

var orig=null;
function hook(){
  if(typeof window.renderSystemSettings!=='function'||window.renderSystemSettings.__vx170)return;
  orig=window.renderSystemSettings;
  var wrapped=async function(el){
    var r=await orig(el);
    injectStyle();
    setTimeout(inject,30);
    return r;
  };
  wrapped.__vx170=true;
  window.renderSystemSettings=wrapped;
}
hook();
document.addEventListener('veux:shell-ready',hook);
setTimeout(hook,1500);setTimeout(hook,4000);
})();
