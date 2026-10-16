/* Maison de Veux 16.16 — Get Scouted application: easier typing.
   Right keyboard per field, tidy-ups as you type, Enter moves to the next field, gentle inline checks,
   a progress line, and a saved draft so nothing typed is lost if the page reloads. */
(function(){
'use strict';
var form=document.querySelector('form.scout-form');if(!form)return;
var KEY='mdv-get-scouted-draft-v1';

/* ---- keyboard + autofill hints per field ---- */
var HINT={
  first_name:{ac:'words'},last_name:{ac:'words'},city:{ac:'words'},state:{ac:'words'},country:{ac:'words'},address:{ac:'words'},
  email:{im:'email',ac:'none',sp:false},guardian_email:{im:'email',ac:'none',sp:false},
  phone:{im:'tel'},guardian_phone:{im:'tel'},
  instagram:{ac:'none',sp:false,ph:'@handle'},tiktok:{ac:'none',sp:false,ph:'@handle'},
  followers:{im:'numeric',ac:'none'},postal_code:{ac:'characters',sp:false},
  guardian_name:{ac:'words'},guardian_relationship:{ac:'words'},represented_agency:{ac:'words'},represented_notes:{ac:'sentences'},
  height:{im:'text',ac:'none',sp:false},inseam:{im:'decimal',ac:'none',sp:false},neck:{im:'decimal',ac:'none',sp:false},sleeve:{im:'decimal',ac:'none',sp:false},bust_chest:{im:'decimal',ac:'none',sp:false},waist:{im:'decimal',ac:'none',sp:false},hips:{im:'decimal',ac:'none',sp:false},
  shoe:{im:'text',ac:'none',sp:false},dress_suit:{im:'text',ac:'none',sp:false},cup:{ac:'characters',sp:false},
  story:{ac:'sentences',sp:true},goals:{ac:'sentences',sp:true}
};
var fields=[].slice.call(form.querySelectorAll('input,select,textarea')).filter(function(e){return e.name&&e.type!=='hidden'&&e.name!=='website';});
fields.forEach(function(e){
  var h=HINT[e.name];if(!h)return;
  if(h.im)e.setAttribute('inputmode',h.im);
  if(h.ac)e.setAttribute('autocapitalize',h.ac);
  if(h.sp===false){e.setAttribute('spellcheck','false');e.setAttribute('autocorrect','off');}
  if(h.sp===true)e.setAttribute('spellcheck','true');
  if(h.ph&&!e.placeholder)e.placeholder=h.ph;
  if(e.tagName==='INPUT'&&/^(text|email|tel)$/.test(e.type))e.setAttribute('enterkeyhint','next');
});
/* red-star the required marker */
form.querySelectorAll('.f-label').forEach(function(l){if(/\s\*\s*$/.test(l.textContent)&&!l.querySelector('.req')){l.innerHTML=l.innerHTML.replace(/\s\*\s*$/,'<span class="req">*</span>');}});

/* ---- tidy as you finish typing ---- */
function titleCase(v){return v.replace(/\S+/g,function(w){return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();});}
form.addEventListener('focusout',function(ev){
  var e=ev.target;if(!e||!e.name||e.tagName==='SELECT')return;
  var v=e.value;if(typeof v!=='string')return;var t=v.trim().replace(/\s{2,}/g,' ');
  if(/^(first_name|last_name|city|state|country|guardian_name)$/.test(e.name)&&t&&(t===t.toLowerCase()||t===t.toUpperCase()))t=titleCase(t);
  if(/^(instagram|tiktok)$/.test(e.name)&&t){t=t.replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i,'').replace(/[\/?].*$/,'').replace(/\s+/g,'');if(t&&t.charAt(0)!=='@')t='@'+t;}
  if(e.name==='followers'&&t){var n=Number(t.replace(/[,\s]/g,''));if(isFinite(n)&&/^[\d,\s.]+$/.test(t))t=n.toLocaleString('en-US');}
  if(e.name==='email'||e.name==='guardian_email')t=t.toLowerCase().replace(/\s+/g,'');
  if(e.name==='postal_code')t=t.toUpperCase();
  if(t!==v){e.value=t;}
  check(e);
},true);

/* ---- inline checks (kind, only after you leave a field) ---- */
function msgEl(e){var g=e.closest('.f-group')||e.parentNode;var m=g.querySelector('.sf-msg');if(!m){m=document.createElement('div');m.className='sf-msg';m.setAttribute('aria-live','polite');g.appendChild(m);}return m;}
function problem(e){
  if(e.type==='checkbox'||e.type==='radio'||e.type==='file')return '';
  var v=String(e.value||'').trim();
  if(e.required&&!v)return 'Please fill this in.';
  if(!v)return '';
  if(e.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))return 'That email address doesn’t look right.';
  if(e.type==='tel'&&v.replace(/\D/g,'').length<7)return 'Please add your full phone number.';
  if(e.name==='dob'){var d=new Date(v);if(isNaN(d)||d>new Date())return 'Please check your date of birth.';}
  return '';
}
function check(e){
  var p=problem(e),m=msgEl(e);
  e.classList.toggle('bad',!!p);e.classList.toggle('ok',!p&&!!String(e.value||'').trim()&&e.type!=='date'&&e.tagName!=='SELECT');
  m.textContent=p;if(p)e.setAttribute('aria-invalid','true');else e.removeAttribute('aria-invalid');
}
form.addEventListener('blur',function(ev){var e=ev.target;if(fields.indexOf(e)>-1)check(e);},true);
form.addEventListener('input',function(ev){var e=ev.target;if(e.classList&&e.classList.contains('bad'))check(e);progress();queueSave();},true);
form.addEventListener('change',function(ev){var e=ev.target;if(fields.indexOf(e)>-1&&e.tagName==='SELECT')check(e);progress();queueSave();},true);

