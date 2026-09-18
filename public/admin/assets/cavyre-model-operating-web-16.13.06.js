(function(){
'use strict';
var RELEASE='16.13.06', TTL=30000, cache=new Map(), inflight=new Map(), activeModel=null;
function org(){return (window.VEUX_AGENT_V4&&VEUX_AGENT_V4.orgSlug)||'maison-de-veux';}
function api(path,opts){if(window.VEUX_AGENT_V4&&typeof VEUX_AGENT_V4.api==='function')return VEUX_AGENT_V4.api(path,opts||{});return fetch(path,opts||{}).then(function(r){if(!r.ok)throw new Error('Request failed');return r.json();});}
function now(){return Date.now();}
function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));document.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(e){}}
function cacheKey(id){return org()+':'+id;}
async function get(modelId,force){
  modelId=String(modelId||'').trim();if(!modelId)return null;var key=cacheKey(modelId),c=cache.get(key);
  if(!force&&c&&now()-c.at<TTL)return c.data;
  if(inflight.has(key))return inflight.get(key);
  var p=api('/api/agent/model-graph/v1?organization='+encodeURIComponent(org())+'&model_id='+encodeURIComponent(modelId)).then(function(data){
    cache.set(key,{at:now(),data:data});inflight.delete(key);activeModel=modelId;window.__CAVYRE_ACTIVE_MODEL_GRAPH__=data;emit('cavyre:model-web-ready',data);return data;
  }).catch(function(err){inflight.delete(key);emit('cavyre:model-web-error',{model_id:modelId,error:err&&err.message||String(err)});throw err;});
  inflight.set(key,p);return p;
}
function invalidate(modelId,reason){
  if(modelId)cache.delete(cacheKey(String(modelId)));else cache.clear();
  emit('cavyre:model-web-invalidated',{model_id:modelId||null,reason:reason||'data-change'});
  if(modelId&&String(modelId)===String(activeModel))setTimeout(function(){get(modelId,true).catch(function(){});},80);
}
function detectModel(){
  var el=document.querySelector('[data-model-id].is-active,[data-model-id].active,[data-model-id][aria-selected="true"],.selected[data-model-id],.on[data-model-id]');
  if(el&&el.getAttribute('data-model-id'))return el.getAttribute('data-model-id');
  var p=new URLSearchParams(location.search),q=p.get('model_id')||p.get('model');if(q)return q;
  var h=String(location.hash||''),m=h.match(/model(?:=|\/)([0-9a-f-]{20,})/i);return m&&m[1]||null;
}
function scan(){var id=detectModel();if(id&&id!==activeModel)get(id,false).catch(function(){});}
function relationship(modelId){var c=cache.get(cacheKey(String(modelId||activeModel||'')));return c&&c.data||null;}
function status(modelId){var d=relationship(modelId);return d&&d.intelligence||null;}
window.CAVYRE_MODEL_WEB={release:RELEASE,get:get,refresh:function(id){return get(id||activeModel,true);},invalidate:invalidate,current:function(){return relationship(activeModel);},status:status,activeModel:function(){return activeModel;}};

// Any verified write anywhere in the Agent portal invalidates the shared model web so Season, Calendar,
// Booking, Travel, Visa, Tasks and model surfaces can immediately re-read one authoritative context.
function patchApi(){
  var V=window.VEUX_AGENT_V4;if(!V||typeof V.api!=='function'||V.api.__cavyreModelWebPatched)return false;
  var base=V.api.bind(V);function wrapped(path,opts){
    opts=opts||{};var method=String(opts.method||'GET').toUpperCase();return base(path,opts).then(function(data){
      if(method!=='GET'){
        var mid=null;try{var b=typeof opts.body==='string'?JSON.parse(opts.body):opts.body||{};mid=b.model_id||b.modelId||null;}catch(e){}
        invalidate(mid,'write:'+String(path||''));emit('cavyre:operating-data-changed',{path:path,method:method,model_id:mid,data:data});
      }
      return data;
    });
  }
  wrapped.__cavyreModelWebPatched=true;wrapped.__cavyreOriginal=base;V.api=wrapped;return true;
}
var patched=false;function boot(){if(!patched)patched=patchApi()||patched;scan();}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
window.addEventListener('hashchange',scan);window.addEventListener('popstate',scan);window.addEventListener('veux:page-rendered',scan);
document.addEventListener('click',function(e){var n=e.target&&e.target.closest&&e.target.closest('[data-model-id]');if(n)setTimeout(scan,0);},true);
setInterval(function(){if(!patched)patched=patchApi()||patched;},1000);
new MutationObserver(function(m){for(var i=0;i<m.length;i++){if(m[i].addedNodes&&m[i].addedNodes.length){setTimeout(scan,30);break;}}}).observe(document.documentElement,{subtree:true,childList:true});
})();
