/* Portal dialogs that look like the portal, replacing the browser's own confirm / prompt / alert boxes.
   MDV_DIALOG.confirm({title,message,confirm,cancel,danger})                    -> Promise<boolean>
   MDV_DIALOG.form({title,message,fields:[{k,label,type,placeholder,value,required}],confirm}) -> Promise<object|null>
   MDV_DIALOG.alert({title,message,tone})                                        -> Promise<void>              */
(function(){
'use strict';
if(window.MDV_DIALOG)return;
var css='.mdd-back{position:fixed;inset:0;z-index:2147483200;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:20px;animation:mddIn .15s ease}@keyframes mddIn{from{opacity:0}to{opacity:1}}'
+'.mdd-card{width:min(460px,100%);max-height:calc(100vh - 40px);overflow:auto;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:#17120f;color:#f1e4d4;padding:26px 26px 22px;box-shadow:0 30px 90px rgba(0,0,0,.6);font-family:var(--fS,var(--fB,system-ui))}'
+'.mdd-card h3{margin:0 0 10px;font:400 26px/1.1 var(--fD,"Cormorant",Georgia,serif)}.mdd-card p{margin:0 0 14px;font-size:14px;line-height:1.65;color:#cbbba5;white-space:pre-line}'
+'.mdd-ico{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;margin-bottom:14px;font-size:19px;background:rgba(201,166,107,.16);color:#dec08a}.mdd-ico.danger{background:rgba(229,112,124,.16);color:#e5707c}.mdd-ico.ok{background:rgba(111,207,151,.16);color:#6fcf97}'
+'.mdd-f{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}.mdd-f span{font:600 10px var(--fM,system-ui);letter-spacing:.16em;text-transform:uppercase;color:#a8977f}'
+'.mdd-f input,.mdd-f textarea{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#0e0b09;color:inherit;font:inherit;font-size:15px}.mdd-f input:focus,.mdd-f textarea:focus{outline:0;border-color:#c9a66b}'
+'.mdd-err{margin:-4px 0 12px;font-size:12.5px;color:#e5707c}'
+'.mdd-act{display:flex;justify-content:flex-end;gap:10px;margin-top:8px;flex-wrap:wrap}.mdd-btn{padding:10px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;font:600 13.5px var(--fS,system-ui);cursor:pointer}.mdd-btn:hover{border-color:#c9a66b}.mdd-btn.go{background:#c9a66b;border-color:transparent;color:#17120d}.mdd-btn.danger{background:#e5707c;border-color:transparent;color:#1a0d0f}'
+'@media(max-width:520px){.mdd-act .mdd-btn{flex:1}}';
function style(){if(document.getElementById('mdd-css'))return;var s=document.createElement('style');s.id='mdd-css';s.textContent=css;document.head.appendChild(s);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function show(html,build){
  style();
  return new Promise(function(resolve){
    var back=document.createElement('div');back.className='mdd-back';back.innerHTML='<div class="mdd-card" role="dialog" aria-modal="true">'+html+'</div>';
    var prevFocus=document.activeElement;
    function done(v){document.removeEventListener('keydown',onKey,true);back.remove();try{if(prevFocus&&prevFocus.focus)prevFocus.focus();}catch(e){}resolve(v);}
    function onKey(e){if(e.key==='Escape'){e.stopPropagation();done(build.cancelValue);}else if(e.key==='Enter'&&e.target&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'){e.preventDefault();build.ok(done,back);}}
    back.addEventListener('mousedown',function(e){if(e.target===back)done(build.cancelValue);});
    document.addEventListener('keydown',onKey,true);document.body.appendChild(back);
    back.querySelector('[data-mdd="cancel"]')&&back.querySelector('[data-mdd="cancel"]').addEventListener('click',function(){done(build.cancelValue);});
    back.querySelector('[data-mdd="ok"]').addEventListener('click',function(){build.ok(done,back);});
    var first=back.querySelector('input,textarea')||back.querySelector('[data-mdd="ok"]');if(first)setTimeout(function(){first.focus();},30);
  });
}
function confirm(o){
  o=o||{};
  return show('<div class="mdd-ico'+(o.danger?' danger':'')+'">'+(o.danger?'!':'?')+'</div><h3>'+esc(o.title||'Are you sure?')+'</h3><p>'+esc(o.message||'')+'</p><div class="mdd-act"><button type="button" class="mdd-btn" data-mdd="cancel">'+esc(o.cancel||'Cancel')+'</button><button type="button" class="mdd-btn '+(o.danger?'danger':'go')+'" data-mdd="ok">'+esc(o.confirm||'Continue')+'</button></div>',{cancelValue:false,ok:function(done){done(true);}});
}
function form(o){
  o=o||{};var fields=o.fields||[];
  var html='<h3>'+esc(o.title||'')+'</h3>'+(o.message?'<p>'+esc(o.message)+'</p>':'')+fields.map(function(f,i){return '<label class="mdd-f"><span>'+esc(f.label||f.k)+(f.required?' *':'')+'</span>'+(f.type==='textarea'?'<textarea data-i="'+i+'" rows="3" placeholder="'+esc(f.placeholder||'')+'">'+esc(f.value||'')+'</textarea>':'<input data-i="'+i+'" type="'+esc(f.type||'text')+'" placeholder="'+esc(f.placeholder||'')+'" value="'+esc(f.value||'')+'">')+'</label>';}).join('')+'<div class="mdd-err" hidden></div><div class="mdd-act"><button type="button" class="mdd-btn" data-mdd="cancel">'+esc(o.cancel||'Cancel')+'</button><button type="button" class="mdd-btn go" data-mdd="ok">'+esc(o.confirm||'Save')+'</button></div>';
  return show(html,{cancelValue:null,ok:function(done,back){
    var out={},bad=null;
    fields.forEach(function(f,i){var el=back.querySelector('[data-i="'+i+'"]'),v=el?String(el.value||'').trim():'';out[f.k]=v;if(f.required&&!v&&!bad)bad=(f.label||f.k)+' is required.';if(v&&f.pattern&&!new RegExp(f.pattern).test(v)&&!bad)bad=f.patternMessage||('Check '+(f.label||f.k)+'.');});
    var err=back.querySelector('.mdd-err');if(bad){err.textContent=bad;err.hidden=false;return;}
    done(out);
  }});
}
function alertBox(o){
  o=o||{};
  return show('<div class="mdd-ico '+(o.tone==='ok'?'ok':o.tone==='danger'?'danger':'')+'">'+(o.tone==='ok'?'✓':'!')+'</div><h3>'+esc(o.title||'Heads up')+'</h3><p>'+esc(o.message||'')+'</p><div class="mdd-act"><button type="button" class="mdd-btn go" data-mdd="ok">'+esc(o.confirm||'OK')+'</button></div>',{cancelValue:undefined,ok:function(done){done();}});
}
window.MDV_DIALOG={confirm:confirm,form:form,alert:alertBox};
})();
