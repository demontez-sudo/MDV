(function(){
'use strict';
if(window.__VEUX_16957_DIRECTORY_LOADER__)return;window.__VEUX_16957_DIRECTORY_LOADER__=true;
var VERSION='16.9.57',pending=null,baseRender=window.renderIndustryDirectory;
function mount(){return window.__VEUX_AGENT_MOUNT__||'';}
function src(){return mount()+'/modules/veux-agent-client-directory-2-16.9.57.js?v='+encodeURIComponent(window.__VEUX_RELEASE__||VERSION);}
function load(){
 if(window.VEUX_DIR2&&window.VEUX_DIR2.render)return Promise.resolve(window.VEUX_DIR2);
 if(pending)return pending;
 pending=new Promise(function(resolve,reject){
   var s=document.createElement('script');s.src=src();s.async=false;
   s.onload=function(){if(window.VEUX_DIR2&&window.VEUX_DIR2.render)resolve(window.VEUX_DIR2);else reject(new Error('Client Directory 2.0 loaded without a renderer.'));};
   s.onerror=function(){pending=null;reject(new Error('Client Directory 2.0 module could not load.'));};
   document.head.appendChild(s);
 });
 return pending;
}
function loading(el){if(el)el.innerHTML='<div style="padding:34px 28px;color:var(--mute);font:9px var(--fM);letter-spacing:.12em">VEUX DESK · Loading Client Intelligence…</div>';}
window.renderIndustryDirectory=function(el){
 if(window.VEUX_DIR2&&window.VEUX_DIR2.render)return window.VEUX_DIR2.render(el);
 loading(el);
 return load().then(function(m){return m.render(el);}).catch(function(e){console.error('[VEUX 16.9.57] directory module',e);if(baseRender)return baseRender(el);if(el)el.innerHTML='<div class="empty">Client Directory could not load.</div>';});
};
window.VEUX_DIR2_LOADER={version:VERSION,load:load};
window.dispatchEvent(new CustomEvent('veux:v16.9.57-directory-loader-ready',{detail:{version:VERSION}}));
})();
