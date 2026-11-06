/* Roles & permissions: create your own team roles, choose what each one can do, and give them to people.
   Opens from the Team page ("Roles & permissions"). Built-in roles are never changed; copy one to start your own.
   Everything is saved through /api/agent/team/v10 (create_role, save_role, delete_role, set_roles); the server decides who may do what. */
(function(){
'use strict';
if(window.MDV_ROLES)return;
var R={open:false,data:null,tab:'roles',sel:null,draft:null,busy:false,msg:'',err:''};

/* what each permission means, in plain words */
var GROUPS=[
 ['Models and roster',[
  ['models.read','See the roster and model profiles'],['models.write','Edit models'],
  ['models.private.read','See private model details'],['models.private.write','Edit private model details'],
  ['media.read','See model photos and media'],['media.write','Upload and edit model photos and media'],
  ['public_profiles.read','See public profiles'],['public_profiles.manage','Publish and edit public profiles'],
  ['roster.saved_searches','Use saved roster searches'],
  ['availability.write','Book models out and set availability'],['availability.approve','Approve book-outs']]],
 ['Packages and clients',[
  ['packages.read','See model packages'],['packages.write','Create and edit model packages'],
  ['packages.share','Send packages to clients'],['communications.send','Send emails to clients and contacts'],
  ['crm.read','See clients and contacts'],['crm.write','Add and edit clients and contacts'],['crm.manage','Manage the client database']]],
 ['Tasks and work',[
  ['tasks.write','Create and update tasks'],['tasks.manage','Manage everyone’s tasks'],['bookings.read','See bookings'],['alerts.read','See alerts']]],
 ['Documents and contracts',[
  ['documents.read','See documents'],['documents.write','Upload and edit documents'],['contracts.write','Create and send contracts']]],
 ['Travel and compliance',[
  ['mobility.read','See travel and visas'],['compliance.read','See compliance records'],['compliance.manage','Manage compliance records']]],
 ['Finance',[
  ['finance.read','See finance and invoices'],['billing.read','See billing'],['billing.manage','Manage billing']]],
 ['Team and settings',[
  ['members.read','See the team'],['members.manage','Manage the team, roles and access'],
  ['org.read','See agency settings'],['org.settings.manage','Change agency settings'],
  ['security.settings.manage','Change security settings'],['onboarding.manage','Manage onboarding'],
  ['audit.read','See the activity log'],['usage.read','See usage']]],
 ['Data and AI',[
  ['ai.use','Use Veux (AI assistant)'],['data.import','Import data'],['data.export','Export data'],['data.recover','Recover deleted data']]]
];
var PRESETS=[
 ['Package builder',['models.read','media.read','crm.read','packages.read','packages.write','packages.share','communications.send']],
 ['Roster viewer',['models.read','media.read','public_profiles.read','availability.write']],
 ['Client relations',['crm.read','crm.write','communications.send','packages.read','models.read']]
];
var KNOWN={};GROUPS.forEach(function(g){g[1].forEach(function(p){KNOWN[p[0]]=p[1];});});

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;return b&&b.api?b:null;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function api(method,body){
  var b=bridge();if(!b)return Promise.reject(new Error('The portal is still loading. Try again in a moment.'));
  var path='/api/agent/team/v10'+(method==='GET'?'?organization='+encodeURIComponent(org())+'&_t='+Date.now():'');
  var o={method:method,headers:method==='GET'?{}:{'content-type':'application/json'}};
  if(method!=='GET')o.body=JSON.stringify(Object.assign({organization_slug:org()},body||{}));
  if(method==='GET')o.__fresh=true;
  return b.api(path,o);
}
function load(){
  R.busy=true;paint();
  return api('GET').then(function(d){R.data=d;R.err='';}).catch(function(e){R.err=(e&&e.message)||'Could not load roles.';}).then(function(){R.busy=false;paint();});
}
function roles(){return arr(R.data&&R.data.roles);}
function team(){return arr(R.data&&R.data.team);}
function builtin(r){if(!r)return false;if(!r.organization_id)return true;var oid=R.data&&R.data.organization&&R.data.organization.id;return !!oid&&r.organization_id!==oid;}
function peopleCount(r){return team().filter(function(m){return arr(m.roles).some(function(x){return x.id===r.id;});}).length;}
function can(){var a=R.data&&R.data.access;return !a||a.manage!==false;}

function groupHtml(perms,disabled){
  var have={};perms.forEach(function(k){have[k]=1;});
  var known=GROUPS.map(function(g){
    var all=g[1].every(function(p){return have[p[0]];});
    return '<fieldset class="rl-g"><legend>'+esc(g[0])+'</legend>'+(disabled?'':'<button type="button" class="rl-all" data-rl-grp="'+esc(g[0])+'">'+(all?'Clear':'Select all')+'</button>')+
      g[1].map(function(p){return '<label class="rl-p"><input type="checkbox" data-rl-perm="'+esc(p[0])+'"'+(have[p[0]]?' checked':'')+(disabled?' disabled':'')+'><span>'+esc(p[1])+'</span></label>';}).join('')+'</fieldset>';
  }).join('');
  var other=perms.filter(function(k){return !KNOWN[k];});
  if(other.length)known+='<fieldset class="rl-g"><legend>Other access</legend>'+other.map(function(k){return '<label class="rl-p"><input type="checkbox" data-rl-perm="'+esc(k)+'" checked'+(disabled?' disabled':'')+'><span>'+esc(k)+'</span></label>';}).join('')+'</fieldset>';
  return known;
}

function editorHtml(){
  var d=R.draft,r=d&&d.role;
  if(!d)return '<div class="rl-empty"><b>Pick a role on the left</b><p>Or make a new one: choose what it is allowed to do, then give it to people on the People tab.</p></div>';
  var locked=!d.isNew&&builtin(r);
  var head='<div class="rl-eh"><label class="rl-nm">Role name<input class="rl-in" data-rl-name value="'+esc(d.name)+'" placeholder="e.g. Assistant with packages"'+(locked?' disabled':'')+'></label></div>';
  var note=locked?'<p class="rl-note">This is a built-in role, so it can’t be changed. <b>Copy it</b> to make your own version with different access.</p>':'';
  var presets=(d.isNew)?'<div class="rl-pre"><span>Start from</span>'+PRESETS.map(function(p,i){return '<button type="button" class="rl-chip" data-rl-preset="'+i+'">'+esc(p[0])+'</button>';}).join('')+'</div>':'';
  var foot='<div class="rl-ef">';
  if(d.isNew)foot+='<button type="button" class="rl-btn solid" data-rl-create>Create role</button>';
  else if(locked)foot+='<button type="button" class="rl-btn solid" data-rl-copy>Copy as a new role</button>';
  else foot+='<button type="button" class="rl-btn solid" data-rl-save>Save changes</button><button type="button" class="rl-btn" data-rl-copy>Copy</button><button type="button" class="rl-btn danger" data-rl-delete>Delete role</button>';
  foot+='</div>';
  return head+note+presets+'<div class="rl-groups">'+groupHtml(d.perms,locked)+'</div>'+foot;
}
function rolesTab(){
  var list=roles().map(function(r){
    var on=R.sel===r.id&&R.draft&&!R.draft.isNew;
    return '<button type="button" class="rl-r'+(on?' on':'')+'" data-rl-role="'+esc(r.id)+'"><b>'+esc(r.name)+'</b><small>'+(builtin(r)?'Built in':'Custom')+' · '+peopleCount(r)+' '+(peopleCount(r)===1?'person':'people')+'</small></button>';
  }).join('');
  return '<div class="rl-cols"><div class="rl-list"><button type="button" class="rl-new'+(R.draft&&R.draft.isNew?' on':'')+'" data-rl-newrole>+ New role</button>'+list+'</div><div class="rl-ed">'+editorHtml()+'</div></div>';
}
function peopleTab(){
  var rs=roles();
  return '<div class="rl-people">'+team().map(function(m){
    var name=(m.profile&&(m.profile.display_name||((m.profile.first_name||'')+' '+(m.profile.last_name||'')).trim()))||'Team member';
    var mine={};arr(m.roles).forEach(function(r){mine[r.id]=1;});
    return '<div class="rl-m" data-rl-member="'+esc(m.id)+'"><div class="rl-mh"><b>'+esc(name)+'</b><small>'+esc(m.job_title||'')+(m.status&&m.status!=='active'?' · '+esc(m.status):'')+'</small></div><div class="rl-mr">'+
      rs.map(function(r){return '<label class="rl-rc"><input type="checkbox" data-rl-has="'+esc(r.id)+'"'+(mine[r.id]?' checked':'')+'><span>'+esc(r.name)+'</span></label>';}).join('')+
      '</div><button type="button" class="rl-btn sm" data-rl-savem="'+esc(m.id)+'">Save</button></div>';
  }).join('')+'</div>';
}
function paint(){
  var ov=document.getElementById('mdv-roles');
  if(!R.open){if(ov)ov.remove();return;}
  if(!ov){ov=document.createElement('div');ov.id='mdv-roles';ov.className='rl-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','Roles and permissions');document.body.appendChild(ov);}
  var body;
  if(R.busy&&!R.data)body='<p class="rl-wait">Loading…</p>';
  else if(R.err&&!R.data)body='<p class="rl-bad">'+esc(R.err)+'</p>';
  else body=(R.tab==='people'?peopleTab():rolesTab());
  var keep=ov.querySelector('.rl-groups'),sc=keep?keep.scrollTop:0,ed=ov.querySelector('.rl-ed'),es=ed?ed.scrollTop:0;
  ov.innerHTML='<div class="rl-box"><header><div><h2>Roles &amp; permissions</h2><p>Choose what each role can do, then give roles to people.</p></div><button type="button" class="rl-x" data-rl-close aria-label="Close">×</button></header>'+
    '<nav class="rl-tabs"><button type="button" class="'+(R.tab==='roles'?'on':'')+'" data-rl-tab="roles">Roles</button><button type="button" class="'+(R.tab==='people'?'on':'')+'" data-rl-tab="people">People</button></nav>'+
    (R.msg?'<div class="rl-ok">'+esc(R.msg)+'</div>':'')+(R.err&&R.data?'<div class="rl-bad">'+esc(R.err)+'</div>':'')+
    '<div class="rl-body">'+body+'</div>'+(can()?'':'<p class="rl-note rl-foot">You can look at roles, but only people who manage the team can change them.</p>')+'</div>';
  var ed2=ov.querySelector('.rl-ed');if(ed2)ed2.scrollTop=es;
}
function pick(id){
  var r=roles().filter(function(x){return x.id===id;})[0];if(!r)return;
  R.sel=id;R.draft={isNew:false,role:r,name:r.name,perms:arr(r.permissions).slice()};R.msg='';R.err='';
}
function readPerms(){
  var out=[];document.querySelectorAll('#mdv-roles [data-rl-perm]').forEach(function(c){if(c.checked)out.push(c.getAttribute('data-rl-perm'));});return out;
}
function sync(){var n=document.querySelector('#mdv-roles [data-rl-name]');if(R.draft){if(n)R.draft.name=n.value;if(document.querySelector('#mdv-roles [data-rl-perm]'))R.draft.perms=readPerms();}}
function run(p,done){
  R.busy=true;R.err='';R.msg='';paint();
  return p.then(function(out){return load().then(function(){if(done)done(out);R.msg=(out&&out.msg)||R.msg;paint();});}).catch(function(e){R.busy=false;R.err=(e&&e.message)||'That did not save.';paint();});
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest)return;
  var op=t.closest('[data-rl-open]');if(op){e.preventDefault();R.open=true;R.tab='roles';R.msg='';R.err='';paint();load();return;}
  if(!document.getElementById('mdv-roles'))return;
  if(t.closest('[data-rl-close]')||t===document.getElementById('mdv-roles')){R.open=false;paint();return;}
  var tb=t.closest('[data-rl-tab]');if(tb){sync();R.tab=tb.getAttribute('data-rl-tab');R.msg='';paint();return;}
  var rb=t.closest('[data-rl-role]');if(rb){pick(rb.getAttribute('data-rl-role'));paint();return;}
  if(t.closest('[data-rl-newrole]')){R.sel=null;R.draft={isNew:true,role:null,name:'',perms:[]};R.msg='';R.err='';paint();return;}
  var pr=t.closest('[data-rl-preset]');if(pr){sync();var p=PRESETS[Number(pr.getAttribute('data-rl-preset'))];if(p){R.draft.perms=p[1].slice();if(!R.draft.name)R.draft.name=p[0];}paint();return;}
  var gb=t.closest('[data-rl-grp]');if(gb){
    sync();var g=GROUPS.filter(function(x){return x[0]===gb.getAttribute('data-rl-grp');})[0];
    if(g){var keys=g[1].map(function(x){return x[0];}),all=keys.every(function(k){return R.draft.perms.indexOf(k)>-1;});
      R.draft.perms=R.draft.perms.filter(function(k){return keys.indexOf(k)<0;});if(!all)R.draft.perms=R.draft.perms.concat(keys);}
    paint();return;}
  if(t.closest('[data-rl-copy]')){sync();var d=R.draft;R.draft={isNew:true,role:null,name:(d.name||'Role')+' copy',perms:d.perms.slice()};R.sel=null;R.msg='Copied. Name it, adjust the access and create it.';paint();return;}
  if(t.closest('[data-rl-create]')){sync();var d2=R.draft;
    if(!d2.name.trim()){R.err='Give the role a name.';paint();return;}
    run(api('POST',{action:'create_role',name:d2.name.trim(),permissions:d2.perms}).then(function(o){o.msg='Role created. Give it to people on the People tab.';if(o.role)R.sel=o.role.id;return o;}),function(){if(R.sel)pick(R.sel);});return;}
  if(t.closest('[data-rl-save]')){sync();var d3=R.draft;
    run(api('POST',{action:'save_role',role_id:d3.role.id,name:d3.name.trim(),permissions:d3.perms}).then(function(o){o.msg='Saved. People with this role get the change straight away.';return o;}),function(){pick(d3.role.id);});return;}
  if(t.closest('[data-rl-delete]')){var d4=R.draft;if(!window.confirm('Delete the role "'+d4.name+'"?'))return;
    run(api('POST',{action:'delete_role',role_id:d4.role.id}).then(function(o){o.msg='Role deleted.';return o;}),function(){R.draft=null;R.sel=null;});return;}
  var sm=t.closest('[data-rl-savem]');if(sm){
    var row=sm.closest('[data-rl-member]'),ids=[];row.querySelectorAll('[data-rl-has]').forEach(function(c){if(c.checked)ids.push(c.getAttribute('data-rl-has'));});
    run(api('POST',{action:'set_roles',member_id:sm.getAttribute('data-rl-savem'),role_ids:ids}).then(function(o){o.msg='Roles updated.';return o;}));return;}
});
document.addEventListener('input',function(e){if(e.target&&e.target.matches&&e.target.matches('[data-rl-name]')&&R.draft)R.draft.name=e.target.value;});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&R.open){R.open=false;paint();}});

