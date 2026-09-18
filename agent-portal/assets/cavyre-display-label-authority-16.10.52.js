/* CAVYRE 16.10.52 — Display Label Authority */
(function(){
'use strict';
if(window.__CAVYRE_DISPLAY_LABEL_AUTHORITY_161052__)return;
window.__CAVYRE_DISPLAY_LABEL_AUTHORITY_161052__=true;

var EXACT={
 'pr':'PR','ny':'NY','nyc':'NYC','nyfw':'NYFW','pfw':'PFW','pdf':'PDF','url':'URL',
 'api':'API','ai':'AI','crm':'CRM','mfa':'MFA','vip':'VIP','usd':'USD','eur':'EUR','gbp':'GBP',
 'id':'ID','dob':'DOB','vat':'VAT','b2b':'B2B',
 'casting_office':'Casting Office','creative_agency':'Creative Agency','mother_agency':'Mother Agency',
 'new_face':'New Face','in_progress':'In Progress','not_started':'Not Started','go_see':'Go See',
 'go_and_see':'Go & See','work_authorization':'Work Authorization','model_portal':'Model Portal',
 'mother_agency_portal':'Mother Agency Portal','model_access':'Model Access','agent_portal':'Agent Portal',
 'book_out':'Book Out','bookout':'Bookout','call_sheet':'Call Sheet','comp_card':'Comp Card',
 'test_requested':'Test Requested','contract_sent':'Contract Sent','meeting_scheduled':'Meeting Scheduled',
 'new_lead':'New Lead','casting_pipeline':'Casting Pipeline','relationship_intelligence':'Relationship Intelligence'
};

function label(value){
 var raw=String(value==null?'':value).trim();
 if(!raw)return raw;
 var key=raw.toLowerCase();
 if(EXACT[key])return EXACT[key];

 // Do not rewrite sentences, dates, currency amounts, emails or user-entered content.
 if(raw.length>42||/[.!?]$/.test(raw)||/@/.test(raw)||/^https?:/i.test(raw)||/^\$|^\€|^\£/.test(raw))return raw;
 if(/[A-Z]/.test(raw)&&!/_/.test(raw))return raw;

 return raw.replace(/[_-]+/g,' ').replace(/\s+/g,' ').split(' ').map(function(w,i){
   var low=w.toLowerCase();
   if(EXACT[low])return EXACT[low];
   if(i>0&&/^(and|or|of|to|for|in|on|at|by|with|from)$/i.test(w))return low;
   return low.charAt(0).toUpperCase()+low.slice(1);
 }).join(' ');
}

function machineish(t){
 t=String(t||'').trim();
 if(!t||t.length>42)return false;
 if(EXACT[t.toLowerCase()])return true;
 if(/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(t))return true;
 if(/^[a-z][a-z0-9]{1,24}$/.test(t))return true;
 return false;
}

var CONTROL_SELECTORS=[
 'option',
 '.vx-select-value','.vx-select-option span','.vx-select-group',
 '[role="option"]','[role="tab"]','[role="menuitem"]',
 '.tab','.tabs button','[class*="tabs"] button',
 '.seg button','[class*="segment"] button','[class*="segmented"] button',
 '.filter-chip','[class*="filter"] button','[class*="filter"] .chip',
 '[class*="slider"] button','[class*="switch"] span',
 '.pill','.badge[data-value]'
].join(',');

function normalizeElement(el){
 if(!el||el.nodeType!==1)return;
 if(el.matches('input,textarea,[contenteditable="true"]'))return;
 if(el.matches('option')){
   var raw=el.textContent.trim();
   if(machineish(raw)){
     if(!el.dataset.cavyreRawLabel)el.dataset.cavyreRawLabel=raw;
     el.textContent=label(raw);
   }
   return;
 }
 // Only rewrite leaf controls, never containers with mixed content.
 if(el.children.length===0){
   var t=el.textContent.trim();
   if(machineish(t)){
     if(!el.dataset.cavyreRawLabel)el.dataset.cavyreRawLabel=t;
     el.textContent=label(t);
   }
 }
}

function scan(root){
 root=root||document;
 if(root.nodeType===1&&root.matches&&root.matches(CONTROL_SELECTORS))normalizeElement(root);
 if(root.querySelectorAll)root.querySelectorAll(CONTROL_SELECTORS).forEach(normalizeElement);
}

window.CAVYRE_DISPLAY_LABEL=label;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scan(document)},{once:true});
else scan(document);

new MutationObserver(function(rows){
 var roots=[];
 rows.forEach(function(m){
   if(m.type==='childList')m.addedNodes.forEach(function(n){if(n.nodeType===1)roots.push(n)});
   else if(m.type==='characterData'&&m.target.parentElement)roots.push(m.target.parentElement);
 });
 if(!roots.length)return;
 clearTimeout(scan._t);
 scan._t=setTimeout(function(){roots.forEach(scan)},24);
}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});

document.addEventListener('change',function(e){
 if(e.target&&e.target.tagName==='SELECT')setTimeout(function(){scan(e.target.parentElement||document)},0);
},true);

console.info('[CAVYRE] Display Label Authority 16.10.52 loaded');
})();