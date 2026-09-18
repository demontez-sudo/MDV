(function(){
'use strict';
if(window.__CAVYRE_TASK_COMMAND_161117__)return;
window.__CAVYRE_TASK_COMMAND_161117__=1;
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function toast(m){try{if(window.toast)return window.toast(m);if(window.say)return window.say(m)}catch(e){}}
function bridge(){return window.VEUX_AGENT_V4}
function org(){try{return bridge().state.org.slug||'maison-de-veux'}catch(e){return'maison-de-veux'}}
async function status(id,status,btn){
 if(!id||!status)return;
 if(btn){btn.disabled=true;btn.dataset.old=btn.textContent;btn.textContent='UPDATING…'}
 try{
   var r=await bridge().api('/api/agent/tasks/v11',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organization_slug:org(),action:'task_status',task_id:id,status:status})});
   toast(status==='completed'?'Task completed':'Task updated');
   try{
     if(window.VEUX_V148){window.VEUX_V148.task=null}
     var p=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
     if(window.renderTasksConsolidated&&p)window.renderTasksConsolidated(p);
   }catch(e){location.reload()}
 }catch(e){
   console.error('[CAVYRE TASK 16.11.17]',e);
   toast((e&&e.message)||'Unable to update task');
   if(btn){btn.disabled=false;btn.textContent=btn.dataset.old||'TRY AGAIN'}
 }
}
window.CAVYRE_TASKS_161117={status:status};

function bind(){
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
 if(!root)return;
 root.classList.add('vx161117-task-command');
 var detail=root.querySelector('.v148-task-detail');
 var layout=root.querySelector('.v148-task-layout');
 var main=root.querySelector('.v148-main');
 if(layout){I(layout,'display','grid');I(layout,'grid-template-columns','minmax(0,1fr) 360px');I(layout,'gap','14px');I(layout,'align-items','start')}
 if(main){I(main,'min-width','0');I(main,'overflow-x','auto')}
 if(detail){
   I(detail,'position','sticky');I(detail,'top','94px');I(detail,'width','100%');I(detail,'min-width','0');I(detail,'max-height','calc(100vh - 112px)');I(detail,'overflow-y','auto');
   var title=detail.querySelector('h2');if(title){I(title,'font-size','25px');I(title,'line-height','1.08');I(title,'overflow-wrap','anywhere')}
   var actions=detail.querySelector('.v148-actions-rail');
   if(actions){
     actions.querySelectorAll('button').forEach(function(b){
       var tx=(b.textContent||'').trim().toLowerCase();
       var m=b.getAttribute('onclick')||'';
       var id=(m.match(/taskStatus\('([^']+)'/)||[])[1];
       if(id&&(tx.indexOf('mark complete')>=0||tx.indexOf('mark in progress')>=0)){
         var st=tx.indexOf('complete')>=0?'completed':'in_progress';
         b.setAttribute('onclick',"CAVYRE_TASKS_161117.status('"+id+"','"+st+"',this)");
       }
       I(b,'min-height','42px');I(b,'height','auto');I(b,'white-space','normal');
     });
   }
 }
 root.querySelectorAll('.v148-row').forEach(function(r){I(r,'min-height','58px')});
 var head=root.querySelector('.v148-table-head');if(head){I(head,'position','sticky');I(head,'top','0');I(head,'z-index','2')}
}
var q=0;function schedule(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
})();