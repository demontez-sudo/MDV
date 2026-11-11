/* Model sign-in: who can sign in, who has been invited, and one-tap invites. The server side is agent-model-access-16-12-43.mjs (list, send_invite, bulk_invite). */
(function(){
'use strict';
var MOUNT=location.pathname.indexOf('/admin/')===0?'/admin':'',BASES=[MOUNT+'/api/agent/model-access','/.netlify/functions/agent-model-access-16-12-43'],S={rows:[],sel:{},filter:'todo',q:'',busy:false};
var STAGES=[['not_linked','No login yet'],['ready','Not invited'],['invited','Invited'],['signed_in','Signed in'],['disabled','Switched off']];
function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function msg(t,kind){var m=$('msg');m.style.display=t?'block':'none';m.className=kind||'bad';m.textContent=t||'';}
function token(){
  try{var keys=['veux-agent-mogy-auth-v1'];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k))keys.push(k);}
    for(var j=0;j<keys.length;j++){var raw=localStorage.getItem(keys[j]);if(!raw)continue;var o=JSON.parse(raw),t=o&&(o.access_token||(o.currentSession&&o.currentSession.access_token));if(t){if(o.expires_at&&o.expires_at*1000<Date.now()-60000)throw new Error('Your sign-in has expired. Open the portal in another tab so it refreshes, then reload this page.');return t;}}
  }catch(e){if(/expired/.test(e.message))throw e;}
  throw new Error('You are not signed in here. Open the portal, sign in, then come back to this page.');
}
async function call(method,body,query){
  var t=token(),last=null;
  for(var i=0;i<BASES.length;i++){
    try{
      var url=BASES[i]+(query?'?'+query:''),opt={method:method,headers:{Authorization:'Bearer '+t}};
      if(body){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(Object.assign({organization_slug:'maison-de-veux'},body));}
      var r=await fetch(url,opt),j=await r.json().catch(function(){return null;});
      if(r.status===404&&i<BASES.length-1)continue;
      if(!r.ok||!j||j.ok===false)throw new Error((j&&(j.error||j.message))||('The server answered '+r.status));
      return j;
    }catch(e){last=e;if(i<BASES.length-1&&/Failed to fetch|NetworkError/i.test(e.message))continue;throw e;}
  }
  throw last||new Error('No answer from the server');
}
function ago(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';var days=Math.floor((Date.now()-d)/864e5);return days<=0?'today':days===1?'yesterday':days+' days ago';}
function counts(){var c={};STAGES.forEach(function(s){c[s[0]]=0;});S.rows.forEach(function(r){c[r.stage]=(c[r.stage]||0)+1;});return c;}
function visible(){
  var q=S.q.trim().toLowerCase();
  return S.rows.filter(function(r){
    if(S.filter==='todo'&&(r.stage==='signed_in'||r.stage==='disabled'))return false;
    if(S.filter!=='todo'&&S.filter!=='all'&&r.stage!==S.filter)return false;
    return !q||(r.name+' '+(r.contact_email||'')+' '+(r.login_email||'')).toLowerCase().indexOf(q)>=0;
  });
}
function paint(){
  var c=counts();
  $('stats').innerHTML=STAGES.map(function(s){return '<div class="stat"><b>'+c[s[0]]+'</b><span>'+s[1]+'</span></div>';}).join('');
  var tabs=[['todo','Needs attention'],['all','Everyone']].concat(STAGES.map(function(s){return [s[0],s[1]];}));
  $('tabs').innerHTML=tabs.map(function(t){return '<button type="button" data-tab="'+t[0]+'" class="'+(S.filter===t[0]?'on':'')+'">'+esc(t[1])+'</button>';}).join('');
  var rows=visible();
  $('rows').innerHTML=rows.length?rows.map(function(r){
    var email=r.login_email||r.contact_email||'',noEmail=!email,canSend=!noEmail&&r.stage!=='disabled',label=r.stage==='invited'||r.invite_count?'Resend':'Send invite';
    return '<tr><td><input type="checkbox" data-sel="'+esc(r.model_id)+'"'+(S.sel[r.model_id]?' checked':'')+(canSend?'':' disabled')+' aria-label="Select '+esc(r.name)+'"></td>'
      +'<td><b>'+esc(r.name)+'</b>'+(r.phone?'<small>'+esc(r.phone)+'</small>':'')+'</td>'
      +'<td><span class="pill '+esc(r.stage)+'">'+esc((STAGES.filter(function(s){return s[0]===r.stage;})[0]||[0,r.stage])[1])+'</span>'+(r.stage==='signed_in'&&r.last_login?'<small>last in '+esc(ago(r.last_login))+'</small>':'')+'</td>'
      +'<td class="hide">'+(noEmail?'<span style="color:var(--bad)">No email on the profile</span>':esc(email))+'</td>'
      +'<td class="hide">'+(r.invited_at?esc(ago(r.invited_at))+'<small>'+r.invite_count+' sent</small>':'<span class="mute">Never</span>')+'</td>'
      +'<td style="white-space:nowrap;text-align:right">'+(r.stage==='signed_in'?'':'<button class="sm" data-send="'+esc(r.model_id)+'"'+(canSend?'':' disabled')+'>'+label+'</button> <button class="sm" data-copy="'+esc(r.model_id)+'"'+(canSend?'':' disabled')+'>Copy message</button>')+'</td></tr>';
  }).join(''):'<tr><td colspan="6" class="mute">Nobody here.</td></tr>';
  var n=Object.keys(S.sel).filter(function(k){return S.sel[k];}).length;
  $('sendSel').disabled=S.busy||!n;$('sendSel').textContent=n?'Send invites to '+n+' selected':'Send invites to selected';
}
async function load(keep){
  try{if(!keep)msg('');var r=await call('GET',null,'list=1&organization=maison-de-veux');S.rows=r.models||[];paint();}
  catch(e){msg(e.message||String(e));$('rows').innerHTML='<tr><td colspan="6" class="mute">Could not load.</td></tr>';}
}
function find(id){return S.rows.filter(function(r){return r.model_id===id;})[0];}
async function sendOne(id){
  var r=find(id);S.busy=true;paint();
  try{var out=await call('POST',{model_id:id,action:'send_invite',channel:'email'});msg('Invite sent to '+out.email+'.','ok');}
  catch(e){msg((r?r.name+': ':'')+(e.message||String(e)));}
  S.busy=false;await load(true);
}
async function copyOne(id){
  var r=find(id);
  try{
    var out=await call('POST',{model_id:id,action:'send_invite',channel:'link'});
    $('copytitle').textContent='Message for '+(r?r.name:'the model');$('copytext').value=out.message_text||'';$('copybox').hidden=false;
    var digits=String((r&&r.phone)||'').replace(/[^\d]/g,'');$('wa').href='https://wa.me/'+(digits?digits:'')+'?text='+encodeURIComponent(out.message_text||'');
    $('copybox').scrollIntoView({behavior:'smooth',block:'center'});msg('Link made. It counts as invited. It works for 7 days and only for this model.','ok');
    await load(true);
  }catch(e){msg((r?r.name+': ':'')+(e.message||String(e)));}
}
async function sendSelected(){
  var ids=Object.keys(S.sel).filter(function(k){return S.sel[k];});if(!ids.length)return;
  if(!confirm('Email an invitation to '+ids.length+' model'+(ids.length===1?'':'s')+'?'))return;
  S.busy=true;paint();var sent=0,skipped=[],failed=[];
  var queue=ids.slice(),done=0,guard=0;
  while(queue.length&&guard++<60){
    var batch=queue.splice(0,3);
    $('prog').textContent='Sending… '+done+' of '+ids.length;
    try{var out=await call('POST',{action:'bulk_invite',model_ids:batch});
      (out.results||[]).forEach(function(x){var r=find(x.model_id);var nm=(r&&r.name)||x.name||'a model';if(x.ok){sent++;done++;}else if(x.deferred){queue.push(x.model_id);}else if(x.skipped){skipped.push(nm+' ('+x.reason+')');done++;}else{failed.push(nm+': '+x.reason);done++;}});
    }catch(e){failed.push(batch.length+' invite'+(batch.length===1?'':'s')+' did not go: '+(e.message||e));done+=batch.length;}
  }
  S.sel={};S.busy=false;$('prog').textContent='';
  msg(sent+' invitation'+(sent===1?'':'s')+' sent.'+(skipped.length?' Skipped: '+skipped.join(', ')+'.':'')+(failed.length?' Failed: '+failed.join(' · ')+'.':''),failed.length?'bad':'ok');
  await load(true);
}
async function checkMail(){
  $('mailsum').textContent='Checking…';
  try{
    var r=await call('GET',null,'email_check=1&organization=maison-de-veux'),m=r.email||{},bad=(m.problems||[]).length;
    $('mailsum').innerHTML=(bad?'<span style="color:var(--bad)">Not ready</span>':'<span style="color:var(--ok)">Ready to send</span>')+' · from '+esc(m.sender_email||'no sender set');
    var rows=(r.recent||[]).map(function(x){return '<tr><td>'+esc(ago(x.at)||'')+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.to)+'</td><td>'+esc(x.status)+'</td></tr>';}).join('');
    $('maildet').innerHTML=(bad?'<p style="color:var(--bad)">'+m.problems.map(esc).join('<br>')+'</p>':'')+(rows?'<p>Last emails the portal handed to the email service ("sent" means accepted by it; if one never arrives, look it up in your Resend dashboard):</p><table><tbody>'+rows+'</tbody></table>':'<p>No invite or reset email has been sent yet.</p>');
  }catch(e){$('mailsum').innerHTML='<span style="color:var(--bad)">Could not check</span>';$('maildet').textContent=e.message||String(e);}
}
async function testMail(){
  $('mailsum').textContent='Sending a test…';
  try{var r=await call('POST',{action:'send_test_email'});$('mailsum').innerHTML='<span style="color:var(--ok)">Test sent to '+esc(r.sent_to)+'</span> · check your inbox (and spam) in a minute';}
  catch(e){$('mailsum').innerHTML='<span style="color:var(--bad)">The test did not send</span>';$('maildet').textContent=(e.message||String(e));}
}
document.addEventListener('click',function(e){
  var t=e.target.closest&&e.target.closest('[data-tab],[data-send],[data-copy]');
  if(t){if(t.dataset.tab){S.filter=t.dataset.tab;paint();}else if(t.dataset.send)sendOne(t.dataset.send);else if(t.dataset.copy)copyOne(t.dataset.copy);return;}
  if(e.target.id==='selNot'){S.sel={};visible().forEach(function(r){if((r.login_email||r.contact_email)&&r.stage!=='signed_in'&&r.stage!=='disabled')S.sel[r.model_id]=true;});paint();}
  if(e.target.id==='selNone'){S.sel={};paint();}
  if(e.target.id==='sendSel')sendSelected();
  if(e.target.id==='copyclose')$('copybox').hidden=true;
  if(e.target.id==='mailbtn')checkMail();
  if(e.target.id==='mailtest')testMail();
  if(e.target.id==='copybtn'){var ta=$('copytext');ta.select();(navigator.clipboard?navigator.clipboard.writeText(ta.value):Promise.reject()).then(function(){e.target.textContent='Copied ✓';setTimeout(function(){e.target.textContent='Copy message';},1800);},function(){document.execCommand&&document.execCommand('copy');});}
});
document.addEventListener('change',function(e){if(e.target.dataset&&e.target.dataset.sel){S.sel[e.target.dataset.sel]=e.target.checked;paint();}});
$('q').addEventListener('input',function(){S.q=this.value;paint();});
load();checkMail();
})();
