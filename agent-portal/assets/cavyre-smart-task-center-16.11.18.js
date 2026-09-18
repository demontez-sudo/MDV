(function(){
'use strict';
if(window.__CAVYRE_SMART_TASK_CENTER_161118__)return;
window.__CAVYRE_SMART_TASK_CENTER_161118__=1;

var state={mode:'smart',expanded:false};
function I(e,p,v){if(e)e.style.setProperty(p,v,'important')}
function txt(e){return String(e&&e.textContent||'').trim()}
function rows(root){return Array.from(root.querySelectorAll('.v148-main .v148-row'))}
function head(root){return root.querySelector('.v148-main .v148-table-head')}
function statusOf(r){
 var s=txt(r).toLowerCase();
 if(/\bcompleted\b|\bdone\b/.test(s))return'completed';
 if(/\bin progress\b|\bin_progress\b/.test(s))return'in_progress';
 if(/\burgent\b|\bcritical\b/.test(s))return'urgent';
 if(/\boverdue\b/.test(s))return'overdue';
 return'open';
}
function dueText(r){
 var cells=r.querySelectorAll(':scope > span');
 return cells[4]?txt(cells[4]):'';
}
function parseDue(v){
 var d=new Date(v);
 return isNaN(d)?null:d;
}
function priorityScore(r){
 var s=txt(r).toLowerCase(),score=0;
 if(/\bcritical\b/.test(s))score+=100;
 if(/\burgent\b/.test(s))score+=80;
 if(/\bin progress\b|\bin_progress\b/.test(s))score+=60;
 var d=parseDue(dueText(r));
 if(d){
   var diff=(d-Date.now())/86400000;
   if(diff<0)score+=90;
   else if(diff<=1)score+=50;
   else if(diff<=3)score+=30;
 }
 if(/\bcompleted\b|\bdone\b/.test(s))score-=200;
 return score;
}
function classify(r){
 var s=txt(r).toLowerCase();
 if(/\bcompleted\b|\bdone\b/.test(s))return'completed';
 if(/\bin progress\b|\bin_progress\b/.test(s))return'in_progress';
 if(/\burgent\b|\bcritical\b/.test(s))return'priority';
 var d=parseDue(dueText(r));
 if(d){
   var diff=(d-Date.now())/86400000;
   if(diff<0)return'overdue';
   if(diff<=3)return'due_soon';
 }
 return'open';
}
function buildCenter(root){
 if(root.querySelector('.vx161118-task-center-head'))return;
 var main=root.querySelector('.v148-task-layout');
 if(!main)return;

 var all=rows(root);
 var counts={
   priority:all.filter(function(r){return ['priority','overdue'].includes(classify(r))}).length,
   due:all.filter(function(r){return ['due_soon','overdue'].includes(classify(r))}).length,
   progress:all.filter(function(r){return classify(r)==='in_progress'}).length,
   completed:all.filter(function(r){return classify(r)==='completed'}).length
 };

 var c=document.createElement('section');
 c.className='vx161118-task-center-head';
 c.innerHTML=
 '<div class="vx161118-task-center-title"><small>VERA · SMART TASK CENTER</small><h2>Agency Task Command</h2><p>Priority work first. Completed and lower-signal tasks stay out of the active queue until you need them.</p></div>'+
 '<div class="vx161118-task-metrics">'+
   '<button data-task-mode="smart" class="on"><b>'+counts.priority+'</b><span>Priority</span><small>Urgent + overdue</small></button>'+
   '<button data-task-mode="due"><b>'+counts.due+'</b><span>Due Soon</span><small>Next 3 days</small></button>'+
   '<button data-task-mode="progress"><b>'+counts.progress+'</b><span>In Progress</span><small>Being worked</small></button>'+
   '<button data-task-mode="completed"><b>'+counts.completed+'</b><span>Completed</span><small>Archive view</small></button>'+
 '</div>'+
 '<div class="vx161118-task-toolbar">'+
   '<span class="vx161118-task-status">Showing smart queue</span>'+
   '<button type="button" class="vx161118-expand">VIEW ALL TASKS</button>'+
 '</div>';
 main.parentNode.insertBefore(c,main);

 c.querySelectorAll('[data-task-mode]').forEach(function(b){
   b.addEventListener('click',function(){
     state.mode=b.getAttribute('data-task-mode')||'smart';
     state.expanded=false;
     c.querySelectorAll('[data-task-mode]').forEach(function(x){x.classList.toggle('on',x===b)});
     apply(root);
   });
 });
 c.querySelector('.vx161118-expand').addEventListener('click',function(){
   state.expanded=!state.expanded;
   apply(root);
 });
}
function apply(root){
 var all=rows(root);
 if(!all.length)return;
 all.forEach(function(r){r.dataset.taskClass=classify(r)});

 var sorted=all.slice().sort(function(a,b){return priorityScore(b)-priorityScore(a)});
 var parent=all[0].parentNode;
 sorted.forEach(function(r){parent.appendChild(r)});

 var match=function(r){
   var c=r.dataset.taskClass;
   if(state.mode==='completed')return c==='completed';
   if(state.mode==='progress')return c==='in_progress';
   if(state.mode==='due')return c==='due_soon'||c==='overdue';
   if(state.mode==='smart')return c!=='completed';
   return true;
 };
 var pool=sorted.filter(match);
 var limit=state.expanded?pool.length:(state.mode==='completed'?8:10);
 pool.forEach(function(r,i){r.style.display=i<limit?'grid':'none'});
 sorted.filter(function(r){return !match(r)}).forEach(function(r){r.style.display='none'});

 var center=root.querySelector('.vx161118-task-center-head');
 if(center){
   var shown=Math.min(pool.length,limit);
   var label=center.querySelector('.vx161118-task-status');
   if(label)label.textContent=(state.mode==='smart'?'Smart queue':state.mode.replace('_',' '))+' · '+shown+' of '+pool.length;
   var ex=center.querySelector('.vx161118-expand');
   if(ex){
     ex.style.display=pool.length>limit||state.expanded?'inline-flex':'none';
     ex.textContent=state.expanded?'SHOW LESS':'VIEW ALL '+pool.length;
   }
 }
}
function bind(){
 var root=document.getElementById('p-tasksconsolidated')||document.getElementById('p-tasks');
 if(!root)return;
 root.classList.add('vx161118-smart-task-center');
 buildCenter(root);
 apply(root);

 
 
}
var q=0;function schedule(){if(q)return;q=1;requestAnimationFrame(function(){q=0;bind()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
})();