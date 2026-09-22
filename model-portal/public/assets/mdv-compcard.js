/* Model Portal — self-serve Comp Card PDF, built from the model's own live photos/measurements. */
(function(){
'use strict';
if(window.__MDV_COMPCARD__)return;window.__MDV_COMPCARD__=true;

function isVideo(x){return String(x&&x.media_type||'').toLowerCase()==='video'||/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(String(x&&x.url||''));}
function websiteSection(cat,mediaType){
  var c=String(cat||'').trim().toLowerCase();
  if(!c)return null;
  if(String(mediaType||'').toLowerCase()==='video')return 'motion';
  if(c.indexOf('digital')>=0)return 'digitals';
  if(c.indexOf('motion')>=0)return 'motion';
  if(['headshot','editorial','runway','commercial','portfolio','polaroid','book'].indexOf(c)>=0)return 'book';
  return null;
}
function loadImg(url){return new Promise(function(resolve){if(!url)return resolve(null);var im=new Image();im.crossOrigin='anonymous';im.onload=function(){resolve(im);};im.onerror=function(){resolve(null);};im.src=url;});}
function ccCover(ctx,im,x,y,w,h){if(!im){ctx.fillStyle='#e4dccd';ctx.fillRect(x,y,w,h);return;}var ir=im.width/im.height,r=w/h,sw=im.width,sh=im.height,sx=0,sy=0;if(ir>r){sw=im.height*r;sx=(im.width-sw)/2;}else{sh=im.width/r;sy=(im.height-sh)/2;}ctx.drawImage(im,sx,sy,sw,sh,x,y,w,h);}
function wordmark(ctx,x0,y0,size,spacing){ctx.textBaseline='alphabetic';var cx=x0,i,ch;for(i=0;i<'MAISON '.length;i++){ch='MAISON '[i];ctx.font='600 '+size+'px Inter, sans-serif';ctx.fillText(ch,cx,y0);cx+=ctx.measureText(ch).width+spacing;}for(i=0;i<'de'.length;i++){ch='de'[i];ctx.font='500 italic '+(size*1.05)+'px "Cormorant Garamond", serif';ctx.fillText(ch,cx,y0);cx+=ctx.measureText(ch).width+spacing*.6;}cx+=spacing*.4;var tail=' VEUX';for(i=0;i<tail.length;i++){ch=tail[i];if(ch===' '){cx+=spacing*1.4;continue;}ctx.font='600 '+size+'px Inter, sans-serif';ctx.fillText(ch,cx,y0);cx+=ctx.measureText(ch).width+spacing;}}
function letterSpaced(ctx,text,size,spacing,x,y){ctx.font=size+'px Inter, sans-serif';var cx=x;for(var i=0;i<text.length;i++){var ch=text[i];ctx.fillText(ch,cx,y);cx+=ctx.measureText(ch).width+spacing;}}

function eligiblePhotos(mediaList){return (mediaList||[]).filter(function(x){return !isVideo(x)&&x.url&&websiteSection(x.category,x.media_type);});}
function frontPhoto(mediaList){var a=eligiblePhotos(mediaList);var p=a.find(function(x){return x.is_primary;});return p||a[0]||null;}

async function compCardFront(model,ctx,W,H){
  var pics=eligiblePhotos(model.media),front=frontPhoto(model.media);
  var im=await loadImg(front&&front.url);
  ccCover(ctx,im,0,0,W,H);
  var g=ctx.createLinearGradient(0,0,0,H*0.26);g.addColorStop(0,'rgba(10,9,7,.58)');g.addColorStop(1,'rgba(10,9,7,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H*0.26);
  g=ctx.createLinearGradient(0,H*0.68,0,H);g.addColorStop(0,'rgba(10,9,7,0)');g.addColorStop(1,'rgba(10,9,7,.72)');ctx.fillStyle=g;ctx.fillRect(0,H*0.68,W,H*0.32);
  var pad=W*0.065;
  ctx.fillStyle='#f7f2e8';
  wordmark(ctx,pad,H*0.085,W*0.032,W*0.006);
  ctx.fillStyle='#f7f2e8';ctx.globalAlpha=.82;
  letterSpaced(ctx,'NEW YORK · PARIS',W*0.018,W*0.008,pad,H*0.085+W*0.05);
  ctx.globalAlpha=1;
  var full=(model.display_name||'Model').trim().toUpperCase();
  var fsz=W*0.135;ctx.font='500 italic '+fsz+'px "Cormorant Garamond", serif';
  var maxW=W-pad*2;while(ctx.measureText(full).width>maxW&&fsz>W*0.05){fsz-=W*0.004;ctx.font='500 italic '+fsz+'px "Cormorant Garamond", serif';}
  ctx.fillStyle='#f7f2e8';
  var ny=H*0.9;ctx.fillText(full,pad,ny);
  var tw=ctx.measureText(full).width;
  ctx.fillRect(pad,ny+H*0.014,Math.min(tw,W-pad*2),H*0.0016);
  return pics;
}

async function compCardBack(model,ctx,W,H,pics){
  ctx.fillStyle='#f5f0e7';ctx.fillRect(0,0,W,H);
  var pad=W*0.065;
  var full=(model.display_name||'Model').trim().toUpperCase();
  var bfsz=W*0.095;ctx.font='500 '+bfsz+'px "Cormorant Garamond", serif';ctx.textBaseline='alphabetic';
  var bmaxW=W-pad*2;while(ctx.measureText(full).width>bmaxW&&bfsz>W*0.04){bfsz-=W*0.003;ctx.font='500 '+bfsz+'px "Cormorant Garamond", serif';}
  ctx.fillStyle='#171512';
  ctx.fillText(full,pad,H*0.115);
  var gridTop=H*0.155,gridBottom=H*0.805,gridLeft=pad,gridRight=W*0.66,gap=W*0.012;
  var cellW=(gridRight-gridLeft-gap)/2,cellH=(gridBottom-gridTop-gap)/2;
  var cells=[[gridLeft,gridTop],[gridLeft+cellW+gap,gridTop],[gridLeft,gridTop+cellH+gap],[gridLeft+cellW+gap,gridTop+cellH+gap]];
  for(var i=0;i<4;i++){var src=pics.length?pics[i%pics.length]:null;var im=await loadImg(src&&src.url);ccCover(ctx,im,cells[i][0],cells[i][1],cellW,cellH);}
  var mm=model.measurements||{};
  var rows=[['HEIGHT',mm.height_display],['BUST',mm.bust_display],['CHEST',mm.chest_display],['WAIST',mm.waist_display],['HIPS',mm.hips_display],['SHOE',mm.shoe],['EYES',mm.eyes],['HAIR',mm.hair]].filter(function(x){return x[1];});
  var ry=gridTop+H*0.03,rx=gridRight+W*0.05;
  ctx.textBaseline='alphabetic';
  rows.forEach(function(pair){
    ctx.fillStyle='#8a8074';letterSpaced(ctx,pair[0],W*0.014,W*0.003,rx,ry);
    ctx.fillStyle='#171512';ctx.font='500 '+(W*0.028)+'px "Cormorant Garamond", serif';ctx.fillText(String(pair[1]),rx,ry+H*0.038);
    ry+=H*0.083;
  });
  var footY=H*0.855;
  ctx.strokeStyle='#d8cdbd';ctx.lineWidth=Math.max(1,W*0.0015);ctx.beginPath();ctx.moveTo(pad,footY);ctx.lineTo(W-pad,footY);ctx.stroke();
  ctx.fillStyle='#171512';wordmark(ctx,pad,footY+H*0.05,W*0.016,W*0.003);
  ctx.fillStyle='#8a8074';letterSpaced(ctx,'NEW YORK · PARIS',W*0.012,W*0.005,pad,footY+H*0.075);
  var agent=model.agent||{};
  var info=[agent.name&&('Agent  '+agent.name),agent.address&&('Address  '+agent.address),agent.email&&('Email  '+agent.email),agent.phone&&('Contact  '+agent.phone)].filter(Boolean);
  ctx.font='500 '+(W*0.014)+'px Inter, sans-serif';ctx.fillStyle='#43403a';
  info.forEach(function(line,i){ctx.fillText(line,W*0.44,footY+H*0.05+i*H*0.028);});
}

var jspdfReady=null;
function loadJsPDF(){
  if(window.jspdf&&window.jspdf.jsPDF)return Promise.resolve();
  if(jspdfReady)return jspdfReady;
  jspdfReady=new Promise(function(resolve,reject){
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload=function(){resolve();};
    s.onerror=function(){reject(new Error('Could not load the PDF library. Check your connection and try again.'));};
    document.head.appendChild(s);
  });
  return jspdfReady;
}

async function downloadMyCompCard(btn){
  var b=window.VEUX_MODEL&&VEUX_MODEL.getBoot?VEUX_MODEL.getBoot():{};
  var model={
    display_name:(b.model||{}).display_name,
    media:(b.model||{}).media||(b.media&&b.media.all)||[],
    measurements:b.measurements||{},
    agent:b.agent_contact||null
  };
  if(!eligiblePhotos(model.media).length){if(window.toast)window.toast('Add at least one Book, Digital or Motion photo before downloading a comp card.');return;}
  var original=btn&&btn.textContent;
  try{
    if(btn){btn.disabled=true;btn.textContent='Preparing…';}
    await loadJsPDF();
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    var W=1650,H=2550;
    var c1=document.createElement('canvas');c1.width=W;c1.height=H;
    var pics=await compCardFront(model,c1.getContext('2d'),W,H);
    var c2=document.createElement('canvas');c2.width=W;c2.height=H;
    await compCardBack(model,c2.getContext('2d'),W,H,pics);
    var jsPDF=window.jspdf.jsPDF;
    var doc=new jsPDF({unit:'in',format:[5.5,8.5],orientation:'portrait'});
    doc.addImage(c1.toDataURL('image/jpeg',0.93),'JPEG',0,0,5.5,8.5);
    doc.addPage([5.5,8.5],'portrait');
    doc.addImage(c2.toDataURL('image/jpeg',0.93),'JPEG',0,0,5.5,8.5);
    doc.save((model.display_name||'Model').replace(/[^\w\- ]+/g,'').trim()+' Comp Card.pdf');
  }catch(e){if(window.toast)window.toast(e.message||'Could not build the comp card');}
  finally{if(btn){btn.disabled=false;btn.textContent=original||'Download My Comp Card';}}
}

window.VEUX_MY_COMPCARD={download:downloadMyCompCard};
})();
