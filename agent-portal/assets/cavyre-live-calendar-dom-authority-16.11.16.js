(function(){
'use strict';
if(window.__CAVYRE_LIVE_CALENDAR_DOM_161116__)return;
window.__CAVYRE_LIVE_CALENDAR_DOM_161116__=1;

function I(el,p,v){ if(el) el.style.setProperty(p,v,'important'); }

function month(){
  document.querySelectorAll('#p-calendar .vx85-season').forEach(function(root){
    var controls=root.querySelector('.vx85-models');
    var matrix=root.querySelector('.vx85-matrix');
    var intel=root.querySelector('.vx85-day-intel, .vx98-month-event-intel, .vx89-event-intel');
    if(!controls || !matrix) return;

    root.classList.add('vx161116-month-live');
    controls.classList.add('vx161116-month-controls-live');
    matrix.classList.add('vx161116-month-matrix-live');
    if(intel) intel.classList.add('vx161116-month-intel-live');

    // Physically reorder children so layout order cannot be reinterpreted by older CSS.
    if(root.firstElementChild!==controls) root.insertBefore(controls,root.firstElementChild);
    if(controls.nextElementSibling!==matrix) root.insertBefore(matrix,controls.nextSibling);
    if(intel && matrix.nextElementSibling!==intel) root.insertBefore(intel,matrix.nextSibling);

    // Root: one column, three rows. No right-side overlay.
    I(root,'display','grid');
    I(root,'grid-template-columns','minmax(0,1fr)');
    I(root,'grid-template-rows','auto auto auto');
    I(root,'width','100%');
    I(root,'max-width','100%');
    I(root,'min-width','0');
    I(root,'height','auto');
    I(root,'overflow','visible');
    I(root,'position','relative');

    // Controls: top horizontal deck.
    I(controls,'grid-column','1');
    I(controls,'grid-row','1');
    I(controls,'width','100%');
    I(controls,'min-width','0');
    I(controls,'max-width','100%');
    I(controls,'height','auto');
    I(controls,'max-height','none');
    I(controls,'border-right','0');
    I(controls,'border-bottom','1px solid rgba(206,164,76,.2)');
    I(controls,'padding','12px 16px');
    I(controls,'display','grid');
    I(controls,'grid-template-columns','220px 170px minmax(0,1fr)');
    I(controls,'grid-template-rows','38px 34px');
    I(controls,'gap','8px 12px');
    I(controls,'align-items','center');
    I(controls,'overflow','visible');

    var ch=controls.querySelector(':scope > header');
    var all=controls.querySelector(':scope > .vx85-all');
    var list=controls.querySelector(':scope > .vx85-model-list');
    var more=controls.querySelector(':scope > .vx85-more');
    var filters=controls.querySelector(':scope > .vx85-filters');
    if(ch){I(ch,'grid-column','1');I(ch,'grid-row','1 / span 2');I(ch,'min-width','0')}
    if(all){I(all,'grid-column','2');I(all,'grid-row','1');I(all,'width','100%');I(all,'height','38px');I(all,'margin','0')}
    if(list){
      I(list,'grid-column','3');I(list,'grid-row','1');I(list,'display','flex');
      I(list,'align-items','center');I(list,'gap','6px');I(list,'min-width','0');
      I(list,'overflow-x','auto');I(list,'overflow-y','hidden');I(list,'padding','0');
      list.querySelectorAll(':scope > button').forEach(function(b){
        I(b,'flex','0 0 auto');I(b,'width','auto');I(b,'min-width','118px');
        I(b,'height','38px');I(b,'padding','4px 7px');
      });
    }
    if(more){I(more,'grid-column','2');I(more,'grid-row','2');I(more,'height','30px');I(more,'margin','0')}
    if(filters){
      I(filters,'grid-column','3');I(filters,'grid-row','2');I(filters,'display','flex');
      I(filters,'align-items','center');I(filters,'gap','6px');I(filters,'min-width','0');
      I(filters,'margin','0');I(filters,'padding','0');I(filters,'overflow-x','auto');I(filters,'overflow-y','hidden');
      filters.querySelectorAll(':scope > label').forEach(function(l){
        I(l,'flex','0 0 auto');I(l,'min-height','30px');I(l,'white-space','nowrap');
      });
    }

    // Matrix: full width. Seven equal columns guaranteed.
    I(matrix,'grid-column','1');
    I(matrix,'grid-row','2');
    I(matrix,'width','100%');
    I(matrix,'min-width','0');
    I(matrix,'max-width','100%');
    I(matrix,'overflow','hidden');
    var dow=matrix.querySelector(':scope > .vx85-dow');
    var grid=matrix.querySelector(':scope > .vx85-grid');
    [dow,grid].forEach(function(g){
      if(!g)return;
      I(g,'display','grid');
      I(g,'grid-template-columns','repeat(7,minmax(0,1fr))');
      I(g,'width','100%');
      I(g,'min-width','0');
      I(g,'max-width','100%');
    });
    if(grid){
      grid.querySelectorAll(':scope > button').forEach(function(c){
        I(c,'display','block');
        I(c,'visibility','visible');
        I(c,'opacity','1');
        I(c,'min-width','0');
        I(c,'width','auto');
        I(c,'max-width','none');
        I(c,'overflow','hidden');
      });
    }

    // Intelligence: always below matrix.
    if(intel){
      I(intel,'grid-column','1');
      I(intel,'grid-row','3');
      I(intel,'position','relative');
      I(intel,'left','auto');I(intel,'right','auto');I(intel,'top','auto');I(intel,'bottom','auto');
      I(intel,'width','100%');I(intel,'min-width','0');I(intel,'max-width','none');
      I(intel,'height','auto');I(intel,'max-height','none');
      I(intel,'overflow','visible');
      I(intel,'border-left','0');
      I(intel,'border-top','1px solid rgba(206,164,76,.2)');
    }
  });
}

function week(){
  document.querySelectorAll('#p-calendar .vx89-flow-dashboard').forEach(function(root){
    root.classList.add('vx161116-week-live');
    var overview=root.querySelector(':scope > .vx89-flow-overview');
    var board=root.querySelector(':scope > .vx89-flow-board');
    var intel=root.querySelector(':scope > .vx89-flow-intel, :scope > .vx89-event-intel');
    I(root,'display','grid');
    I(root,'grid-template-columns','minmax(0,1fr) 300px');
    I(root,'grid-template-rows','auto auto');
    I(root,'width','100%');I(root,'min-width','0');

    if(overview){
      I(overview,'grid-column','1 / -1');I(overview,'grid-row','1');
      I(overview,'display','grid');I(overview,'grid-template-columns','190px minmax(420px,1fr) 300px');
      I(overview,'gap','14px');I(overview,'padding','14px 16px');I(overview,'border-right','0');
      // Hide redundant long breakdown section.
      overview.querySelectorAll(':scope > section').forEach(function(sec){
        if(!sec.classList.contains('vx161112-market')) I(sec,'display','none');
      });
    }
    if(board){I(board,'grid-column','1');I(board,'grid-row','2');I(board,'min-width','0');I(board,'overflow','hidden')}
    var cols=root.querySelector('.vx89-flow-columns');
    if(cols){
      I(cols,'display','grid');I(cols,'grid-template-columns','repeat(7,minmax(0,1fr))');
      I(cols,'width','100%');I(cols,'min-width','0');I(cols,'max-width','100%');I(cols,'overflow','hidden');
    }
    if(intel){
      I(intel,'grid-column','2');I(intel,'grid-row','2');
      I(intel,'width','300px');I(intel,'min-width','300px');I(intel,'max-width','300px');
    }
  });
}

function industry(){
  document.querySelectorAll('#p-calendar .vx1044-agency-intel').forEach(function(p){
    p.classList.add('vx161116-industry-live');
    var kpis=p.querySelector('.vx1044-kpis');
    var stages=p.querySelector('.vx1044-stages');
    var bottom=p.querySelector('.vx1044-bottom');
    var rules=p.querySelector('.vx1044-rules');
    var actions=p.querySelector('.vx1044-actions');

    I(p,'width','100%');I(p,'min-width','0');I(p,'max-width','100%');I(p,'overflow','hidden');

    if(kpis){
      I(kpis,'display','grid');I(kpis,'grid-template-columns','repeat(4,minmax(0,1fr))');
      I(kpis,'gap','8px');I(kpis,'padding','12px 16px');
    }
    if(stages){
      I(stages,'display','grid');I(stages,'grid-template-columns','repeat(6,minmax(0,1fr))');
      I(stages,'gap','8px');I(stages,'overflow','visible');
      stages.querySelectorAll(':scope > .vx1044-stage').forEach(function(s){
        I(s,'min-width','0');I(s,'min-height','86px');I(s,'height','auto');I(s,'padding','11px');
        var sm=s.querySelector('small');if(sm){I(sm,'white-space','normal');I(sm,'overflow-wrap','anywhere');I(sm,'line-height','1.35')}
      });
    }
    if(bottom){
      I(bottom,'display','grid');I(bottom,'grid-template-columns','minmax(0,1.3fr) minmax(320px,.7fr)');
    }
    if(actions){I(actions,'min-width','0');I(actions,'padding','15px 16px')}
    if(rules){
      I(rules,'min-width','0');I(rules,'padding','15px 16px');
      rules.querySelectorAll('.vx1044-rule').forEach(function(r){
        I(r,'font-size','9.5px');I(r,'line-height','1.45');I(r,'letter-spacing','.02em');I(r,'text-transform','none');
        var span=r.querySelector('span');if(span){I(span,'white-space','normal');I(span,'overflow-wrap','anywhere')}
      });
    }
  });
}

function command(){
  document.querySelectorAll('#p-calendar .vx75-control').forEach(function(c){
    c.classList.add('vx161116-calendar-command-live');
    I(c,'min-height','76px');I(c,'padding','12px 18px');
    I(c,'display','grid');I(c,'grid-template-columns','minmax(230px,.75fr) auto auto auto');
    I(c,'align-items','center');I(c,'gap','12px');
    var tabs=c.querySelector('.vx75-tabs');
    if(tabs){
      I(tabs,'display','flex');I(tabs,'align-items','center');I(tabs,'gap','0');
      I(tabs,'overflow','hidden');
      tabs.querySelectorAll('button').forEach(function(b){
        I(b,'min-width','58px');I(b,'height','38px');I(b,'padding','0 12px');
      });
    }
  });
}

function responsive(){
  var w=window.innerWidth;
  if(w<=1180){
    document.querySelectorAll('#p-calendar .vx89-flow-dashboard').forEach(function(root){
      I(root,'grid-template-columns','1fr');
      var intel=root.querySelector(':scope > .vx89-flow-intel, :scope > .vx89-event-intel');
      if(intel){I(intel,'grid-column','1');I(intel,'grid-row','3');I(intel,'width','100%');I(intel,'min-width','0');I(intel,'max-width','none')}
    });
    document.querySelectorAll('#p-calendar .vx1044-bottom').forEach(function(b){I(b,'grid-template-columns','1fr')});
  }
  if(w<=760){
    document.querySelectorAll('#p-calendar .vx85-models').forEach(function(c){
      I(c,'display','flex');I(c,'flex-wrap','wrap');I(c,'grid-template-columns','none');I(c,'grid-template-rows','none');
    });
    document.querySelectorAll('#p-calendar .vx85-matrix').forEach(function(m){I(m,'overflow-x','auto')});
    document.querySelectorAll('#p-calendar .vx85-dow,#p-calendar .vx85-grid').forEach(function(g){I(g,'min-width','700px')});
  }
}

function run(){
  month(); week(); industry(); command(); responsive();
  
  
}

var q=0;
function schedule(){if(q)return;q=1;requestAnimationFrame(function(){q=0;run()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('veux:shell-ready',schedule);
window.addEventListener('veux:v16.9.75-ready',schedule);
})();