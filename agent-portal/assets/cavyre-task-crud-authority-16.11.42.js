(function(){
'use strict';
if(window.__CAVYRE_TASK_CRUD_161276__)return;
window.__CAVYRE_TASK_CRUD_161276__=1;
var cache=null,editing=null;

function bridge(){if(!window.VEUX_AGENT_V4||!VEUX_AGENT_V4.api)throw new Error('Agent bridge is not ready');return VEUX_AGENT_V4;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return'maison-de-veux';}}
function api(path,opt){return bridge().api(path,opt||{method:'GET',headers:{}});}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function toast(v){try{if(window.toast)return window.toast(v);if(window.say)return window.say(v);}catch(e){}console.log(v);}
function modal(){var m=document.getElementById('vx161275-task-modal');if(m)m.remove();m=document.createElement('div');m.id='vx161275-task-modal';m.className='vx161275-backdrop';document.body.appendChild(m);return m;}
function localDate(v){if(!v)return'';var d=new Date(v);if(isNaN(d))return'';var z=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes());}
async function data(force){if(cache&&!force)return cache;cache=await api('/api/agent/tasks/v11?organization='+encodeURIComponent(org())+'&_cavyre_fresh='+Date.now());return cache;}
function close(){var m=document.getElementById('vx161275-task-modal');if(m)m.remove();editing=null;}

function options(d,t){
 var assigned=t?(t.assignments||[]).map(function(a){return String(a.member_id||'')}):[];
 return {
  models:(d.models||[]).map(function(x){return '<option value="'+esc(x.id)+'" '+(t&&String(t.model_id)===String(x.id)?'selected':'')+'>'+esc(x.display_name||x.public_slug||'Model')+'</option>';}).join(''),
  staff:(d.members||[]).map(function(x){var nm=x.profile&&x.profile.display_name||x.job_title||'Staff';return '<option value="'+esc(x.id)+'" '+(assigned.includes(String(x.id))?'selected':'')+'>'+esc(nm)+'</option>';}).join('')
 };
}

async function open(id){
 var m=modal();
 m.innerHTML='<section class="vx161275-modal vx161275-loading">Loading task controls…</section>';
 try{
  var d=await data(true),t=id?(d.tasks||[]).find(function(x){return String(x.id)===String(id)}):null;editing=t||null;
  var o=options(d,t),isEdit=!!t;
  m.innerHTML=
  '<section class="vx161275-modal" role="dialog" aria-modal="true" aria-labelledby="vx161275-title">'+
   '<header><div><small>TASK COMMAND</small><h2 id="vx161275-title">'+(isEdit?'Edit Task':'Quick Task')+'</h2><p>'+(isEdit?'Update only what needs to change.':'Create the task first. Add details only when you need them.')+'</p></div><button type="button" class="vx161275-x" data-close>×</button></header>'+
   '<form id="vx161275-form">'+
    '<div class="vx161275-core">'+
     '<label class="wide"><span>Task</span><input id="vx161275-tt" required maxlength="180" placeholder="What needs to get done?" value="'+esc(t&&t.title||'')+'"></label>'+
     '<label><span>Owner</span><select id="vx161275-owner"><option value="">Unassigned</option>'+o.staff+'</select></label>'+
     '<label><span>Due</span><input id="vx161275-due" type="datetime-local" value="'+esc(localDate(t&&t.due_at))+'"></label>'+
    '</div>'+
    '<button class="vx161275-details-toggle" type="button" id="vx161275-toggle" aria-expanded="'+(isEdit?'true':'false')+'">'+(isEdit?'Hide optional details':'Add details')+' <b>＋</b></button>'+
    '<div class="vx161275-details '+(isEdit?'open':'')+'" id="vx161275-details">'+
      '<div class="vx161275-grid">'+
       '<label><span>Priority</span><select id="vx161275-pr"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></label>'+
       '<label><span>Model</span><select id="vx161275-model"><option value="">— No model —</option>'+o.models+'</select></label>'+
       '<label><span>Category</span><input id="vx161275-cat" value="'+esc(t&&t.category||'Operations')+'"></label>'+
       (isEdit?'<label><span>Status</span><select id="vx161275-status"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>':'')+
       '<label class="wide"><span>Additional Owners</span><select id="vx161275-staff" multiple size="4">'+o.staff+'</select><em>Optional · Command/Ctrl to select more than one.</em></label>'+
       '<label class="wide"><span>Notes</span><textarea id="vx161275-desc" rows="4" placeholder="Optional notes, instructions, context…">'+esc(t&&t.description||'')+'</textarea></label>'+
      '</div>'+
    '</div>'+
    '<div id="vx161275-error" class="vx161275-error" hidden></div>'+
    '<footer><button type="button" class="ghost" data-close>Cancel</button><button type="submit" class="primary">'+(isEdit?'Save Changes':'Create Task')+'</button></footer>'+
   '</form>'+
  '</section>';

  var pr=document.getElementById('vx161275-pr');if(pr)pr.value=t&&t.priority||'normal';
  var st=document.getElementById('vx161275-status');if(st)st.value=t&&t.status||'open';

  // Preselect first assigned owner in the quick owner field.
  var owner=document.getElementById('vx161275-owner');
  if(owner&&t&&t.assignments&&t.assignments.length)owner.value=String(t.assignments[0].member_id||'');

  m.querySelectorAll('[data-close]').forEach(function(b){b.onclick=close;});
  m.onclick=function(e){if(e.target===m)close();};
  m.querySelector('form').onsubmit=save;

  var toggle=document.getElementById('vx161275-toggle'),details=document.getElementById('vx161275-details');
  toggle.onclick=function(){
    var on=!details.classList.contains('open');
    details.classList.toggle('open',on);
    toggle.setAttribute('aria-expanded',on?'true':'false');
    toggle.childNodes[0].nodeValue=on?'Hide optional details ':'Add details ';
  };
  setTimeout(function(){var x=document.getElementById('vx161275-tt');if(x)x.focus();},0);
 }catch(e){
  m.innerHTML='<section class="vx161275-modal vx161275-loading">Unable to load task controls.<br><small>'+esc(e.message||e)+'</small><br><button data-close>Close</button></section>';
  m.querySelector('[data-close]').onclick=close;
 }
}

