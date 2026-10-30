/* Model form: connect the model to a Mother Agency profile instead of typing a name.
   The form keeps two hidden fields (name and agency id); saving links the model to the agency so it appears in that agency's portal. */
(function(){
'use strict';
if(window.__MDV_MALINK__)return;window.__MDV_MALINK__=true;

var CACHE={list:null,at:0,loading:null};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){return window.VEUX_AGENT_V4;}
function org(){var s=(bridge()&&bridge().state)||{};return (s.org&&s.org.slug)||'maison-de-veux';}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function initials(n){return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(x){return x[0]||'';}).join('').toUpperCase()||'?';}
function toast(m){try{if(window.toast)return window.toast(m);}catch(e){}}

function loadAgencies(force){
  if(!force&&CACHE.list&&Date.now()-CACHE.at<30000)return Promise.resolve(CACHE.list);
  if(CACHE.loading)return CACHE.loading;
  CACHE.loading=bridge().api('/api/agent/mother-agencies?organization='+encodeURIComponent(org()),{method:'GET',headers:{}}).then(function(r){CACHE.list=arr(r&&r.agencies);CACHE.at=Date.now();return CACHE.list;}).catch(function(){return CACHE.list||[];}).then(function(l){CACHE.loading=null;return l;});
  return CACHE.loading;
}
function portalState(a){
  var x=(a&&a.access)||{};
  if(x.locked)return ['bad','Portal locked'];
  if(x.portal_enabled===false)return ['off','Portal disabled'];
  if(!x.has_code)return ['warn','No portal access yet'];
  if(!x.last_login_at)return ['info','Portal ready, not signed in yet'];
  return ['ok','Portal active'];
}

function hydrate(host){
  if(host.getAttribute('data-ready'))return;host.setAttribute('data-ready','1');
  var box=host.querySelector('.mdv-ma-host'),nameIn=host.querySelector('#vx132_mother_agency'),idIn=host.querySelector('#vx132_mother_agency_id');
  if(!box||!nameIn||!idIn)return;
  var startName=host.getAttribute('data-ma-name')||'',startId=host.getAttribute('data-ma-id')||'';
  box.innerHTML='<div class="mal-loading">Loading mother agencies…</div>';
  loadAgencies(true).then(function(list){draw(list);});

  function draw(list){
    var cur=idIn.value||'',nm=nameIn.value||'';
    var picked=list.find(function(a){return String(a.id)===String(cur);})||(!cur&&nm?list.find(function(a){return norm(a.name)===norm(nm);}):null);
    if(picked){idIn.value=picked.id;nameIn.value=picked.name;}
    var textOnly=!picked&&nm;
    var opts='<option value="">Not connected to a mother agency</option><optgroup label="Mother agencies">'+list.map(function(a){return '<option value="'+esc(a.id)+'"'+(picked&&picked.id===a.id?' selected':'')+'>'+esc(a.name+(a.city||a.country?' · '+[a.city,a.country].filter(Boolean).join(', '):''))+'</option>';}).join('')+'</optgroup>'+(textOnly?'<option value="__text" selected>Not in the list: “'+esc(nm)+'” (text only)</option>':'')+'<option value="__new">+ Add a new mother agency…</option>';
    box.innerHTML='<div class="mal"><select class="mal-sel" aria-label="Mother agency">'+opts+'</select><div class="mal-body"></div></div>';
    var sel=box.querySelector('.mal-sel'),body=box.querySelector('.mal-body');
    function card(){
      var id=idIn.value,a=list.find(function(x){return String(x.id)===String(id);});
      if(!a){
        body.innerHTML=textOnly&&sel.value==='__text'?'<div class="mal-note warn">“'+esc(nm)+'” is only text, so it is not connected to any agency profile. Choose it from the list, or add it as a new mother agency, to connect this model to its portal.</div>':'<div class="mal-note">Choose the mother agency that represents this model. The model will appear in that agency’s portal, and you can open their profile from here.</div>';
        return;
      }
      var ps=portalState(a),same=!!startId&&String(startId)===String(a.id);
      body.innerHTML='<div class="mal-card"><div class="mal-logo">'+(a.logo_url?'<img src="'+esc(a.logo_url)+'" alt="">':'<span>'+esc(initials(a.name))+'</span>')+'</div><div class="mal-info"><b>'+esc(a.name)+'</b><p>'+esc([a.city,a.country].filter(Boolean).join(', ')||'Location not added')+' · '+a.models+' model'+(a.models===1?'':'s')+(a.profile?' · profile '+a.profile.score+'%':'')+'</p><div class="mal-tags"><span class="'+ps[0]+'">'+esc(ps[1])+'</span>'+(a.expired?'<span class="bad">'+a.expired+' document'+(a.expired===1?'':'s')+' expired</span>':'')+'</div></div><div class="mal-act"><button type="button" class="mal-btn" data-act="profile">Open profile</button>'+((a.access&&a.access.has_code)?'':'<button type="button" class="mal-btn gold" data-act="access">Set up portal access</button>')+'</div></div><div class="mal-note '+(same?'ok':'')+'">'+(same?'✓ Connected. This model appears in '+esc(a.name)+'’s Mother Agency portal.':'Saving will connect this model to '+esc(a.name)+'. It will then appear in their Mother Agency portal.')+'</div>';
      body.querySelectorAll('[data-act]').forEach(function(b){b.onclick=function(){if(window.MDV_MAG&&MDV_MAG.open)MDV_MAG.open(a.id);else toast('Open Mother Agencies from the menu to manage this agency.');};});
    }
    sel.onchange=function(){
      var v=sel.value;
      if(v==='__new'){
        var name=(prompt('Mother agency name')||'').trim();
        if(!name){sel.value=idIn.value||(textOnly?'__text':'');return;}
        bridge().api('/api/agent/mother-agencies',{method:'POST',body:JSON.stringify({organization_slug:org(),action:'create',name:name})}).then(function(r){return loadAgencies(true).then(function(l){list=l;idIn.value=r.partner_id;var a=l.find(function(x){return String(x.id)===String(r.partner_id);});nameIn.value=a?a.name:name;textOnly=false;draw(list);toast('Mother agency added');});}).catch(function(e){toast((e&&e.message)||'Could not add the agency');sel.value=idIn.value||'';});
        return;
      }
      if(v==='__text'){idIn.value='';nameIn.value=nm;card();return;}
      if(!v){idIn.value='';nameIn.value='';card();return;}
      var a=list.find(function(x){return String(x.id)===String(v);});idIn.value=v;nameIn.value=a?a.name:'';card();
    };
    card();
  }
}
function scan(){document.querySelectorAll('.mdv-ma-field:not([data-ready])').forEach(hydrate);}
new MutationObserver(function(){scan();}).observe(document.documentElement,{childList:true,subtree:true});
scan();
})();