/* the entry point sits on the Team page */
function place(){
  var pg=document.getElementById('p-team');if(!pg)return;
  var shown=pg.classList.contains('on')||pg.offsetParent!==null;
  var b=document.getElementById('mdv-roles-open');
  if(!shown||!pg.children.length){if(b)b.remove();return;}
  if(b&&b.parentNode===pg)return;
  if(!b){b=document.createElement('button');b.type='button';b.id='mdv-roles-open';b.className='rl-open';b.setAttribute('data-rl-open','');b.textContent='Roles & permissions';}
  pg.insertBefore(b,pg.firstChild);
}
setInterval(place,800);

/* ---- forms for one person: their roles, and where they can work (these used to be pop-up text prompts) ---- */
var F={el:null};
function refreshTeam(){try{var el=document.getElementById('p-team');if(el&&typeof window.renderTeamDirectory==='function')window.renderTeamDirectory(el);}catch(e){}}
function closeForm(){if(F.el){F.el.remove();F.el=null;}}
function formShell(title,sub,body,foot){
  closeForm();
  var d=document.createElement('div');d.className='rl-ov';d.id='mdv-roles-form';d.setAttribute('role','dialog');d.setAttribute('aria-label',title);
  d.innerHTML='<div class="rl-box rl-small"><header><div><h2>'+esc(title)+'</h2><p>'+esc(sub)+'</p></div><button type="button" class="rl-x" data-rlf-close aria-label="Close">×</button></header><div class="rl-fmsg"></div><div class="rl-body">'+body+'</div><footer class="rl-ff">'+foot+'</footer></div>';
  document.body.appendChild(d);F.el=d;return d;
}
function fmsg(t,bad){var m=F.el&&F.el.querySelector('.rl-fmsg');if(m)m.innerHTML=t?'<div class="'+(bad?'rl-bad':'rl-ok')+'">'+esc(t)+'</div>':'';}
function memberName(m){return (m&&m.profile&&(m.profile.display_name||((m.profile.first_name||'')+' '+(m.profile.last_name||'')).trim()))||(m&&m.job_title)||'this person';}
function loadTeam(){return api('GET').then(function(d){R.data=d;return d;});}
function scopeName(d,sc){
  var t=sc.scope_type||'organization';if(t==='organization')return 'The whole agency';
  var key={market:'markets',division:'divisions',board:'boards',office:'offices'}[t],list=arr(d.structure&&d.structure[key]),hit=list.filter(function(x){return x.id===sc.scope_id;})[0];
  return t.charAt(0).toUpperCase()+t.slice(1)+': '+(hit?hit.name:'(removed)');
}
var LEVELS=[['read','Read only','Can look, but not change anything.'],['work','Work','Can do day-to-day work: edit, create and update.'],['manage','Manage','Can also change set-up and who has access.']];

