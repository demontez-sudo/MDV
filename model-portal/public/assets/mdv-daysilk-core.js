/* DaySilk core: the questionnaire that sets a DaySilk up, and the small time helpers both the agent and model versions use.
   DS.wizard({title,intro,sections,answers,saveLabel,skip}) -> Promise<answers|null>
   Sections: {k,s,i,q:[[key,question,type,options|default,hint,showFn]]}
   Types: text, long, number, choice, multi, days, time, scale, yesno.  The answers object is returned for the caller to turn into a plan. */
(function(){
'use strict';
if(window.DS&&window.DS.wizard)return;

var pad=function(n){return String(n).padStart(2,'0');};
var DAYS=[['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat'],['0','Sun']];
var DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parse(s){var p=String(s).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function addDays(s,n){var d=parse(s);d.setDate(d.getDate()+n);return iso(d);}
function tMin(t){if(!t)return 0;var p=String(t).split(':').map(Number);return p[0]*60+(p[1]||0);}
function m2t(m){m=((m%1440)+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60);}
function fmtT(t){if(!t)return '';var p=String(t).split(':').map(Number),h=p[0],m=p[1]||0,ap=h>=12?'pm':'am';h=h%12||12;return h+(m?':'+pad(m):'')+ap;}

var CSS='.dsw-back{position:fixed;inset:0;z-index:2147483100;background:rgba(6,5,4,.82);display:grid;place-items:center;padding:16px;backdrop-filter:blur(4px)}'
+'.dsw{width:min(720px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:#14110e;color:#f1e4d4;box-shadow:0 40px 110px rgba(0,0,0,.6);overflow:hidden;font-family:var(--fS,var(--fB,system-ui))}'
+'.dsw-top{padding:22px 28px 14px;border-bottom:1px solid rgba(255,255,255,.08)}.dsw-brand{display:flex;align-items:center;justify-content:space-between;gap:12px}.dsw-brand b{font:600 11px system-ui;letter-spacing:.26em;text-transform:uppercase;color:#d4b077}.dsw-skip{background:none;border:0;color:#a8977f;font-size:12.5px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}'
+'.dsw-prog{height:3px;border-radius:99px;background:rgba(255,255,255,.1);margin-top:14px;overflow:hidden}.dsw-prog i{display:block;height:100%;background:#d4b077;transition:width .3s}'
+'.dsw-body{padding:22px 28px;overflow:auto;flex:1}.dsw-body h2{margin:0 0 6px;font:400 30px/1.1 var(--fD,"Cormorant Garamond",Georgia,serif)}.dsw-intro{margin:0 0 20px;font-size:14px;line-height:1.6;color:#b9a98f}'
+'.dsw-q{margin:0 0 20px}.dsw-q>label,.dsw-q>.dsw-l{display:block;font-size:14.5px;line-height:1.45;margin:0 0 8px;color:#f1e4d4}.dsw-hint{display:block;font-size:12px;color:#8d7d68;margin-top:4px}'
+'.dsw input[type=text],.dsw input[type=number],.dsw input[type=time],.dsw input[type=date],.dsw textarea{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#0e0b09;color:inherit;font:inherit;font-size:15px}.dsw input:focus,.dsw textarea:focus{outline:0;border-color:#d4b077}.dsw textarea{min-height:84px;resize:vertical}'
+'.dsw-opts{display:flex;flex-wrap:wrap;gap:8px}.dsw-o{padding:9px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:transparent;color:inherit;font:inherit;font-size:13.5px;cursor:pointer}.dsw-o:hover{border-color:#d4b077}.dsw-o.on{background:#d4b077;border-color:transparent;color:#17120d;font-weight:600}'
+'.dsw-days .dsw-o{min-width:46px;text-align:center;padding:9px 10px}.dsw-scale{display:flex;gap:8px;align-items:center}.dsw-scale .dsw-o{width:42px;height:42px;padding:0;border-radius:50%}.dsw-scale small{font-size:11.5px;color:#8d7d68}'
+'.dsw-err{margin:0 0 12px;font-size:13px;color:#e5707c}'
+'.dsw-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 28px;border-top:1px solid rgba(255,255,255,.08)}.dsw-foot span{font-size:12px;color:#8d7d68}'
+'.dsw-btn{padding:11px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;font:600 13.5px system-ui;cursor:pointer}.dsw-btn:hover{border-color:#d4b077}.dsw-btn.go{background:#d4b077;border-color:transparent;color:#17120d}.dsw-btn[disabled]{opacity:.5;pointer-events:none}'
+'@media(max-width:560px){.dsw-top,.dsw-body,.dsw-foot{padding-left:18px;padding-right:18px}.dsw-body h2{font-size:25px}}';
function style(){if(document.getElementById('dsw-css'))return;var s=document.createElement('style');s.id='dsw-css';s.textContent=CSS;document.head.appendChild(s);}

function visible(q,a){return !q[5]||q[5](a);}
function wizard(cfg){
  style();
  var secs=cfg.sections||[],a=Object.assign({},cfg.answers||{}),step=0,busy=false;
  return new Promise(function(resolve){
    var back=document.createElement('div');back.className='dsw-back';document.body.appendChild(back);
    function done(v){document.removeEventListener('keydown',onKey,true);back.remove();resolve(v);}
    function onKey(e){if(e.key==='Escape'&&cfg.skip!==false&&!busy){e.stopPropagation();done(null);}}
    document.addEventListener('keydown',onKey,true);

    function field(q){
      var k=q[0],type=q[2],opt=q[3],v=a[k];
      var lab='<label for="dsw-'+esc(k)+'">'+esc(q[1])+'</label>';
      var hint=q[4]?'<span class="dsw-hint">'+esc(q[4])+'</span>':'';
      if(type==='text')return '<div class="dsw-q">'+lab+'<input type="text" id="dsw-'+esc(k)+'" data-k="'+esc(k)+'" value="'+esc(v!=null?v:(opt||''))+'" placeholder="'+esc(q[4]||'')+'"></div>';
      if(type==='number')return '<div class="dsw-q">'+lab+'<input type="number" id="dsw-'+esc(k)+'" data-k="'+esc(k)+'" value="'+esc(v!=null?v:(opt||''))+'" inputmode="numeric">'+hint+'</div>';
      if(type==='time')return '<div class="dsw-q">'+lab+'<input type="time" id="dsw-'+esc(k)+'" data-k="'+esc(k)+'" value="'+esc(v!=null?v:(opt||''))+'">'+hint+'</div>';
      if(type==='date')return '<div class="dsw-q">'+lab+'<input type="date" id="dsw-'+esc(k)+'" data-k="'+esc(k)+'" value="'+esc(v||'')+'">'+hint+'</div>';
      if(type==='long')return '<div class="dsw-q">'+lab+'<textarea id="dsw-'+esc(k)+'" data-k="'+esc(k)+'" placeholder="'+esc(q[4]||'')+'">'+esc(v||'')+'</textarea></div>';
      if(type==='yesno'){return '<div class="dsw-q"><span class="dsw-l">'+esc(q[1])+'</span><div class="dsw-opts">'+['Yes','No'].map(function(o){return '<button type="button" class="dsw-o'+(v===o?' on':'')+'" data-k="'+esc(k)+'" data-v="'+o+'" data-t="choice">'+o+'</button>';}).join('')+'</div>'+hint+'</div>';}
      if(type==='choice')return '<div class="dsw-q"><span class="dsw-l">'+esc(q[1])+'</span><div class="dsw-opts">'+opt.map(function(o){return '<button type="button" class="dsw-o'+(v===o?' on':'')+'" data-k="'+esc(k)+'" data-v="'+esc(o)+'" data-t="choice">'+esc(o)+'</button>';}).join('')+'</div>'+hint+'</div>';
      if(type==='multi'){var cur=[].concat(v||[]);return '<div class="dsw-q"><span class="dsw-l">'+esc(q[1])+'</span><div class="dsw-opts">'+opt.map(function(o){return '<button type="button" class="dsw-o'+(cur.indexOf(o)>-1?' on':'')+'" data-k="'+esc(k)+'" data-v="'+esc(o)+'" data-t="multi">'+esc(o)+'</button>';}).join('')+'</div>'+hint+'</div>';}
      if(type==='days'){var dv=[].concat(v||[]);return '<div class="dsw-q"><span class="dsw-l">'+esc(q[1])+'</span><div class="dsw-opts dsw-days">'+DAYS.map(function(d){return '<button type="button" class="dsw-o'+(dv.indexOf(d[0])>-1?' on':'')+'" data-k="'+esc(k)+'" data-v="'+d[0]+'" data-t="multi">'+d[1]+'</button>';}).join('')+'</div>'+hint+'</div>';}
      if(type==='scale'){var labels=opt||['Low','','','','High'];return '<div class="dsw-q"><span class="dsw-l">'+esc(q[1])+'</span><div class="dsw-scale"><small>'+esc(labels[0])+'</small>'+[1,2,3,4,5].map(function(n){return '<button type="button" class="dsw-o'+(Number(v)===n?' on':'')+'" data-k="'+esc(k)+'" data-v="'+n+'" data-t="choice">'+n+'</button>';}).join('')+'<small>'+esc(labels[4]||'')+'</small></div></div>';}
      return '';
    }
    function read(){back.querySelectorAll('input[data-k],textarea[data-k]').forEach(function(el){a[el.getAttribute('data-k')]=el.value;});}
    function paint(err){
      var s=secs[step],qs=s.q.filter(function(q){return visible(q,a);});
      var last=step===secs.length-1;
      back.innerHTML='<div class="dsw" role="dialog" aria-modal="true" aria-label="'+esc(cfg.title||'DaySilk')+'"><div class="dsw-top"><div class="dsw-brand"><b>'+esc(cfg.brand||'DaySilk')+' · '+(step+1)+' of '+secs.length+'</b>'+(cfg.skip!==false?'<button type="button" class="dsw-skip" data-a="skip">'+esc(cfg.skipLabel||'Do this later')+'</button>':'')+'</div><div class="dsw-prog"><i style="width:'+Math.round((step+1)/secs.length*100)+'%"></i></div></div>'
       +'<div class="dsw-body"><h2>'+esc(s.s)+'</h2><p class="dsw-intro">'+esc(s.i||'')+'</p>'+(err?'<p class="dsw-err">'+esc(err)+'</p>':'')+qs.map(field).join('')+'</div>'
       +'<div class="dsw-foot"><span>'+(step===0&&cfg.intro?esc(cfg.intro):'')+'</span><div style="display:flex;gap:10px">'+(step>0?'<button type="button" class="dsw-btn" data-a="back">Back</button>':'')+'<button type="button" class="dsw-btn go" data-a="next"'+(busy?' disabled':'')+'>'+(last?esc(busy?'Building…':(cfg.saveLabel||'Build my DaySilk')):'Next')+'</button></div></div></div>';
      back.querySelector('.dsw-body').scrollTop=0;
      back.querySelectorAll('[data-t]').forEach(function(b){b.onclick=function(){
        read();var k=b.getAttribute('data-k'),v=b.getAttribute('data-v'),t=b.getAttribute('data-t');
        if(t==='choice'){a[k]=a[k]===v?'':v;}else{var c=[].concat(a[k]||[]),i=c.indexOf(v);if(i>-1)c.splice(i,1);else c.push(v);a[k]=c;}
        var keepScroll=back.querySelector('.dsw-body').scrollTop;paint();back.querySelector('.dsw-body').scrollTop=keepScroll;
      };});
      back.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){act(b.getAttribute('data-a'));};});
      back.querySelectorAll('input[data-k],textarea[data-k]').forEach(function(el){el.addEventListener('input',function(){a[el.getAttribute('data-k')]=el.value;});el.addEventListener('keydown',function(e){if(e.key==='Enter'&&el.tagName!=='TEXTAREA'){e.preventDefault();act('next');}});});
      var f=back.querySelector('input[type=text],textarea');if(f&&step===0)setTimeout(function(){f.focus();},40);
    }
    async function act(x){
      if(busy)return;read();
      if(x==='skip'){done(null);return;}
      if(x==='back'){step=Math.max(0,step-1);paint();return;}
      /* required questions on this step */
      var s=secs[step],missing=s.q.filter(function(q){return visible(q,a)&&q[6]==='required'&&(a[q[0]]==null||a[q[0]]===''||(Array.isArray(a[q[0]])&&!a[q[0]].length));});
      if(missing.length){paint('Please answer: '+missing.map(function(q){return q[1].replace(/\?$/,'');}).join('; ')+'.');return;}
      if(step<secs.length-1){step++;paint();return;}
      busy=true;paint();
      try{await (cfg.onSave?cfg.onSave(a):null);done(a);}
      catch(e){busy=false;paint((e&&e.message)||'That could not be saved. Try again.');}
    }
    paint();
  });
}

window.DS={wizard:wizard,util:{pad:pad,iso:iso,parse:parse,addDays:addDays,tMin:tMin,m2t:m2t,fmtT:fmtT,DOW:DOW,DAYS:DAYS,esc:esc}};
})();
