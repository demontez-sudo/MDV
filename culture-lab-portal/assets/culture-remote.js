/* Connects the portal to its API. With no configuration the portal runs as a local demo. */
(function(){
'use strict';
var C=window.CL_CONFIG||{};
if(!C.url){window.CL=CLStore({mode:'local'});window.CL.isRemote=false;return;}
var API=C.url.replace(/\/$/,'')+'/functions/v1/culture-lab-api',token=null,pending=0,chain=Promise.resolve(),CL,sbClient=null;
function fail(msg,code){var e=new Error(msg);e.friendly=true;e.code=code;return e;}
async function call(body){var r;try{r=await fetch(API,{method:'POST',headers:{'content-type':'application/json',apikey:C.anonKey,Authorization:'Bearer '+(token||C.anonKey)},body:JSON.stringify(body)});}catch(x){throw fail('We could not reach the server. Please check your connection.','offline');}var d=await r.json().catch(function(){return {};});if(!r.ok)throw fail(d.error||'Something went wrong. Please try again.',d.code);return d;}
function apply(snap){CL.state=snap;}
async function resync(){var d=await call({action:'session'});CL.state=d.snapshot;if(CL.onRemote)CL.onRemote();}
function ss(st,m){try{if(CL.onSaveState)CL.onSaveState(st,m);}catch(x){}}
function send(cmd,args,ids){pending++;ss('saving');chain=chain.then(function(){return call({action:'cmd',cmd:cmd,args:args,ids:ids});}).then(function(d){pending--;if(!pending){apply(d.snapshot);ss('saved');if(CL.onSynced)CL.onSynced();}}).catch(function(e){pending--;ss('error',e.message);if(CL.onRemoteError)CL.onRemoteError(e.message);if(!pending)return resync().catch(function(){});});}
var blob={put:async function(file,scope){var fc=CL.fileCheck(file.name,file.size);if(!fc.ok)throw fail(fc.error);var d=await call({action:'upload',scope:'staff',name:file.name,size:file.size});var r=await fetch(d.url,{method:'PUT',headers:{'content-type':d.mime||fc.mime,'x-upsert':'false'},body:file});if(!r.ok)throw fail('That file could not be uploaded.');return d.key;},url:async function(key){if(!key||key.indexOf('sb:')!==0)return key||'';try{return (await call({action:'fileUrl',key:key})).url;}catch(e){return '';}}};
root();
function root(){window.CL_DEFER=true;CL=CLStore({mode:'remote',state:CLStore({mode:'server',state:{users:[]}}).blankState(),send:send,blob:blob});CL.isRemote=true;window.CL=CL;}
CL.remote={call:call,resync:resync,setToken:function(t){token=t;},isBusy:function(){return pending>0;},client:function(){if(!sbClient&&window.supabase)sbClient=window.supabase.createClient(C.url,C.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'culture-lab-auth'}});return sbClient;}};
CL.ready=Promise.resolve();
})();
