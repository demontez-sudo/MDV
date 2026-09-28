const SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
function shell(statusCode,title,message){return {statusCode,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html,body{margin:0;background:#050403;color:#eee7de;font:14px/1.6 Arial,sans-serif}main{width:min(680px,88vw);margin:16vh auto}.eyebrow{font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#a98958}h1{font:400 42px/1.05 Georgia,serif;margin:16px 0}.muted{color:#9c9184}</style></head><body><main><div class="eyebrow">Maison de Veux</div><h1>${title}</h1><div class="muted">${message}</div></main></body></html>`};}
function safeKey(v){v=String(v||'').trim().toLowerCase();return /^[a-z0-9]+$/.test(v)?v:'';}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// Standard model profile page — the "Maison" editorial template. Same design
// language as the original hand-built legacy sites (Bodoni Moda serif name,
// JetBrains Mono labels, full-bleed hero, tabbed editorial/digitals
// slideshow), but rendered server-side from live Model 360 data instead of
// being a one-off static file per model. No per-model Netlify site, deploy
// step, or API token needed — this function fetches the model's public data
// once (already fetched by the caller as `profile`) and renders the page.
function slideshow(id,label,items,name){
  if(!items.length)return '';
  const slides=items.map((x,i)=>`<div class="slide${i===0?' active':''}"><img src="${escHtml(x.url)}" alt="${escHtml(name)} — ${escHtml(label)} ${i+1}" loading="${i===0?'eager':'lazy'}"></div>`).join('');
  const thumbs=items.map((x,i)=>`<div class="thumb${i===0?' active':''}"><img src="${escHtml(x.url)}" alt="thumb ${i+1}" loading="lazy"></div>`).join('');
  return `<div class="gallery"><div class="slideshow" id="slideshow-${id}">
    ${slides}
    <button class="slide-nav prev" aria-label="Previous image"><svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M15 6H1M1 6L6 1M1 6L6 11" stroke="currentColor" stroke-width="1"/></svg></button>
    <button class="slide-nav next" aria-label="Next image"><svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M1 6H15M15 6L10 1M15 6L10 11" stroke="currentColor" stroke-width="1"/></svg></button>
    <div class="slide-index"><span class="current">01</span><span class="sep">/</span><span class="total">${String(items.length).padStart(2,'0')}</span></div>
    <div class="slide-caption">${escHtml(name)} — ${escHtml(label)}</div>
  </div>
  <div class="thumb-rail" id="thumbRail-${id}">${thumbs}</div></div>`;
}
function profileHtml(route,profile){
  const m=profile.model||{},p=profile.public_profile||{},meas=profile.measurements||{};
  const name=m.display_name||'Maison de Veux Model';
  const parts=String(name).trim().split(/\s+/);
  const first=parts[0]||name,rest=parts.slice(1).join(' ');
  const gallery=Array.isArray(profile.gallery)?profile.gallery:[];
  const hero=gallery.find(x=>x.is_primary)||gallery[0]||null;
  const rest_gallery=gallery.filter(x=>x!==hero);
  const isMen=String(m.gender||'').toLowerCase().startsWith('m');
  const digitalItems=rest_gallery.filter(x=>String(x.category||'').toLowerCase().startsWith('digital')||String(x.media_type||'').toLowerCase()==='video');
  const editorialItems=rest_gallery.filter(x=>!digitalItems.includes(x));
  const statPairs=[['Height',meas.height],[isMen?'Chest':'Bust',isMen?(meas.chest||meas.bust):(meas.bust||meas.chest)],['Waist',meas.waist],['Hips',meas.hips],['Shoe',meas.shoe],['Hair',meas.hair],['Eyes',meas.eyes]].filter(([,v])=>v);
  const title=escHtml((p.seo_title||name)+' — Maison de Veux');
  const desc=escHtml(p.seo_description||p.headline||(name+' at Maison de Veux'));
  const stage=m.stage?escHtml(m.stage):'';

  const statsHtml=statPairs.length?`<div class="stats">${statPairs.map(([k,v],i)=>`<div class="stat" style="animation-delay:${(0.7+i*0.06).toFixed(2)}s"><span class="stat-k">${escHtml(k)}</span><span class="stat-v">${escHtml(v)}</span></div>`).join('')}</div>`:'';

  const hasTabs=editorialItems.length||digitalItems.length;
  const workSection=hasTabs?`<section class="work" id="work">
    <div class="tab-bar" id="tabBar">
      <button class="tab-btn active" data-tab="editorial">Editorial</button>
      <button class="tab-btn" data-tab="digitals">Digitals</button>
      <span class="tab-underline" id="tabUnderline"></span>
    </div>
    <div class="tab-panel active" id="panel-editorial">
      ${editorialItems.length?slideshow('editorial','Editorial',editorialItems,name):'<div class="digitals-soon"><div class="ds-eyebrow">Editorial</div><div class="ds-title">Coming soon</div></div>'}
    </div>
    <div class="tab-panel" id="panel-digitals">
      ${digitalItems.length?slideshow('digitals','Digitals',digitalItems,name):'<div class="digitals-soon"><div class="ds-eyebrow">Digitals</div><div class="ds-title">Coming soon</div></div>'}
    </div>
  </section>`:'';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="index,follow">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root{ --paper:#f4f2ee; --ink:#161310; --stone:#8c8677; --line:#d8d3c8; }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html{ scroll-behavior:smooth; }
  body{ background:var(--paper); color:var(--ink); font-family:'Inter', sans-serif; font-weight:300; overflow-x:hidden; }
  ::selection{ background:var(--ink); color:var(--paper); }
  a{ color:inherit; text-decoration:none; }
  .mark{ position:fixed; top:28px; right:5vw; z-index:200; font-family:'JetBrains Mono', monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; mix-blend-mode:difference; color:#fff; opacity:0; animation: fadeIn .8s ease .9s forwards; }
  @keyframes fadeIn{ to{ opacity:1; } }
  .hero-video{ position:relative; width:100%; height:100vh; overflow:hidden; background:#000; }
  .video-wrap{ position:absolute; inset:0; }
  .video-wrap img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
  .hero-video::after{ content:''; position:absolute; inset:0; background:var(--paper); animation: wipe 1.1s cubic-bezier(.76,0,.24,1) forwards; transform-origin:left; pointer-events:none; }
  @keyframes wipe{ from{ transform:scaleX(1); } to{ transform:scaleX(0); } }
  .hero-fade{ position:absolute; left:0; right:0; bottom:0; z-index:2; height:58vh; background:linear-gradient(to bottom, rgba(244,242,238,0) 0%, rgba(244,242,238,.06) 30%, rgba(244,242,238,.18) 50%, rgba(244,242,238,.4) 68%, rgba(244,242,238,.72) 84%, var(--paper) 100%); pointer-events:none; }
  .hero-fade-sides{ position:absolute; inset:0; z-index:2; background:linear-gradient(to right, rgba(244,242,238,.85) 0%, rgba(244,242,238,0) 22%, rgba(244,242,238,0) 78%, rgba(244,242,238,.85) 100%); pointer-events:none; }
  .scroll-cue{ position:absolute; bottom:28px; right:5vw; z-index:5; font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#fff; display:flex; align-items:center; gap:10px; text-shadow:0 1px 8px rgba(0,0,0,.5); opacity:0; animation: fadeIn .8s ease 1.4s forwards; }
  .scroll-cue .bar{ width:1px; height:26px; background:rgba(255,255,255,.5); position:relative; overflow:hidden; }
  .scroll-cue .bar::after{ content:''; position:absolute; left:0; top:-100%; width:100%; height:100%; background:#fff; animation: dropLine 1.8s ease-in-out infinite; }
  @keyframes dropLine{ 0%{ top:-100%; } 60%{ top:100%; } 100%{ top:100%; } }
  .identity{ padding:11vh 5vw 8vh; display:flex; flex-direction:column; align-items:center; text-align:center; }
  .name-mask{ overflow:hidden; }
  .name-mask:nth-of-type(2){ padding-left:0.06em; }
  .name{ font-family:'Bodoni Moda', serif; font-weight:500; font-size:clamp(3rem, 8vw, 6.2rem); line-height:0.98; letter-spacing:-0.01em; transform:translateY(105%); animation: riseUp .9s cubic-bezier(.16,1,.3,1) forwards; }
  .name.italic{ font-style:italic; }
  .name-mask:nth-of-type(1) .name{ animation-delay:.15s; }
  .name-mask:nth-of-type(2) .name{ animation-delay:.27s; }
  @keyframes riseUp{ to{ transform:translateY(0); } }
  .division{ margin-top:22px; font-family:'JetBrains Mono', monospace; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--stone); opacity:0; animation: fadeIn .8s ease .6s forwards; }
  .stats{ margin-top:52px; display:flex; flex-wrap:nowrap; justify-content:center; gap:0; max-width:100%; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .stat{ padding:20px 16px; border-left:1px solid var(--line); text-align:center; opacity:0; animation: fadeIn .6s ease forwards; white-space:nowrap; }
  .stat:first-child{ border-left:none; }
  .stat-k{ display:block; font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--stone); margin-bottom:8px; }
  .stat-v{ font-family:'Bodoni Moda', serif; font-size:clamp(0.82rem, 1.5vw, 1.05rem); white-space:nowrap; }
  .work{ padding-top:4vh; }
  .tab-bar{ display:flex; justify-content:center; gap:56px; position:relative; border-bottom:1px solid var(--line); padding:0 5vw; }
  .tab-btn{ background:none; border:none; font-family:'Bodoni Moda', serif; font-style:italic; font-size:clamp(1.3rem, 2.2vw, 1.7rem); color:var(--stone); padding:0 0 22px; cursor:pointer; transition:color .4s ease; position:relative; }
  .tab-btn.active{ color:var(--ink); }
  .tab-underline{ position:absolute; bottom:-1px; height:1.5px; background:var(--ink); transition:left .45s cubic-bezier(.76,0,.24,1), width .45s cubic-bezier(.76,0,.24,1); }
  .tab-panel{ display:none; }
  .tab-panel.active{ display:block; animation: panelIn .6s ease; }
  @keyframes panelIn{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:translateY(0); } }
  .gallery{ padding:8vh 5vw 16vh; }
  .slideshow{ position:relative; width:100%; height:86vh; overflow:hidden; background:var(--paper); }
  .slide{ position:absolute; inset:0; opacity:0; transform:scale(1.06); transition:opacity 1.1s cubic-bezier(.65,0,.35,1), transform 1.6s cubic-bezier(.16,1,.3,1); pointer-events:none; }
  .slide.active{ opacity:1; transform:scale(1); pointer-events:auto; z-index:2; }
  .slide img{ width:100%; height:100%; object-fit:contain; object-position:center; display:block; filter:grayscale(4%); }
  .slide-index{ position:absolute; bottom:26px; left:26px; z-index:5; font-family:'JetBrains Mono', monospace; font-size:12px; letter-spacing:.1em; color:var(--ink); display:flex; align-items:baseline; gap:6px; mix-blend-mode:difference; }
  .slide-index .current{ font-size:15px; }
  .slide-index .sep{ color:var(--stone); }
  .slide-caption{ position:absolute; bottom:26px; right:26px; z-index:5; font-family:'Bodoni Moda', serif; font-style:italic; font-size:1.05rem; color:var(--ink); mix-blend-mode:difference; }
  .slide-nav{ position:absolute; top:0; bottom:0; z-index:5; width:12%; display:flex; align-items:center; background:transparent; border:none; cursor:pointer; color:var(--ink); mix-blend-mode:difference; opacity:0; transition:opacity .3s ease, background .3s ease; }
  .slideshow:hover .slide-nav{ opacity:1; }
  .slide-nav:hover{ background:rgba(0,0,0,0.06); }
  .slide-nav.prev{ left:0; justify-content:flex-start; padding-left:22px; }
  .slide-nav.next{ right:0; justify-content:flex-end; padding-right:22px; }
  .thumb-rail{ display:flex; gap:14px; margin-top:18px; overflow-x:auto; scrollbar-width:none; }
  .thumb-rail::-webkit-scrollbar{ display:none; }
  .thumb{ flex:0 0 auto; width:96px; height:120px; overflow:hidden; cursor:pointer; position:relative; filter:grayscale(35%); opacity:0.55; transition:opacity .35s ease, filter .35s ease, transform .35s ease; }
  .thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .thumb:hover{ opacity:0.85; transform:translateY(-3px); }
  .thumb.active{ opacity:1; filter:grayscale(0%); transform:translateY(-3px); }
  .thumb.active::after{ content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:var(--ink); }
  .digitals-soon{ padding:14vh 5vw 18vh; display:flex; flex-direction:column; align-items:center; text-align:center; }
  .digitals-soon .ds-eyebrow{ font-family:'JetBrains Mono', monospace; font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--stone); margin-bottom:18px; }
  .digitals-soon .ds-title{ font-family:'Bodoni Moda', serif; font-style:italic; font-size:1.6rem; color:var(--ink); }
  footer{ padding:40px 5vw 44px; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; font-family:'JetBrains Mono', monospace; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--stone); }
  @media (max-width:900px){
    .stat{ padding:16px 12px; width:50%; border-left:none; border-top:1px solid var(--line); white-space:nowrap; }
    .stats{ flex-wrap:wrap; }
    .stat-v{ font-size:0.92rem; }
    .stat:nth-child(odd){ border-right:1px solid var(--line); }
    .tab-bar{ gap:32px; }
    .gallery{ padding:6vh 6vw 12vh; }
    .slideshow{ height:64vh; }
    .thumb{ width:72px; height:92px; }
    footer{ flex-direction:column; gap:10px; text-align:center; }
  }
  @media (prefers-reduced-motion: reduce){
    *, *::before, *::after{ animation:none !important; transition:none !important; }
    .name, .division, .stat, .scroll-cue, .mark, .slide, .tab-panel{ opacity:1 !important; transform:none !important; }
    .hero-video::after{ display:none; }
  }
  img{ -webkit-user-drag:none; user-drag:none; -webkit-user-select:none; user-select:none; }
</style>
</head>
<body>
  <a href="/" class="mark">Maison de Veux</a>

  ${hero?`<section class="hero-video">
    <div class="hero-fade-sides"></div>
    <div class="hero-fade"></div>
    <div class="video-wrap"><img src="${escHtml(hero.url)}" alt="${escHtml(name)}"></div>
    <div class="scroll-cue"><span>Scroll</span><span class="bar"></span></div>
  </section>`:''}

  <section class="identity">
    <div class="name-mask"><h1 class="name">${escHtml(first)}</h1></div>
    ${rest?`<div class="name-mask"><h1 class="name italic">${escHtml(rest)}</h1></div>`:''}
    ${stage?`<div class="division">${stage}</div>`:''}
    ${statsHtml}
  </section>

  ${workSection}

  <footer>
    <span>© Maison de Veux</span>
    ${stage?`<span>Board — ${stage}</span>`:''}
  </footer>

<script>
  var tabBtns = document.querySelectorAll('.tab-btn');
  var panels = { editorial: document.getElementById('panel-editorial'), digitals: document.getElementById('panel-digitals') };
  var underline = document.getElementById('tabUnderline');
  function positionUnderline(btn){ if(!btn||!underline)return; underline.style.width = btn.offsetWidth + 'px'; underline.style.left = btn.offsetLeft + 'px'; }
  function activateTab(name){
    tabBtns.forEach(function(b){ b.classList.toggle('active', b.dataset.tab === name); });
    Object.keys(panels).forEach(function(k){ if(panels[k])panels[k].classList.toggle('active', k === name); });
    positionUnderline(document.querySelector('.tab-btn[data-tab="'+name+'"]'));
  }
  tabBtns.forEach(function(btn){ btn.addEventListener('click', function(){ activateTab(btn.dataset.tab); }); });
  window.addEventListener('load', function(){ positionUnderline(document.querySelector('.tab-btn.active')); });
  window.addEventListener('resize', function(){ positionUnderline(document.querySelector('.tab-btn.active')); });
  function initSlideshow(root){
    if(!root)return;
    var slides = root.querySelectorAll('.slide');
    var thumbs = root.querySelectorAll('.thumb');
    var currentEl = root.querySelector('.slide-index .current');
    var prevBtn = root.querySelector('.slide-nav.prev');
    var nextBtn = root.querySelector('.slide-nav.next');
    var total = slides.length, index = 0, timer = null, DURATION = 5200;
    function render(){ slides.forEach(function(s,i){ s.classList.toggle('active', i === index); }); thumbs.forEach(function(t,i){ t.classList.toggle('active', i === index); }); if(currentEl)currentEl.textContent = String(index+1).padStart(2,'0'); }
    function goTo(i){ index = (i + total) % total; render(); restart(); }
    function next(){ goTo(index+1); }
    function prev(){ goTo(index-1); }
    function restart(){ clearTimeout(timer); timer = setTimeout(next, DURATION); }
    if(nextBtn)nextBtn.addEventListener('click', next);
    if(prevBtn)prevBtn.addEventListener('click', prev);
    thumbs.forEach(function(t,i){ t.addEventListener('click', function(){ goTo(i); }); });
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    render();
    if(!reduceMotion && total>1){ restart(); }
  }
  initSlideshow(document.getElementById('slideshow-editorial'));
  initSlideshow(document.getElementById('slideshow-digitals'));
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  document.addEventListener('dragstart', function(e){ e.preventDefault(); });
</script>
</body></html>`;
}
export const handler=async(event)=>{
  if(event.httpMethod!=='GET'&&event.httpMethod!=='HEAD')return shell(405,'Method Not Allowed','This public profile route only accepts browser requests.');
  const requested=safeKey(event.queryStringParameters?.profile||String(event.path||'').split('/').filter(Boolean).pop());
  if(!requested)return shell(404,'Profile Not Found','This Maison de Veux profile is not available.');
  try{
    const rpc=await fetch(SUPABASE_URL+'/rest/v1/rpc/website_public_model_profile',{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({target_profile:requested})});
    const profile=await rpc.json();
    if(!rpc.ok||!profile||profile.error||!profile.model)return shell(404,'Profile Not Found','This Maison de Veux profile is not published.');
    const route=safeKey(profile.model.legacy_key||requested);
    if(!route||route!==requested)return shell(404,'Profile Not Found','This Maison de Veux profile route is not available.');
    if(event.httpMethod==='HEAD')return {statusCode:200,headers:{'Content-Type':'text/html; charset=utf-8'},body:''};
    return {statusCode:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60, stale-while-revalidate=300','X-Content-Type-Options':'nosniff'},body:profileHtml(route,profile)};
  }catch(error){console.error('[model-profile-router]',error);return shell(503,'Profile Temporarily Unavailable','Please try this Maison de Veux profile again shortly.');}
};
