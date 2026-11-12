/* Roster export: a button on the Roster page that downloads every model and team member as a CSV.
   Data: /api/agent/roster-export?format=json (the CSV is built here so the secure session handles sign-in). */
(function(){
'use strict';
if(window.MDV_ROSTER_EXPORT)return;
var HEAD=['type','name','email','title','status','active','market','portal_login'];
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function cell(v){var s=v==null?'':String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function toCsv(rows){return [HEAD.join(',')].concat(rows.map(function(r){return HEAD.map(function(h){return cell(r[h]);}).join(',');})).join('\r\n');}
function toast(m){var d=document.createElement('div');d.textContent=m;d.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#14110d;color:#f4eee2;border:1px solid #b9975b;padding:10px 16px;font:12px system-ui;z-index:99999';document.body.appendChild(d);setTimeout(function(){d.remove();},3500);}
function download(){
  return bridge().api('/api/agent/roster-export?format=json&organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true}).then(function(r){
    var rows=(r.models||[]).concat(r.team||[]);
    var blob=new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='maison-de-veux-roster.csv';document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
    toast('Roster exported: '+(r.models||[]).length+' models, '+(r.team||[]).length+' team');
  }).catch(function(e){toast('Export failed: '+((e&&e.message)||e));});
}
function mount(){
  if(window._currentPage!=='roster')return;
  var host=document.getElementById('p-roster');if(!host||!host.classList.contains('on')||host.querySelector('[data-roster-export]'))return;
  var b=document.createElement('button');b.type='button';b.setAttribute('data-roster-export','1');b.textContent='Export roster (CSV)';
  b.style.cssText='position:absolute;top:14px;right:18px;z-index:5;background:transparent;color:inherit;border:1px solid currentColor;padding:7px 12px;font:600 10px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;opacity:.85';
  b.addEventListener('click',function(){b.disabled=true;download().then(function(){b.disabled=false;});});
  if(getComputedStyle(host).position==='static')host.style.position='relative';
  host.appendChild(b);
}
window.MDV_ROSTER_EXPORT={download:download,toCsv:toCsv};
setInterval(mount,1200);
})();