function memberRolesForm(id){
  loadTeam().then(function(d){
    var m=arr(d.team).filter(function(x){return x.id===id;})[0];if(!m){window.alert('That person was not found.');return;}
    var mine={};arr(m.roles).forEach(function(r){mine[r.id]=1;});
    var body='<p class="rl-lead">Tick every role '+esc(memberName(m))+' should have. They get all the access from every role they hold.</p><div class="rl-rolebox">'+
      arr(d.roles).map(function(r){
        var n=arr(r.permissions).length,own=r.organization_id&&d.organization&&r.organization_id===d.organization.id;
        return '<label class="rl-rcard"><input type="checkbox" data-rlf-role="'+esc(r.id)+'"'+(mine[r.id]?' checked':'')+'><span><b>'+esc(r.name)+'</b><small>'+(own?'Custom':'Built in')+' · '+n+' '+(n===1?'permission':'permissions')+'</small></span></label>';
      }).join('')+'</div>'+(d.access&&d.access.manage===false?'':'<p class="rl-lead"><button type="button" class="rl-link" data-rlf-editroles>Create or change roles</button></p>');
    var el=formShell('Roles for '+memberName(m),'Roles decide what this person can see and do in the portal.',body,'<button type="button" class="rl-btn" data-rlf-close>Cancel</button><button type="button" class="rl-btn solid" data-rlf-saveroles="'+esc(id)+'">Save roles</button>');
  }).catch(function(e){window.alert((e&&e.message)||'Could not load roles.');});
}
function memberScopeForm(id){
  loadTeam().then(function(d){
    var m=arr(d.team).filter(function(x){return x.id===id;})[0];if(!m){window.alert('That person was not found.');return;}
    var cur=arr(m.scopes).filter(function(x){return x.enabled!==false;});
    var curHtml=cur.length?'<ul class="rl-sc">'+cur.map(function(sc,i){var lv=LEVELS.filter(function(l){return l[0]===(sc.access_level||'work');})[0];
      return '<li><span><b>'+esc(scopeName(d,sc))+'</b><small>'+esc(lv?lv[1]:sc.access_level||'Work')+'</small></span><button type="button" class="rl-btn sm danger" data-rlf-rmscope="'+i+'">Remove</button></li>';}).join('')+'</ul>':'<p class="rl-lead">Right now '+esc(memberName(m))+' has no set limits, so they follow their roles across the whole agency.</p>';
    var body='<h3 class="rl-h3">Where they can work now</h3>'+curHtml+
      '<h3 class="rl-h3">Add a limit</h3><div class="rl-form">'+
      '<label class="rl-fl">Where<select class="rl-in" data-rlf-type><option value="organization">The whole agency</option><option value="market">A market (e.g. New York, Paris)</option><option value="division">A division (e.g. Women, Men)</option><option value="board">A board</option><option value="office">An office</option></select></label>'+
      '<label class="rl-fl" data-rlf-whichwrap hidden>Which one<select class="rl-in" data-rlf-which></select></label>'+
      '<fieldset class="rl-fl rl-lv"><legend>What they can do there</legend>'+LEVELS.map(function(l,i){return '<label class="rl-opt"><input type="radio" name="rlf-level" value="'+l[0]+'"'+(i===1?' checked':'')+'><span><b>'+l[1]+'</b><small>'+l[2]+'</small></span></label>';}).join('')+'</fieldset></div>';
    formShell('Scope for '+memberName(m),'Scope limits where a person can work, such as one market or one board.',body,'<button type="button" class="rl-btn" data-rlf-close>Close</button><button type="button" class="rl-btn solid" data-rlf-addscope="'+esc(id)+'">Add this scope</button>');
    F.d=d;F.m=m;F.cur=cur;fillWhich();
  }).catch(function(e){window.alert((e&&e.message)||'Could not load the team.');});
}
function fillWhich(){
  if(!F.el)return;var t=F.el.querySelector('[data-rlf-type]').value,w=F.el.querySelector('[data-rlf-whichwrap]'),sel=F.el.querySelector('[data-rlf-which]');
  if(t==='organization'){w.hidden=true;sel.innerHTML='';return;}
  var key={market:'markets',division:'divisions',board:'boards',office:'offices'}[t],list=arr(F.d&&F.d.structure&&F.d.structure[key]);
  w.hidden=false;sel.innerHTML=list.length?list.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join(''):'<option value="">Nothing set up yet</option>';
}
document.addEventListener('change',function(e){if(e.target&&e.target.matches&&e.target.matches('[data-rlf-type]'))fillWhich();});
document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest||!F.el)return;
  if(t===F.el||t.closest('[data-rlf-close]')){closeForm();return;}
  if(t.closest('[data-rlf-editroles]')){closeForm();window.MDV_ROLES.open();return;}
  var sr=t.closest('[data-rlf-saveroles]');if(sr){
    var ids=[];F.el.querySelectorAll('[data-rlf-role]').forEach(function(c){if(c.checked)ids.push(c.getAttribute('data-rlf-role'));});
    fmsg('Saving…');
    api('POST',{action:'set_roles',member_id:sr.getAttribute('data-rlf-saveroles'),role_ids:ids}).then(function(){closeForm();refreshTeam();}).catch(function(err){fmsg((err&&err.message)||'That did not save.',true);});return;}
  var rm=t.closest('[data-rlf-rmscope]');if(rm){
    var sc=F.cur[Number(rm.getAttribute('data-rlf-rmscope'))];if(!sc)return;fmsg('Removing…');
    api('POST',{action:'set_scope',member_id:F.m.id,scope_type:sc.scope_type||'organization',scope_id:sc.scope_id||null,access_level:sc.access_level||'work',enabled:false}).then(function(){refreshTeam();memberScopeForm(F.m.id);}).catch(function(err){fmsg((err&&err.message)||'That did not save.',true);});return;}
  var as=t.closest('[data-rlf-addscope]');if(as){
    var type=F.el.querySelector('[data-rlf-type]').value,which=F.el.querySelector('[data-rlf-which]').value,lv=F.el.querySelector('input[name="rlf-level"]:checked');
    if(type!=='organization'&&!which){fmsg('Pick which '+type+' first.',true);return;}
    fmsg('Saving…');
    api('POST',{action:'set_scope',member_id:as.getAttribute('data-rlf-addscope'),scope_type:type,scope_id:type==='organization'?null:which,access_level:lv?lv.value:'work',enabled:true}).then(function(){refreshTeam();memberScopeForm(as.getAttribute('data-rlf-addscope'));setTimeout(function(){fmsg('Scope added.');},60);}).catch(function(err){fmsg((err&&err.message)||'That did not save.',true);});return;}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&F.el)closeForm();});
/* replace the old pop-up prompts on the Team page */
function hook(){
  var a=window.VEUX_V135;if(a&&!a.__rlForms){a.teamRoles=memberRolesForm;a.teamScope=memberScopeForm;a.__rlForms=1;}
  var b=window.VEUX_V10;if(b&&!b.__rlForms&&('memberRoles' in b||'memberScope' in b)){b.memberRoles=memberRolesForm;b.memberScope=memberScopeForm;b.__rlForms=1;}
}
setInterval(hook,700);hook();
window.MDV_ROLES={open:function(){R.open=true;R.tab='roles';paint();load();},memberRoles:memberRolesForm,memberScope:memberScopeForm};
})();