async function save(e){
 e.preventDefault();
 var q=function(id){return document.getElementById(id)},btn=e.currentTarget.querySelector('[type=submit]'),err=q('vx161275-error');
 var title=(q('vx161275-tt').value||'').trim();if(!title){q('vx161275-tt').focus();return;}
 var due=q('vx161275-due').value,owner=q('vx161275-owner').value||'';
 var staff=Array.from(q('vx161275-staff').selectedOptions).map(function(o){return o.value}).filter(Boolean);
 if(owner&&!staff.includes(owner))staff.unshift(owner);
 var body={
  organization_slug:org(),action:editing?'update_task':'create_task',task_id:editing&&editing.id||undefined,
  title:title,
  description:(q('vx161275-desc').value||'').trim()||null,
  priority:q('vx161275-pr').value||'normal',
  due_at:due?new Date(due).toISOString():null,
  category:(q('vx161275-cat').value||'Operations').trim(),
  model_id:q('vx161275-model').value||null,
  member_ids:staff
 };
 if(editing&&q('vx161275-status'))body.status=q('vx161275-status').value;
 btn.disabled=true;btn.textContent=editing?'SAVING…':'CREATING…';err.hidden=true;
 try{
  var r=await api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r||r.verified!==true)throw new Error('Task save was not verified.');
  cache=null;close();
  try{if(window.VEUX_AGENT_V4.clearApiCache)VEUX_AGENT_V4.clearApiCache();}catch(_e){}
  toast(editing?'Task updated':'Task created');
  var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
  if(window.VEUX_V148)window.VEUX_V148.task=null;
  if(window.renderTasksConsolidated&&root)await window.renderTasksConsolidated(root);
 }catch(ex){
  err.textContent=ex.message||String(ex);err.hidden=false;btn.disabled=false;btn.textContent=editing?'Save Changes':'Create Task';
 }
}

function selectedId(root){var r=root&&root.querySelector('.v148-main .v148-row.on');if(!r)return null;var oc=r.getAttribute('onclick')||'';return (oc.match(/taskSelect\(['"]([^'"]+)/)||[])[1]||null;}
function inject(){
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
 if(!root)return;
 var add=root.querySelector('.v148-filterbar .v148-btn.gold');
 if(add){
   add.onclick=function(e){e.preventDefault();e.stopImmediatePropagation();open(null);return false;};
   add.setAttribute('onclick','return CAVYRE_TASK_CRUD_161276.open()');
   add.textContent='+ ADD TASK';
 }
 var rail=root.querySelector('.v148-task-detail .v148-actions-rail');
 if(rail&&!rail.querySelector('.vx161275-edit')){
   var b=document.createElement('button');b.className='v148-btn vx161275-edit';b.textContent='Edit Task';
   b.onclick=function(){var id=selectedId(root);if(id)open(id);};rail.insertBefore(b,rail.firstChild);
 }
}
function patchLegacy(){
 // Kill the prompt-based task creator permanently.
 if(window.VEUX_V136){VEUX_V136.newTask=function(){return open(null);};VEUX_V136.editTask=function(id){return open(id);};}
 if(window.VEUX_V10){VEUX_V10.newTask=function(){return open(null);};}
 if(window.VEUX_V7){VEUX_V7.newTask=function(){return open(null);};}
}
window.CAVYRE_TASK_CRUD_161276={open:open,close:close,refresh:function(){cache=null;inject();},release:'16.12.76'};
window.CAVYRE_TASK_CRUD_161142=window.CAVYRE_TASK_CRUD_161276;window.CAVYRE_TASK_CRUD_161275=window.CAVYRE_TASK_CRUD_161276;

var queued=false;
function tick(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;patchLegacy();inject();});}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',tick,{once:true}):tick();
new MutationObserver(function(muts){
  for(var i=0;i<muts.length;i++){if(muts[i].addedNodes&&muts[i].addedNodes.length){tick();break}}
}).observe(document.documentElement,{childList:true,subtree:true});
})();