/* ---- Enter moves on instead of submitting half a form ---- */
form.addEventListener('keydown',function(ev){
  var e=ev.target;if(ev.key!=='Enter'||ev.shiftKey||ev.isComposing)return;
  if(e.tagName!=='INPUT'||!/^(text|email|tel|date)$/.test(e.type))return;
  ev.preventDefault();
  var list=fields.filter(function(x){return x.type!=='checkbox'&&x.type!=='radio'&&x.type!=='file'&&!x.disabled&&x.offsetParent!==null;});
  var i=list.indexOf(e);var next=list[i+1];if(next)next.focus();else{e.blur();}
});

/* ---- progress line ---- */
var bar=document.createElement('div');bar.className='sf-progress';bar.innerHTML='<i></i>';document.body.appendChild(bar);
function progress(){
  var req=fields.filter(function(e){return e.required&&e.offsetParent!==null;});if(!req.length)return;
  var done=req.filter(function(e){return e.type==='checkbox'?e.checked:String(e.value||'').trim()!=='';}).length;
  bar.firstChild.style.width=Math.round(done/req.length*100)+'%';
}

/* ---- keep the draft so a reload or a crash never loses what was typed ---- */
var timer=0;
function snapshot(){var d={};fields.forEach(function(e){if(e.type==='file'||e.name==='website')return;if(e.type==='checkbox'||e.type==='radio'){if(e.checked){d[e.name]=d[e.name]||[];d[e.name].push(e.value);}}else if(e.value)d[e.name]=e.value;});return d;}
function queueSave(){clearTimeout(timer);timer=setTimeout(function(){try{var d=snapshot();if(Object.keys(d).length)localStorage.setItem(KEY,JSON.stringify({at:Date.now(),d:d}));}catch(e){}},700);}
function restore(){
  var raw;try{raw=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){raw=null;}
  if(!raw||!raw.d||Date.now()-raw.at>14*864e5||!Object.keys(raw.d).length)return;
  fields.forEach(function(e){
    var v=raw.d[e.name];if(v==null)return;
    if(e.type==='checkbox'||e.type==='radio'){e.checked=Array.isArray(v)&&v.indexOf(e.value)>-1;}
    else if(e.type!=='file'&&!e.value){e.value=v;}
  });
  ['dob','gender'].forEach(function(n){var e=form.elements[n];if(e&&e.value){try{e.dispatchEvent(new Event('change',{bubbles:true}));}catch(x){}}});
  var b=document.createElement('div');b.className='sf-restore';b.innerHTML='<span>We kept what you typed last time.</span><button type="button">Start fresh</button>';
  form.insertBefore(b,form.firstChild);
  b.querySelector('button').onclick=function(){try{localStorage.removeItem(KEY);}catch(e){}form.reset();fields.forEach(function(e){e.classList.remove('ok','bad');});b.remove();progress();};
}
/* once the application is sent, the draft is no longer needed */
var ok=document.querySelector('.scout-success');
if(ok)new MutationObserver(function(){if(ok.classList.contains('show')){try{localStorage.removeItem(KEY);}catch(e){}bar.firstChild.style.width='100%';}}).observe(ok,{attributes:true,attributeFilter:['class']});

setTimeout(function(){restore();progress();},60);
progress();
})();
