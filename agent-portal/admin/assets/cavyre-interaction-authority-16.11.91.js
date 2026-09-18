/* CAVYRE 16.11.91 — Vera Interaction Authority */
(function(){
'use strict';
if(window.__CAVYRE_INTERACTION_AUTHORITY_161191__)return;
window.__CAVYRE_INTERACTION_AUTHORITY_161191__=1;
function closest(t,s){try{return t&&t.closest?t.closest(s):null}catch(e){return null}}
function vera(){return window.CAVYRE_VERA_SMART||null}
var ROUTE_ALIAS={
 communication:'inbox',
 travel:'globalmobility',
 globalmobility:'globalmobility',
 visa:'visa',
 financelegal:'agentcommissions',
 finance:'agentcommissions',
 relationships:'industrydirectory',
 talent:'roster',
 casting:'calendar',
 castings:'calendar'
};
function route(page){return ROUTE_ALIAS[page]||page}
function go(page){
  page=route(page); if(!page)return false;
  try{if(typeof window.navTo==='function'){window.navTo(page);return true}}catch(e){console.warn('[CAVYRE 16.11.91] navTo failed',page,e)}
  try{var nativeBtn=document.querySelector('#vx81-nav-flyout [data-page="'+page+'"],#vx73-rail [data-page="'+page+'"],[data-page="'+page+'"]');if(nativeBtn){nativeBtn.click();return true}}catch(e){}
  try{if(typeof window.rerender==='function'){window._currentPage=page;var panel=document.getElementById('p-'+page);document.querySelectorAll('#pm .panel,.panel').forEach(function(x){if(x!==panel)x.classList.remove('on')});if(panel)panel.classList.add('on');window.rerender(page);return true}}catch(e){}
  return false;
}
function ask(text){var v=vera();if(v&&typeof v.ask==='function'){v.ask(text||'');return true}var open=document.getElementById('_asst-btn');if(open)open.click();setTimeout(function(){var i=document.getElementById('_asst-input'),s=document.getElementById('_asst-send');if(i&&s){i.value=text||'';if(text)s.click()}},100);return !!open}
function openVera(){var b=document.getElementById('_asst-btn');if(b){b.click();return true}return false}
document.addEventListener('click',function(e){
  var b=closest(e.target,'[data-vx17-nav]');if(b){e.preventDefault();go(b.getAttribute('data-vx17-nav'));return}
  b=closest(e.target,'.vx17-command button,.vx17-context button');if(b){
    var label=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    var fallback=null;
    if(label.indexOf('smart calendar')>=0||label.indexOf('calendar')>=0)fallback='calendar';
    else if(label.indexOf('travel')>=0)fallback='globalmobility';
    else if(label.indexOf('visa')>=0)fallback='visa';
    else if(label.indexOf('finance')>=0||label.indexOf('collection')>=0)fallback='agentcommissions';
    else if(label.indexOf('relationship')>=0)fallback='industrydirectory';
    else if(label.indexOf('task')>=0)fallback='tasks';
    if(fallback){e.preventDefault();go(fallback);return}
  }
  b=closest(e.target,'[data-vx17-vera],[data-vx17-context-vera]');if(b){e.preventDefault();openVera();return}
  b=closest(e.target,'.vera81-mode[data-mode]');if(b){e.preventDefault();var v=vera();if(v&&typeof v.setMode==='function')v.setMode(b.getAttribute('data-mode'));return}

  b=closest(e.target,'[data-vx17-mode]');if(b){
    e.preventDefault();
    try{
      var mode=b.getAttribute('data-vx17-mode');
      var siblings=b.parentElement&&b.parentElement.querySelectorAll('[data-vx17-mode]');
      if(siblings)siblings.forEach(function(x){x.classList.toggle('on',x===b)});
      if(typeof window.renderOverview==='function'){
        var host=document.getElementById('p-overview');
        window.__CAVYRE_AGENCY_COMMAND_MODE__=mode;
        b.dispatchEvent(new CustomEvent('cavyre:agency-command-mode',{bubbles:true,detail:{mode:mode}}));
        window.renderOverview(host);
      }
    }catch(err){console.warn('[CAVYRE 16.11.91] mode switch failed',err)}
    return;
  }

  b=closest(e.target,'[data-vx17-context-refresh]');if(b){
    e.preventDefault();
    try{
      var page=window._currentPage||'overview';
      if(window.VEUX_PERF&&VEUX_PERF.invalidate)VEUX_PERF.invalidate(page);
      if(typeof window.rerender==='function')window.rerender(page);
    }catch(err){console.warn('[CAVYRE 16.11.91] context refresh failed',err)}
    return;
  }

  b=closest(e.target,'.vera81-rail [data-nav]');if(b){e.preventDefault();go(b.getAttribute('data-nav'));return}
  b=closest(e.target,'[data-vera-run-desk]');if(b){e.preventDefault();var v2=vera();if(v2&&typeof v2.runDesk==='function')v2.runDesk();else ask('Run my desk. Prioritize what needs action today and build an ordered plan.');return}
  b=closest(e.target,'.vera81-rail [data-v81]');if(b){var action=b.getAttribute('data-v81'),v3=vera();if(action==='research'){e.preventDefault();ask('Vera, research the active person or company using live public sources and show me the sources.');return}if(action==='execute'&&v3&&v3.state&&v3.state.pending&&typeof v3.execute==='function'){e.preventDefault();v3.execute(v3.state.pending);return}if(action==='dismiss'&&v3&&typeof v3.setPending==='function'){e.preventDefault();v3.setPending(null);return}}
},false);
window.CAVYRE_INTERACTION_AUTHORITY={release:'16.11.91',navigate:go,ask:ask,openVera:openVera};
document.documentElement.setAttribute('data-cavyre-interaction-authority','16.11.91');
})();