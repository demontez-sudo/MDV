/* Menu portrait stage: shows real faces from the live roster beside the menu. Hover a board and it shows that board; otherwise it drifts through them. */
(function(){
'use strict';
var menu=document.getElementById('menu');if(!menu)return;
var URL_='https://mogyngdhmzbjmcdqeoxu.supabase.co',KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
var VIEWS=['women','development','men','creator'],LABEL={women:'Women',development:'Development',men:'Men',creator:'Creator'};
var faces={},loaded=false,stage,A,B,nameEl,boardEl,front,timer=null,hoverView='',idx=0,curKey='';
function sized(u,w){
  u=String(u||'');
  if(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u))return u.replace('/image/upload/','/image/upload/f_auto,q_auto,w_'+w+',c_limit/');
  if(/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(u))return u.replace('/storage/v1/object/public/','/storage/v1/render/image/public/')+'?width='+w+'&resize=contain&quality=72';
  return u;
}
function build(){
  stage=document.createElement('div');stage.className='menu-stage';stage.setAttribute('aria-hidden','true');
  stage.innerHTML='<div class="ms-frame"><img alt=""><img alt=""></div><i class="ms-c a"></i><i class="ms-c b"></i><i class="ms-c c"></i><i class="ms-c d"></i><div class="ms-cap"><span class="ms-name"></span><span class="ms-board"></span></div>';
  var imgs=stage.querySelectorAll('img');A=imgs[0];B=imgs[1];front=A;nameEl=stage.querySelector('.ms-name');boardEl=stage.querySelector('.ms-board');
  menu.appendChild(stage);
}
function city(){var s=menu.querySelector('.menu-set.active');return s&&s.getAttribute('data-city')==='paris'?'Paris':'New York';}
function viewOf(a){var h=String(a.getAttribute('href')||'');return /creators/.test(h)?'creator':/development/.test(h)?'development':/men-/.test(h)?'men':/women-/.test(h)?'women':'';}
function load(){
  if(loaded)return;loaded=true;
  ['New York','Paris'].forEach(function(c){
    VIEWS.forEach(function(v){
      fetch(URL_+'/rest/v1/rpc/website_public_roster',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'content-type':'application/json'},body:JSON.stringify({target_market:c,target_view:v}),credentials:'omit'})
        .then(function(r){return r.ok?r.json():{};}).then(function(b){
          var k=c+'|'+v;faces[k]=(b.models||[]).filter(function(m){return m.image_url;}).map(function(m){return {n:m.display_name,u:sized(m.image_url,640)};});
          faces[k].sort(function(){return Math.random()-.5;});
          if(!curKey)tick();
        }).catch(function(){});
    });
  });
}
function show(f,view){
  if(!f)return;
  var back=front===A?B:A;
  back.onload=function(){back.classList.add('show');front.classList.remove('show');front=back;nameEl.textContent=f.n;boardEl.textContent=LABEL[view]||'';};
  back.src=f.u;
}
function tick(){
  var c=city(),v=hoverView,list,f;
  if(v){list=faces[c+'|'+v]||[];if(!list.length)return;f=list[idx%list.length];}
  else{
    var keys=VIEWS.filter(function(x){return (faces[c+'|'+x]||[]).length;});if(!keys.length)return;
    v=keys[idx%keys.length];list=faces[c+'|'+v];f=list[Math.floor(idx/keys.length)%list.length];
  }
  curKey=c+'|'+v;show(f,v);idx++;
}
function run(){clearInterval(timer);tick();timer=setInterval(tick,hoverView?1100:2600);}
function open(){return menu.classList.contains('open');}
build();
new MutationObserver(function(){if(open()){load();idx=0;hoverView='';run();}else clearInterval(timer);}).observe(menu,{attributes:true,attributeFilter:['class']});
menu.addEventListener('mouseover',function(e){
  var a=e.target.closest&&e.target.closest('.menu-primary a');
  var v=a?viewOf(a):'';
  if(v!==hoverView){hoverView=v;idx=0;if(open())run();}
});
menu.addEventListener('mouseleave',function(){if(hoverView){hoverView='';idx=0;if(open())run();}});
})();
