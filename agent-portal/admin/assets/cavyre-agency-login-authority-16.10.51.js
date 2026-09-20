/* CAVYRE 16.10.51 — Agency Login Authority. Presentation only. */
(function(){
'use strict';
if(window.__CAVYRE_LOGIN_AUTHORITY_161051__)return;
window.__CAVYRE_LOGIN_AUTHORITY_161051__=true;

function setHtml(el,html){if(el.__cvyH===html&&el.firstChild)return;el.__cvyH=html;el.innerHTML=html}
function ensure(){
  var login=document.getElementById('login');
  if(!login)return;

  login.setAttribute('data-cavyre-login','16.10.51');

  var brand=login.querySelector('.lg-brand');
  if(!brand){
    brand=document.createElement('section');
    brand.className='lg-brand';
    login.insertBefore(brand,login.firstChild);
  }
  brand.setAttribute('aria-label','CAVYRE Network Premium');
  setHtml(brand,
    '<div class="lg-brand-copy">'+
      '<div class="lg-wordmark">CAVYRE</div>'+
      '<div class="lg-network">NETWORK PREMIUM · AGENCY ACCESS</div>'+
      '<div class="lg-divider"></div>'+
      '<div class="lg-portal-title">Agent <em>Network</em></div>'+
      '<div class="lg-portal-sub">Intelligence. Relationships. Performance.</div>'+
    '</div>'+
    '<div class="lg-points">'+
      '<div class="lg-point"><i>01</i><b>Global Reach</b><span>New York · Paris · Worldwide</span></div>'+
      '<div class="lg-point"><i>02</i><b>Smart Operations</b><span>Calendar · Mobility · Finance</span></div>'+
      '<div class="lg-point"><i>03</i><b>Connected Talent</b><span>Agency ↔ Model ↔ Partner</span></div>'+
      '<div class="lg-point"><i>04</i><b>Private Platform</b><span>Secure agency control</span></div>'+
    '</div>');

  var entry=login.querySelector('.lg-entry');
  if(!entry){
    entry=document.createElement('section');
    entry.className='lg-entry';
    login.appendChild(entry);
  }

  var card=entry.querySelector('.lg-card');
  if(!card){
    card=document.createElement('div');
    card.className='lg-card';
    entry.appendChild(card);
  }

  var top=card.querySelector('.lg-top');
  if(!top){
    top=document.createElement('div');
    top.className='lg-top';
    card.insertBefore(top,card.firstChild);
  }
  setHtml(top,
    '<div class="lg-mark"><span>C</span></div>'+
    '<div class="lg-eyebrow">CAVYRE · MAISON DE VEUX</div>'+
    '<div class="lg-h1">Agency <em>Network</em></div>'+
    '<div class="lg-sub">Secure staff access to your CAVYRE workspace.</div>');

  var body=card.querySelector('.lg-body');
  if(body){
    body.setAttribute('onsubmit','return false;');
    var email=body.querySelector('#veuxEmail');
    var pass=body.querySelector('#veuxPassword');
    var button=body.querySelector('#veuxLoginBtn');
    var forgot=body.querySelector('#veuxForgotBtn');
    if(email)email.placeholder='agency@maisondeveux.com';
    if(pass)pass.placeholder='Enter password';
    if(button && !button.disabled)button.textContent='ENTER CAVYRE →';
    if(forgot)forgot.textContent='Forgot password?';
  }

  var secure=card.querySelector('.lg-secure');
  if(secure)secure.textContent='SECURE · PRIVATE · NETWORK ACCESS';
  var foot=card.querySelector('.lg-foot');
  if(foot)foot.textContent='CAVYRE NETWORK PREMIUM · MAISON DE VEUX';

  var language=entry.querySelector('.lg-language');
  if(language)language.textContent='GLOBAL AGENCY ACCESS';
}

function protect(){
  ensure();
  var login=document.getElementById('login');
  if(!login)return;
  var observer=new MutationObserver(function(mutations){
    var needs=false;
    for(var i=0;i<mutations.length;i++){
      var t=mutations[i].target;
      if(t && t.nodeType===1 && (t.closest&&t.closest('#login'))){needs=true;break;}
    }
    if(needs){
      clearTimeout(protect._t);
      protect._t=setTimeout(function(){
        var h=(document.getElementById('login')||{}).textContent||'';
        if(/VEUX DESK|Agency Portal|Secure Staff Access|ENTER VEUX/.test(h))ensure();
      },20);
    }
  });
  observer.observe(login,{subtree:true,childList:true,characterData:true});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){ensure();protect();},{once:true});
}else{ensure();protect();}
window.addEventListener('pageshow',ensure);
console.info('[CAVYRE] Agency Login Authority 16.10.51 loaded');
})();