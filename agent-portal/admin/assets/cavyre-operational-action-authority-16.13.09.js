/* CAVYRE 16.13.09 — Operational Action Authority
   Converts verified graph intelligence into reviewable actions. Never writes inferred actions silently. */
(function(){'use strict';
if(window.__CAVYRE_ACTION_AUTHORITY_161309__)return;window.__CAVYRE_ACTION_AUTHORITY_161309__=1;
var RELEASE='16.13.09';
function arr(v){return Array.isArray(v)?v:[]}
function active(v){return !/completed|cancelled|canceled|closed|released|declined|archived/i.test(String(v||''))}
function graph(){var W=window.CAVYRE_MODEL_WEB,d=W&&W.current&&W.current();return d&&d.graph||{}}
function relationships(){return window.CAVYRE_RELATIONSHIPS&&CAVYRE_RELATIONSHIPS.current?CAVYRE_RELATIONSHIPS.current():null}
function org(){return (window.VEUX_AGENT_V4&&(VEUX_AGENT_V4.orgSlug||(VEUX_AGENT_V4.state&&VEUX_AGENT_V4.state.org&&VEUX_AGENT_V4.state.org.slug)))||'maison-de-veux'}
function api(path,opt){if(!window.VEUX_AGENT_V4||typeof VEUX_AGENT_V4.api!=='function')return Promise.reject(new Error('Agent bridge is not ready'));return VEUX_AGENT_V4.api(path,opt||{})}
function key(a){return [a.kind,a.model_id,a.resource_type,a.resource_id].join(':')}
function taskFingerprint(t){return String((t.title||'')+' '+(t.description||'')+' '+(t.category||'')).toLowerCase()}
function proposals(){
 var r=relationships(),g=graph(),m=g.model||{},id=m.id||(r&&r.model_id)||null,open=arr(g.tasks).filter(function(x){return active(x.status)}),out=[];
 if(!r||!id)return out;
 function add(a){a.model_id=id;a.release=RELEASE;a.requires_approval=true;a.write_target='tasks';var needle=String(a.match||a.title||'').toLowerCase();a.already_tracked=open.some(function(t){return needle&&taskFingerprint(t).indexOf(needle)>=0});a.action_key=key(a);if(!a.already_tracked)out.push(a)}
 arr(r.conflicts).forEach(function(c,i){add({kind:'resolve_conflict',resource_type:c.type||'operational_conflict',resource_id:c.booking_id||c.casting_id||c.travel_id||c.availability_id||('conflict-'+i),title:'Resolve '+String(c.type||'operational')+' conflict',description:c.message||'Review operational conflict.',priority:c.severity==='high'?'urgent':'high',category:'Operational Conflict',match:c.message||c.type})});
 if(r.visa&&r.visa.attention)add({kind:'visa_attention',resource_type:'visa',resource_id:(arr(r.visa.cases)[0]||{}).id||'pending',title:'Resolve visa readiness for '+(m.display_name||'model'),description:'Visa/work authorization requires agent attention before market readiness can be considered clear.',priority:'urgent',category:'Visa / Compliance',match:'visa readiness'});
 if(r.availability&&r.availability.available_now===false)add({kind:'availability_attention',resource_type:'availability',resource_id:(arr(r.availability.blocks)[0]||{}).id||'blocked',title:'Review availability block for '+(m.display_name||'model'),description:'Model is currently blocked or unavailable. Review before casting or booking activity continues.',priority:'high',category:'Availability',match:'availability block'});
 return out;
}
function timelineWithTasks(){var r=relationships(),g=graph(),line=arr(r&&r.timeline).slice();arr(g.tasks).filter(function(x){return active(x.status)}).forEach(function(t){line.push({kind:'task',id:t.id,starts_at:t.due_at||t.created_at,title:t.title||'Task',status:t.status,priority:t.priority,source:'tasks'})});line.sort(function(a,b){return (Date.parse(a.starts_at||'')||9e15)-(Date.parse(b.starts_at||'')||9e15)});return line}
function snapshot(){var r=relationships(),g=graph(),open=arr(g.tasks).filter(function(x){return active(x.status)}),p=proposals();return{release:RELEASE,model_id:r&&r.model_id||null,readiness:r&&r.readiness||null,movement:r&&r.movement||null,visa:r&&r.visa||null,availability:r&&r.availability||null,conflicts:arr(r&&r.conflicts),tasks:{open:open,urgent:open.filter(function(x){return /urgent|critical/i.test(String(x.priority||''))}),overdue:open.filter(function(x){return x.due_at&&Date.parse(x.due_at)<Date.now()})},timeline:timelineWithTasks(),proposed_actions:p,attention_count:arr(r&&r.conflicts).length+p.length+open.filter(function(x){return /urgent|critical/i.test(String(x.priority||''))}).length}}
async function approve(action){
 if(!action||action.requires_approval!==true)throw new Error('This action is not eligible for approval.');
 var msg='Create this verified CAVYRE task?\n\n'+action.title+'\n'+(action.description||'');if(!window.confirm(msg))return{cancelled:true};
 var body={organization_slug:org(),action:'create_task',title:action.title,description:[action.description,'CAVYRE source: '+action.resource_type+' · '+action.resource_id,'Action authority: '+RELEASE].filter(Boolean).join('\n'),priority:action.priority||'normal',due_at:action.due_at||null,category:action.category||'CAVYRE Operations',model_id:action.model_id||null,member_ids:[]};
 var res=await api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!res||res.verified!==true)throw new Error('CAVYRE did not verify the task write.');
 window.dispatchEvent(new CustomEvent('cavyre:approved-action-complete',{detail:{action:action,result:res}}));return res;
}
function publish(){var s=snapshot();window.__CAVYRE_OPERATIONAL_ACTIONS__=s;window.dispatchEvent(new CustomEvent('cavyre:operational-actions-ready',{detail:s}));return s}
window.CAVYRE_OPERATIONAL_ACTIONS={release:RELEASE,current:function(){return window.__CAVYRE_OPERATIONAL_ACTIONS__||publish()},refresh:publish,proposals:proposals,approve:approve,snapshot:snapshot};
['cavyre:relationships-ready','cavyre:model-web-ready','cavyre:approved-action-complete'].forEach(function(n){window.addEventListener(n,function(){setTimeout(publish,20)})});
window.addEventListener('cavyre:model-web-invalidated',function(){window.__CAVYRE_OPERATIONAL_ACTIONS__=null});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(publish,500)},{once:true});else setTimeout(publish,500);
document.documentElement.setAttribute('data-cavyre-action-authority',RELEASE);
})();
