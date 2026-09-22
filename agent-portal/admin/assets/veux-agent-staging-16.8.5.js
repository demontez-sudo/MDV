/* VEUX DESK 16.8.5 — Agency performance bootstrap. Parallel boot, in-memory GET cache, no browser DB writes. */
(function(){
'use strict';
if(window.__VEUX_AGENT_BOOT_16__)return;window.__VEUX_AGENT_BOOT_16__=true;
var state={client:null,session:null,bootstrap:null,org:null,permissions:new Set(),models:[],team:[],publicConfig:null,responseCache:new Map(),inflight:new Map()};
var nativeFetch=window.fetch.bind(window),orgSlug='maison-de-veux',passwordSetupMode=false,initialAuthUrl=window.location.href,portalMount=window.__VEUX_AGENT_MOUNT__||'';
var initStarted=false;
function portalPath(path){if(typeof path!=='string'||path.indexOf('http')===0)return path;if(/^\/(?:api(?:\/|$)|health(?:\?|$)|ask-claude(?:\?|$))/i.test(path))return path;if(!portalMount)return path;return path.charAt(0)==='/'?portalMount+path:portalMount+'/'+path;}
var PROD_SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
var PROD_SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
function requireClient(){if(!state.client||!state.client.auth)throw new Error('VEUX secure connection is still loading. Refresh the page and try again.');return state.client;}
async function loadPublicConfig(){try{var r=await nativeFetch(portalPath('/api/config'),{cache:'no-store'}),body=await r.json().catch(function(){return null;});if(r.ok&&body&&body.supabase_url===PROD_SUPABASE_URL&&body.supabase_publishable_key===PROD_SUPABASE_PUBLISHABLE_KEY)return body;}catch(_e){}return {supabase_url:PROD_SUPABASE_URL,supabase_publishable_key:PROD_SUPABASE_PUBLISHABLE_KEY,environment:'production-fallback'};}
window.TEAM=window.TEAM||{};window.MODELS=window.MODELS||{};window.whoKey=window.whoKey||null;
function token(){return state.session&&state.session.access_token||'';}
window.fetch=function(input,init){if(typeof input==='string'&&portalMount&&/^\/(?:api\/|ask-claude(?:$|\?))/i.test(input))input=portalPath(input);return nativeFetch(input,init);};
function cacheTtl(path){
  path=String(path||'');
  if(/\/api\/agent\/bootstrap/.test(path))return 180000;
  if(/communications|messages|notifications/.test(path))return 12000;
  if(/calendar|tasks|availability/.test(path))return 30000;
  if(/bookings|mobility|finance|legal/.test(path))return 45000;
  if(/crm|roster|team|settings|development|season|scouting|packages/.test(path))return 60000;
  return 30000;
}
function clearApiCache(){try{state.responseCache.clear();state.inflight.clear();}catch(_e){}}
function invalidateApiCache(scope){try{var parts=Array.isArray(scope)?scope:[scope],tests=parts.filter(Boolean).map(function(x){return x instanceof RegExp?x:String(x);});if(!tests.length)return clearApiCache();[state.responseCache,state.inflight].forEach(function(map){Array.from(map.keys()).forEach(function(key){if(tests.some(function(t){return t instanceof RegExp?t.test(key):String(key).indexOf(t)>-1;}))map.delete(key);});});}catch(_e){clearApiCache();}}
function invalidateForWrite(path){path=String(path||'');if(/\/api\/agent\/packages/.test(path))return invalidateApiCache(['agent/packages']);if(/\/api\/agent\/crm/.test(path))return invalidateApiCache(['agent/crm','builder=1']);if(/roster|model-media|model-file|portfolio|model\//.test(path))return invalidateApiCache(['agent/roster','agent/models','builder=1']);if(/calendar|events|bookings/.test(path))return invalidateApiCache(['agent/calendar','agent/events','agent/bookings']);if(/mobility|visa|travel/.test(path))return invalidateApiCache(['agent/mobility','agent/visa','agent/travel']);return clearApiCache();}
async function api(path,options){
  options=options||{};
  var method=String(options.method||'GET').toUpperCase(),fresh=!!options.__fresh,key=method+' '+String(path||''),now=Date.now();
  if(method==='GET'&&!fresh){
    var cached=state.responseCache.get(key);
    if(cached&&cached.expires>now)return cached.data;
    var pending=state.inflight.get(key);if(pending)return pending;
  }
  var requestOptions=Object.assign({},options);delete requestOptions.__fresh;
  var headers=Object.assign({'Content-Type':'application/json'},requestOptions.headers||{});if(token())headers.Authorization='Bearer '+token();
  var work=(async function(){
    var r=await nativeFetch(portalPath(path),Object.assign({},requestOptions,{headers:headers}));
    var body=await r.json().catch(function(){return{};});
    if(!r.ok){var e=new Error(body.error||('VEUX API '+r.status));e.status=r.status;e.data=body;throw e;}
    if(method==='GET')state.responseCache.set(key,{data:body,expires:Date.now()+cacheTtl(path)});
    else invalidateForWrite(path);
    return body;
  })();
  if(method==='GET')state.inflight.set(key,work);
  try{return await work;}finally{if(method==='GET')state.inflight.delete(key);}
}
async function uploadModelMedia(file,modelId,options){
  options=options||{};
  if(!file)throw new Error('Choose a file first.');
  if(!modelId)throw new Error('Open a model before uploading media.');
  var mime=String(file.type||options.mime_type||'application/octet-stream');
  if(!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/i.test(mime))throw new Error('Use JPG, PNG, WEBP, GIF, MP4, MOV or WEBM media.');
  var max=50*1024*1024;if(Number(file.size||0)>max)throw new Error('Model media must be 50 MB or smaller.');
  var signPayload={organization_slug:(state.org&&state.org.slug)||orgSlug,model_id:modelId,name:file.name||'model-media',mime_type:mime,size_bytes:file.size||0,category:options.category||null};
  var sign;
  try{
    sign=await api('/api/agent/model-media/upload-url',{method:'POST',body:JSON.stringify(signPayload)});
  }catch(primaryError){
    if(Number(primaryError&&primaryError.status)!==404)throw primaryError;
    var directBase=/maison-agent\.netlify\.app$/i.test(String(location.hostname||''))?'':'https://maison-agent.netlify.app';
    var directUrl=directBase+'/.netlify/functions/agent-model-media-upload-url';
    var directHeaders={'Content-Type':'application/json'};if(token())directHeaders.Authorization='Bearer '+token();
    var directResponse=await nativeFetch(directUrl,{method:'POST',headers:directHeaders,body:JSON.stringify(signPayload),cache:'no-store'});
    var directBody=await directResponse.json().catch(function(){return{};});
    if(!directResponse.ok){var directError=new Error(directBody.error||('VEUX media upload API '+directResponse.status));directError.status=directResponse.status;directError.data=directBody;throw directError;}
    sign=directBody;
  }
  if(!sign||!sign.bucket||!sign.path||!sign.token||!sign.public_url)throw new Error('Secure model-media upload session was not returned. Refresh and try again.');
  var client=requireClient();
  var result=await client.storage.from(sign.bucket).uploadToSignedUrl(sign.path,sign.token,file,{contentType:mime});
  if(result&&result.error)throw new Error('Model media upload failed: '+(result.error.message||'Storage rejected the file.'));
  return {url:sign.public_url,public_id:sign.path,provider:'supabase',media_type:sign.media_type||(/^video\//i.test(mime)?'video':'image'),bucket:sign.bucket,path:sign.path};
}
function qs(id){return document.getElementById(id);}function slug(v){return String(v||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function initials(v){return String(v||'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase()||'A';}
function loginError(msg){var e=qs('veuxLoginErr');if(e){e.textContent=msg||'';e.style.display=msg?'block':'none';}}
function loginBusy(on,label){var b=qs('veuxLoginBtn');if(b){b.disabled=!!on;b.textContent=on?(label||'Signing in…'):'Sign In to Portal →';}}
function rewriteLogin(){
  var login=qs('login');if(!login)return;
  var card=login.querySelector('.lg-card');if(!card)return;
  var top=card.querySelector('.lg-top');
  if(top)top.innerHTML='<div class="lg-logo">C</div><div class="lg-eyebrow">Welcome Back</div><div class="lg-h1">Sign in to your account</div><div class="lg-sub">Secure access to the CAVYRE Agent Portal.</div>';
  var form=card.querySelector('.lg-body');
  if(form){
    form.setAttribute('onsubmit','return false;');
    form.innerHTML='<label class="lg-lbl" for="veuxEmail">Email</label><div class="lg-field email"><input class="lg-inp" id="veuxEmail" type="email" autocomplete="username" placeholder="you@maisondeveux.com"></div><label class="lg-lbl" for="veuxPassword">Password</label><div class="lg-field password"><input class="lg-inp" id="veuxPassword" type="password" autocomplete="current-password" placeholder="Enter your password"></div><div class="lg-options"><label class="lg-remember"><input id="veuxRemember" type="checkbox" checked> Remember me</label><button type="button" id="veuxForgotBtn">Forgot password?</button></div><div class="lg-err" id="veuxLoginErr" style="display:none"></div><button class="lg-btn" id="veuxLoginBtn" type="button">Sign In to Portal →</button>';
    qs('veuxLoginBtn').onclick=signIn;qs('veuxForgotBtn').onclick=forgotPassword;qs('veuxPassword').addEventListener('keydown',function(e){if(e.key==='Enter')signIn();});
  }
  var foot=card.querySelector('.lg-foot');if(foot)foot.textContent='© 2026 CAVYRE Network Premium';
  var reset=qs('pwreset');if(reset)reset.style.display='none';
}
function urlWantsPasswordSetup(){try{var raw=String(initialAuthUrl||location.href||'');return /(?:[?&#])type=(invite|recovery|signup)(?:&|$)/i.test(raw)||/(?:[?&])password_setup=(invite|recovery|signup|magic)(?:&|$)/i.test(raw)||/(?:[?&])code=[^&#]+/i.test(raw)||/(?:[#&])access_token=[^&]+/i.test(raw)||/password[_-]?recovery/i.test(raw);}catch(_e){return false;}}
function setupError(msg){var e=qs('veuxPasswordSetupErr');if(e){e.textContent=msg||'';e.style.display=msg?'block':'none';}}
function renderPasswordSetup(){passwordSetupMode=true;var app=qs('app'),login=qs('login');if(app)app.style.display='none';if(login)login.style.display='';var card=login&&login.querySelector('.lg-card');if(!card)return;var top=card.querySelector('.lg-top');if(top)top.innerHTML='<div class="lg-eyebrow">VEUX DESK · Secure Account Setup</div><div class="lg-h1">Create <em>Password</em></div><div class="lg-sub">Finish your Agency access</div>';var form=card.querySelector('.lg-body');if(form){form.innerHTML='<label class="lg-lbl">New password</label><div class="lg-field"><input class="lg-inp" id="veuxNewPassword" type="password" autocomplete="new-password"></div><label class="lg-lbl">Confirm password</label><div class="lg-field"><input class="lg-inp" id="veuxConfirmPassword" type="password" autocomplete="new-password"></div><div class="lg-err" id="veuxPasswordSetupErr" style="display:none"></div><button class="lg-btn" id="veuxSetPasswordBtn" type="button">Create Password →</button>';qs('veuxSetPasswordBtn').onclick=completePasswordSetup;qs('veuxConfirmPassword').addEventListener('keydown',function(e){if(e.key==='Enter')completePasswordSetup();});}}
async function completePasswordSetup(){setupError('');var b=qs('veuxSetPasswordBtn');if(b){b.disabled=true;b.textContent='Saving & verifying…';}try{var a=(qs('veuxNewPassword')||{}).value||'',c=(qs('veuxConfirmPassword')||{}).value||'';if(a.length<10)throw new Error('Use at least 10 characters.');if(a!==c)throw new Error('Passwords do not match.');if(new TextEncoder().encode(a).length>72)throw new Error('Password is too long. Use 72 bytes or fewer.');var client=requireClient();var sr=await client.auth.getSession();if(sr.error)throw sr.error;var recoverySession=sr.data&&sr.data.session;if(!recoverySession||!recoverySession.access_token||!recoverySession.user||!recoverySession.user.email)throw new Error('Your recovery session expired. Request one new password link.');state.session=recoverySession;var saved=await client.auth.updateUser({password:a});if(saved.error)throw saved.error;if(!saved.data||!saved.data.user||saved.data.user.id!==recoverySession.user.id)throw new Error('Supabase did not confirm the password save.');var email=recoverySession.user.email;var so=await client.auth.signOut({scope:'local'});if(so&&so.error)throw so.error;state.session=null;var verify=await client.auth.signInWithPassword({email:email,password:a});if(verify.error)throw new Error('Password save could not be verified. Do not request another reset yet; contact VEUX support.');if(!verify.data||!verify.data.session)throw new Error('Password verification did not create a session.');state.session=verify.data.session;passwordSetupMode=false;initialAuthUrl=location.origin+location.pathname;try{history.replaceState({},document.title,location.pathname);}catch(_e){}await ensureMfa();await openSession(true);}catch(e){setupError(e.message||'Could not create password.');if(b){b.disabled=false;b.textContent='Create Password →';}}}
async function forgotPassword(){try{if(state.publicConfig&&state.publicConfig.email_delivery_configured===false)throw new Error('Password recovery email is temporarily offline. Resend is not configured for this deployment.');var email=((qs('veuxEmail')||{}).value||'').trim().toLowerCase();if(!email)throw new Error('Enter your email first.');await api('/api/auth/password/recovery',{method:'POST',body:JSON.stringify({email:email})});loginError('If this email has VEUX access, a secure Maison de Veux link is on the way.');}catch(e){loginError(e.message||'Could not send access link.');}}
async function signIn(){loginError('');loginBusy(true);try{var email=((qs('veuxEmail')||{}).value||'').trim().toLowerCase(),password=(qs('veuxPassword')||{}).value||'';if(!email||!password)throw new Error('Enter your email and password.');var client=requireClient(),r=await client.auth.signInWithPassword({email:email,password:password});if(r.error)throw r.error;state.session=r.data.session;await ensureMfa();await openSession(true);}catch(e){loginError(e.message||'Sign in failed.');loginBusy(false);}}
async function ensureMfa(){var client=requireClient();var a=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(a.error)throw a.error;if(a.data&&a.data.nextLevel==='aal2'&&a.data.currentLevel!=='aal2'){var f=await client.auth.mfa.listFactors();if(f.error)throw f.error;var factor=(f.data&&f.data.totp||[]).find(function(x){return x.status==='verified';});if(!factor)throw new Error('MFA is required but no verified authenticator is available.');var code=prompt('VEUX Security · Enter your 6-digit authenticator code');if(!code)throw new Error('MFA verification cancelled.');var ch=await client.auth.mfa.challenge({factorId:factor.id});if(ch.error)throw ch.error;var vr=await client.auth.mfa.verify({factorId:factor.id,challengeId:ch.data.id,code:String(code).trim()});if(vr.error)throw vr.error;state.session=(await client.auth.getSession()).data.session;}}
function hydrateTeam(boot){var out={};(boot.team||[]).forEach(function(x){var p=x.profile||{},name=p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||x.job_title||'Agency Team',key=slug(name)||x.member_id;out[key]={name:name,role:x.job_title||((x.roles||[])[0]&&x.roles[0].name)||'Agency Team',init:initials(name),email:'',_veuxMemberId:x.member_id,isOwner:(x.roles||[]).some(function(r){return /owner|founder|admin/i.test(String(r.key||r.name||''));})};if(x.member_id===(boot.current_user&&boot.current_user.membership&&boot.current_user.membership.id))window.whoKey=key;});window.TEAM=out;state.team=boot.team||[];if(!window.whoKey){var n=boot.current_user&&boot.current_user.profile&&boot.current_user.profile.display_name||boot.current_user&&boot.current_user.email||'agent';window.whoKey=slug(n)||'agent';if(!window.TEAM[window.whoKey])window.TEAM[window.whoKey]={name:n,role:'Agency Team',init:initials(n),isOwner:(boot.current_user&&boot.current_user.permissions||[]).includes('*')};}}
function hydrateModels(roster){var rows=(roster&&roster.roster)||roster&&roster.models||[],out={};if(!Array.isArray(rows))rows=[];rows.forEach(function(x){var key=x.legacy_key||x.public_slug||slug(x.display_name)||String(x.id),markets=x.markets||x.market_assignments||[],divs=x.divisions||x.division_assignments||[],media=x.media||[],primary=media.find(function(z){return z.is_primary;})||x.primary_media||media[0]||{};var marketNames=[...new Set(markets.map(function(y){return y.name||(y.markets&&y.markets.name);}).filter(Boolean))],divisionNames=[...new Set(divs.map(function(y){return (y.divisions&&y.divisions.name)||y.division||'';}).filter(Boolean))],boardNames=[...new Set(divs.map(function(y){return y.board||y.name||(y.boards&&y.boards.name)||'';}).filter(Boolean))],displayMeta=x.metadata&&x.metadata.roster_display||{};out[key]={name:x.display_name||key,stage:x.stage||'',gender:x.gender||'',status:x.status||'active',location:x.location||'',market:x.primary_market_label||marketNames.join(', '),markets:marketNames,department:divisionNames[0]||'',board:displayMeta.board_label||boardNames.join(', '),motherAgency:displayMeta.mother_agency||(x.metadata&&x.metadata.new_model_file&&x.metadata.new_model_file.mother_agency)||'',_veuxId:x.id,id:x.id,_media:media,_primaryMedia:primary.url||'',legacy_key:x.legacy_key||key,updated_at:x.updated_at||null};});window.MODELS=out;state.models=rows;window.modelHeadshot=function(k){var x=window.MODELS&&window.MODELS[k];return x&&x._primaryMedia||'';};}
function waitForShellReady(){
  if(!window.__VEUX_AUTH_LOADER_ACTIVE__)return Promise.resolve();
  function checkFailures(){
    var failed=Array.isArray(window.__VEUX_SHELL_FAILURES__)?window.__VEUX_SHELL_FAILURES__:[];
    if(failed.length)throw new Error('The secure login is connected, but the Agency interface did not finish loading. Refresh the page to retry.');
  }
  if(window.__VEUX_SHELL_READY__){try{checkFailures();return Promise.resolve();}catch(e){return Promise.reject(e);}}
  return new Promise(function(resolve,reject){
    var timer=setTimeout(function(){reject(new Error('The secure login is connected, but the Agency interface is still loading. Refresh the page to retry.'));},15000);
    window.addEventListener('veux:shell-ready',function(){clearTimeout(timer);try{checkFailures();resolve();}catch(e){reject(e);}},{once:true});
  });
}
function installAssistant(){
  if(window.initAssistantWidget)return;
  var open=false,history=[],healthChecked=false;
  function append(role,text,meta){
    var box=qs('_asst-msgs');if(!box)return;
    var d=document.createElement('div');
    d.style.cssText='padding:10px 12px;border:1px solid var(--line);background:'+(role==='user'?'var(--goldp)':'var(--ivory)')+';font-size:12px;line-height:1.5;color:var(--ink2)';
    var label=role==='user'?'You':'Vera';if(meta&&meta.provider)label+=' · '+String(meta.provider).toUpperCase();
    d.innerHTML='<div style="font:8px var(--fM);letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:5px">'+esc(label)+'</div>'+esc(text);
    box.appendChild(d);box.scrollTop=box.scrollHeight;
  }
  function setStatus(text,state){var x=qs('_asst-status');if(!x)return;x.textContent=text||'';x.style.color=state==='warn'?'var(--gold)':(state?'#8fa678':'var(--burg)');}
  async function checkHealth(){
    if(!state.session)return false;
    try{
      var h=await api('/api/agent/assistant?organization='+encodeURIComponent(orgSlug),{method:'GET',headers:{},__fresh:true});
      if(h&&h.desk_connected&&!h.ok){setStatus('Live Desk · AI provider offline','warn');healthChecked=true;return true;}var selected=h&&h.selected?String(h.selected):'AI';setStatus('Connected · '+selected.toUpperCase(),true);healthChecked=true;return true;
    }catch(e){setStatus(e.message||'AI provider unavailable',false);healthChecked=true;return false;}
  }
  window.initAssistantWidget=function(){
    if(qs('_asst-btn'))return;
    var b=document.createElement('button');b.id='_asst-btn';var veraMount=window.__VEUX_AGENT_MOUNT__;if(veraMount==null)veraMount=/^\/(?:admin|team)(?:\/|$)/.test(location.pathname)?'/admin':'';b.innerHTML='<img class="vera-avatar-img" src="'+veraMount+'/assets/vera/vera-avatar-circle.svg?v=16.10.09" alt="" aria-hidden="true">';b.title='Vera';b.setAttribute('aria-label','Open Vera');b.classList.add('vera-launcher');
    b.style.cssText='position:fixed;right:22px;bottom:22px;width:54px;height:54px;padding:0;border-radius:50%;z-index:400;background:#09080d;border:1px solid #C9A24B;color:var(--void);font-size:20px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.35)'
    b.onclick=function(){open=!open;var p=qs('_asst-panel');if(p)p.style.display=open?'flex':'none';if(open&&!healthChecked)checkHealth();};document.body.appendChild(b);
    var p=document.createElement('div');p.id='_asst-panel';p.style.cssText='position:fixed;right:22px;bottom:86px;width:390px;max-width:92vw;height:520px;max-height:72vh;z-index:400;background:var(--paper);border:1px solid var(--line2);display:none;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.45)';
    p.innerHTML='<div style="padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px"><div><div style="font:8px var(--fM);letter-spacing:.15em;color:var(--gold)">VEUX AGENT · INTELLIGENCE</div><div style="font:22px var(--fD);color:var(--ink)">Vera</div><div id="_asst-status" style="font:8px var(--fM);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-top:4px">Checking provider…</div></div><button id="_asst-close">×</button></div><div id="_asst-msgs" style="flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px"></div><div style="padding:12px;border-top:1px solid var(--line);display:flex;gap:8px"><input id="_asst-input" style="flex:1;background:var(--void);border:1px solid var(--line);color:var(--ink);padding:10px" placeholder="Ask Vera about roster, bookings, tasks…"><button id="_asst-send" class="btn pri">Send</button></div>';
    document.body.appendChild(p);
    qs('_asst-close').onclick=function(){open=false;p.style.display='none';};
    async function send(){
      var i=qs('_asst-input'),sendBtn=qs('_asst-send'),msg=(i.value||'').trim();if(!msg)return;
      i.value='';append('user',msg);history.push({role:'user',content:msg});if(sendBtn){sendBtn.disabled=true;sendBtn.textContent='Thinking…';}
      try{
        var r=await api('/api/agent/assistant',{method:'POST',body:JSON.stringify({organization_slug:orgSlug,message:msg,history:history.slice(-12),context:Object.assign({page:window._currentPage||'overview',model_id:window._veuxV10ModelId||null},window.CAVYRE_VERA_SMART&&typeof window.CAVYRE_VERA_SMART.contextPayload==='function'?window.CAVYRE_VERA_SMART.contextPayload():{})})});
        append('assistant',r.reply||'No response generated.',{provider:r.provider});history.push({role:'assistant',content:r.reply||''});if(r.proposedAction){try{window.dispatchEvent(new CustomEvent('vera:proposed-action',{detail:r.proposedAction}));}catch(_veraEvt){}}if(r.degraded){var dg=Array.isArray(r.diagnostics)&&r.diagnostics[0],why=dg&&(dg.category||dg.status);setStatus('Live Desk · AI offline'+(why?' · '+String(why).replace(/_/g,' '):''),'warn');}else if(r.provider==='live_desk')setStatus('Connected · LIVE DESK',true);else if(r.provider)setStatus('Connected · '+String(r.provider).toUpperCase(),true);
      }catch(e){var diags=e&&e.data&&Array.isArray(e.data.diagnostics)?e.data.diagnostics:[];var safe=diags.map(function(d){var name=String(d.provider||'AI').toUpperCase();var status=d.status?' '+d.status:'';var reason=d.detail||d.message||d.category||'provider error';return name+status+' · '+reason;}).join(' | ');var msg=e.message||'Vera could not complete that request.';append('assistant',safe?msg+'\n\n'+safe:msg);setStatus(safe||msg||'AI provider unavailable',false);healthChecked=false;}
      finally{if(sendBtn){sendBtn.disabled=false;sendBtn.textContent='Send';}}
    }
    qs('_asst-send').onclick=send;qs('_asst-input').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey)send();});
    append('assistant','I can use live Agency Desk context for roster, bookings, castings, tasks, CRM and mobility questions.');
    checkHealth();
  };
}
async function openSession(first){
  loginBusy(true,'Loading agency…');
  var shellPromise=window.__VEUX_ENSURE_SHELL__?window.__VEUX_ENSURE_SHELL__():Promise.resolve(true);
  var both=await Promise.all([
    api('/api/agent/bootstrap?organization='+encodeURIComponent(orgSlug),{method:'GET',headers:{},__fresh:!!first}),
    api('/api/agent/bootstrap?organization='+encodeURIComponent(orgSlug)+'&section=roster',{method:'GET',headers:{},__fresh:!!first})
  ]),core=both[0],roster=both[1];
  Object.assign(core,roster);state.bootstrap=core;state.org=core.organization;state.permissions=new Set(core.current_user&&core.current_user.permissions||[]);
  hydrateTeam(core);hydrateModels(roster.roster||roster);installAssistant();
  await shellPromise;
  await waitForShellReady();
  var app=qs('app'),login=qs('login');if(login)login.style.display='none';if(app)app.style.display='';if(document.body)document.body.dataset.veuxSessionReady='1';
  if(first&&typeof window.launch==='function')window.launch();else if(typeof window.rerender==='function')window.rerender();
  loginBusy(false);window.dispatchEvent(new CustomEvent('veux:agency-v16-session',{detail:{legacyRuntime:false,models:state.models.length,parallelBootstrap:true}}));
}
async function refresh(){clearApiCache();await openSession(false);return state.bootstrap;}
async function signOut(){try{if(state.client&&state.client.auth)await state.client.auth.signOut();}catch(_e){}clearApiCache();state.session=null;state.bootstrap=null;state.org=null;window.whoKey=null;rewriteLogin();var app=qs('app');if(app){app.classList.remove('on');app.style.display='none';}var login=qs('login');if(login)login.style.display='';if(document.body)delete document.body.dataset.veuxSessionReady;}
function showReconnect(msg,retryFn){
  var login=qs('login');if(!login)return;var card=login.querySelector('.lg-card');if(!card)return;
  login.style.display='';var app=qs('app');if(app)app.style.display='none';
  var top=card.querySelector('.lg-top');
  if(top)top.innerHTML='<div class="lg-logo">C</div><div class="lg-eyebrow">Still signed in</div><div class="lg-h1">Reconnecting…</div><div class="lg-sub">Your session is fine — the portal just could not load. Retrying automatically.</div>';
  var form=card.querySelector('.lg-body');
  if(form){form.setAttribute('onsubmit','return false;');form.innerHTML='<div class="lg-err" style="display:block">'+(msg||'Connection issue.')+'</div><button type="button" class="lg-btn" id="veuxReconnectBtn">Retry now</button>';var rb=qs('veuxReconnectBtn');if(rb)rb.onclick=function(){rb.disabled=true;rb.textContent='Retrying…';retryFn();};}
}
async function openSessionWithRetry(first,attempts){
  attempts=attempts||3;var lastErr=null;
  for(var i=0;i<attempts;i++){
    try{await openSession(first);return true;}
    catch(e){lastErr=e;console.warn('[VEUX 16.0] bootstrap attempt '+(i+1)+' failed',e&&e.message||e);if(i<attempts-1)await new Promise(function(res){setTimeout(res,600*(i+1));});}
  }
  throw lastErr||new Error('VEUX Agency Portal could not start.');
}
async function init(){if(initStarted)return;initStarted=true;loginBusy(true,'Connecting…');try{var cfg=await loadPublicConfig();state.publicConfig=cfg;var forgot=qs('veuxForgotBtn');if(!window.supabase||!window.supabase.createClient)throw new Error('Supabase client library did not load');state.client=window.supabase.createClient(cfg.supabase_url,cfg.supabase_publishable_key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'veux-agent-mogy-auth-v1'}});window.VEUX_SUPABASE_CLIENT=state.client;state.client.auth.onAuthStateChange(function(evt,session){state.session=session;if(evt==='PASSWORD_RECOVERY'||(evt==='SIGNED_IN'&&(passwordSetupMode||urlWantsPasswordSetup())))setTimeout(renderPasswordSetup,0);if(evt==='SIGNED_OUT')rewriteLogin();});var recoveryToken='';try{recoveryToken=new URL(location.href).searchParams.get('recovery_token')||'';}catch(_e){}if(recoveryToken){var vr=await state.client.auth.verifyOtp({token_hash:recoveryToken,type:'recovery'});if(vr.error)throw new Error('This recovery link is invalid or expired. Request one new link from the Agency Portal.');state.session=vr.data&&vr.data.session||null;passwordSetupMode=true;initialAuthUrl=location.href;try{history.replaceState({},document.title,location.pathname);}catch(_e){}}else{var sr=await state.client.auth.getSession();if(sr.error)throw sr.error;state.session=sr.data.session;if(!state.session){try{var code=new URL(location.href).searchParams.get('code');if(code){var ex=await state.client.auth.exchangeCodeForSession(code);if(ex.error)throw ex.error;state.session=ex.data.session;passwordSetupMode=true;}}catch(_e){}}}if(!state.session){rewriteLogin();loginBusy(false);if(forgot&&cfg.email_delivery_configured===false){forgot.disabled=true;forgot.textContent='Password reset temporarily offline';forgot.title='Email delivery is not configured for this deployment';}return;}if(passwordSetupMode||urlWantsPasswordSetup()){rewriteLogin();loginBusy(false);renderPasswordSetup();return;}await ensureMfa();try{await openSessionWithRetry(true,3);}catch(bootErr){console.error('[VEUX 16.0] Agency bootstrap error (session preserved)',bootErr);showReconnect(bootErr&&bootErr.message||'Could not load the portal.',function(){initStarted=false;initialAuthUrl=location.href;init();});}}catch(e){console.error('[VEUX 16.0] Agency bootstrap error',e);rewriteLogin();loginError(e.message||'VEUX Agency Portal could not start.');loginBusy(false);}}
window.VEUX_AGENT_V4={state:state,api:api,refresh:refresh,signOut:signOut,clearApiCache:clearApiCache,invalidateCache:invalidateApiCache,uploadModelMedia:uploadModelMedia,init:init};window.VEUX_AGENT_V16={state:state,api:api,refresh:refresh,signOut:signOut,clearApiCache:clearApiCache,invalidateCache:invalidateApiCache,uploadModelMedia:uploadModelMedia,init:init};
if(window.__VEUX_AUTH_LOADER_ACTIVE__){
  if(window.__VEUX_AUTH_READY__)init();else window.addEventListener('veux:auth-ready',init,{once:true});
}else if(window.__VEUX_ASSET_LOADER_ACTIVE__){
  if(window.__VEUX_ASSETS_READY__)init();else window.addEventListener('veux:assets-ready',init,{once:true});
}else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
