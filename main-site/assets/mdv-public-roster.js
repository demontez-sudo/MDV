(function(){
  'use strict';

  // Public website feed only. Supabase publishable keys are safe for browser use;
  // database function permissions restrict this client to explicitly published roster payloads.
  var SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function loadFallbacks(){
    return new Promise(function(resolve){
      if(window.MDV_ROSTER_FALLBACKS) return resolve();
      var s=document.createElement('script');
      s.src='/assets/mdv-roster-fallbacks.js';
      s.onload=function(){resolve();};
      s.onerror=function(){resolve();};
      document.head.appendChild(s);
    });
  }
  function profilePathFor(name){
    try{
      if(typeof SEARCH_INDEX!=='undefined' && Array.isArray(SEARCH_INDEX)){
        var hit=SEARCH_INDEX.find(function(x){return x&&x.name===name&&/\/[^/]+$/.test(String(x.url||''));});
        if(hit){var u=new URL(hit.url,location.origin);return u.pathname;}
      }
    }catch(e){}
    return '#';
  }
  function tile(row,pageKey){
    var fb=((window.MDV_ROSTER_FALLBACKS||{})[pageKey]||{})[row.display_name]||'';
    var img=row.image_url||fb;
    var visual=img?'<img src="'+esc(img)+'" alt="'+esc(row.display_name)+'" loading="lazy" decoding="async">':'<span class="placeholder-label">Image Pending</span>';
    return '<a class="roster-tile" href="'+esc(row.profile_path||profilePathFor(row.display_name)||'#')+'">'
      +'<div class="roster-image">'+visual+'</div>'
      +'<div class="roster-name">'+esc(row.display_name)+'</div></a>';
  }
  function staticRows(pageKey){
    var map=(window.MDV_ROSTER_FALLBACKS||{})[pageKey]||{};
    return Object.keys(map).map(function(name){return {display_name:name,image_url:map[name],profile_path:profilePathFor(name)};});
  }
  function emptyMessage(view){
    return String(view||'').toLowerCase()==='creator'?'No creators are currently published on this board.':'No models currently published on this board.';
  }
  function renderRows(root,rows,pageKey,view,mode){
    if(!rows.length){
      root.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:48px 20px;font-family:\'Jost\',sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-dim)">'+esc(emptyMessage(view))+'</div>';
    }else{
      root.innerHTML=rows.map(function(x){return tile(x,pageKey);}).join('');
    }
    root.setAttribute('data-mdv-roster-source',mode);
  }
  async function fetchRoster(market,view){
    var r=await fetch(SUPABASE_URL+'/rest/v1/rpc/website_public_roster',{
      method:'POST',
      headers:{'apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({target_market:market,target_view:view}),
      credentials:'omit',
      cache:'no-store'
    });
    if(!r.ok) throw new Error('Roster API '+r.status);
    var body=await r.json();
    if(body && body.error) throw new Error(body.error);
    return body||{};
  }
  function retryLiveRoster(root,market,view,pageKey,remaining){
    if(!remaining)return;
    setTimeout(async function(){
      try{
        var body=await fetchRoster(market,view);
        var rows=Array.isArray(body.models)?body.models:[];
        renderRows(root,rows,pageKey,view,'live-recovered');
      }catch(e){retryLiveRoster(root,market,view,pageKey,remaining-1);}
    },2500);
  }
  async function run(){
    var root=document.getElementById('mdv-public-roster');
    if(!root) return;
    var market=root.dataset.market||'',view=root.dataset.view||'',pageKey=root.dataset.pageKey||'';
    await loadFallbacks();
    try{
      var body=await fetchRoster(market,view);
      var rows=Array.isArray(body.models)?body.models:[];
      renderRows(root,rows,pageKey,view,'live');
    }catch(e){
      console.error('MDV public roster',e);
      var fallback=staticRows(pageKey);
      if(fallback.length) renderRows(root,fallback,pageKey,view,'static-fallback');
      else {
        root.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:48px 20px;font-family:\'Jost\',sans-serif;font-size:11px;letter-spacing:.12em;color:var(--ink-dim)">Roster temporarily unavailable.</div>';
        root.setAttribute('data-mdv-roster-source','unavailable');
      }
      retryLiveRoster(root,market,view,pageKey,2);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
