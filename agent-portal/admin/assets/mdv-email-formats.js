/* Email formats: the team's saved emails (brand intro, casting submission, follow-ups, scouting approach ...).
   A format has blanks like {{contact.first_name}} that fill in from Contacts, Companies, Model Scouting and the roster.
   MDV_FORMATS.pick({preset, apply})  choose a format, pick who it is for, preview it, then use it (opens Mail with it filled in)
   MDV_FORMATS.manage()               the library: add, edit, duplicate, archive
   Data: /api/agent/email-formats. Sent mail is logged to Outreach with the contact, company and model it was for. */
(function(){
'use strict';
if(window.MDV_FORMATS)return;

var S={meta:null,formats:[],loaded:false,loading:null,setup:false};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function toast(m,bad){try{if(window.toast)return window.toast(m,bad?'bad':undefined);}catch(e){}}
function get(qs){return bridge().api('/api/agent/email-formats?organization='+encodeURIComponent(org())+(qs||'')+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function post(body){return bridge().api('/api/agent/email-formats',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({organization_slug:org()},body))});}
function label(list,key){var f=arr(list).filter(function(x){return x[0]===key;})[0];return f?f[1]:key;}

function load(force){
  if(S.loaded&&!force)return Promise.resolve(S);
  if(S.loading)return S.loading;
  S.loading=get('&all=1').then(function(d){S.meta={groups:arr(d.groups),situations:arr(d.situations),audiences:arr(d.audiences)};S.formats=arr(d.formats);S.setup=!!d.setup_needed;S.loaded=true;S.loading=null;return S;},function(e){S.loading=null;throw e;});
  return S.loading;
}

/* ---------- dialog shell ---------- */
function dialog(cls,html){
  var back=document.createElement('div');back.className='mf-back';
  back.innerHTML='<section class="mf-dlg '+cls+'" role="dialog" aria-modal="true">'+html+'</section>';
  document.body.appendChild(back);
  function close(){document.removeEventListener('keydown',onKey,true);back.remove();}
  function onKey(e){if(e.key==='Escape'){e.stopPropagation();close();}}
  document.addEventListener('keydown',onKey,true);
  back.addEventListener('mousedown',function(e){if(e.target===back)close();});
  back.querySelectorAll('[data-x]').forEach(function(b){b.onclick=close;});
  return {el:back,q:function(s){return back.querySelector(s);},close:close};
}

/* ---------- a small search box for contacts, companies, models and scouted people ---------- */
function finder(host,kind,placeholder,onPick,preset){
  var timer=null,seq=0,value=preset||null;
  host.classList.add('mf-find');
  host.innerHTML='<div class="mf-chosen" hidden></div><input type="text" class="mf-in" placeholder="'+esc(placeholder)+'" autocomplete="off"><ul class="mf-res" hidden></ul>';
  var inp=host.querySelector('input'),res=host.querySelector('ul'),chosen=host.querySelector('.mf-chosen');
  function showChosen(){
    if(value){chosen.hidden=false;inp.hidden=true;chosen.innerHTML='<span>'+esc(value.label)+(value.sub?'<small>'+esc(value.sub)+'</small>':'')+'</span><button type="button" aria-label="Clear">×</button>';chosen.querySelector('button').onclick=function(){value=null;onPick(null);showChosen();inp.focus();};}
    else{chosen.hidden=true;inp.hidden=false;}
  }
  function search(){
    var q=inp.value.trim(),my=++seq;
    get('&lookup='+kind+'&q='+encodeURIComponent(q)).then(function(d){
      if(my!==seq)return;var list=arr(d.results);res.hidden=!list.length;
      res.innerHTML=list.map(function(x,i){return '<li><button type="button" data-i="'+i+'"><b>'+esc(x.label)+'</b>'+(x.sub?'<small>'+esc(x.sub)+'</small>':'')+'</button></li>';}).join('');
      res.querySelectorAll('button').forEach(function(b){b.onclick=function(){value=list[+b.dataset.i];res.hidden=true;inp.value='';showChosen();onPick(value);};});
    },function(){res.hidden=true;});
  }
  inp.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(search,220);});
  inp.addEventListener('focus',function(){if(!inp.value)search();});
  document.addEventListener('click',function h(e){if(!host.isConnected){document.removeEventListener('click',h);return;}if(!host.contains(e.target))res.hidden=true;});
  showChosen();
  return {get:function(){return value;},set:function(v){value=v;showChosen();}};
}

/* ---------- pick a format and fill it ---------- */
function pick(opts){
  opts=opts||{};
  return load().then(function(){
    var preset=opts.preset||{},sel=null,aud=opts.audience||'all',query='',last=null,seq=0,timer=null;
    var d=dialog('mf-pick','<header><div><small>EMAIL FORMATS</small><h2>Use a format</h2></div><button type="button" class="mf-x" data-x aria-label="Close">×</button></header>'
      +'<div class="mf-cols"><aside class="mf-left"><input type="text" class="mf-in mf-q" placeholder="Search formats" aria-label="Search formats"><div class="mf-chips" id="mf-aud"></div><ul class="mf-list" id="mf-list"></ul>'
      +'<button type="button" class="mf-link" id="mf-manage">Manage formats</button></aside>'
      +'<div class="mf-right"><div class="mf-who"><label><span>Contact</span><div id="mf-f-contact"></div></label><label><span>Company</span><div id="mf-f-company"></div></label><label><span>Model</span><div id="mf-f-model"></div></label><label><span>Scouted person</span><div id="mf-f-prospect"></div></label></div>'
      +'<div class="mf-prev" id="mf-prev"><p class="mf-empty">Choose a format on the left.</p></div></div></div>'
      +'<footer><span class="mf-note" id="mf-note"></span><button type="button" class="mf-btn" data-x>Cancel</button><button type="button" class="mf-btn gold" id="mf-use" disabled>Use this format</button></footer>');
    var F={};
    function ids(){return {contact_id:F.contact&&F.contact.get()?F.contact.get().id:null,company_id:F.company&&F.company.get()?F.company.get().id:null,model_id:F.model&&F.model.get()?F.model.get().id:null,prospect_id:F.prospect&&F.prospect.get()?F.prospect.get().id:null};}
    function visible(){var q=query.toLowerCase();return S.formats.filter(function(f){return f.active&&(aud==='all'||f.audience===aud||f.audience==='any')&&(!q||(f.name+' '+f.subject).toLowerCase().indexOf(q)>-1);});}
    function paintList(){
      var chips=[['all','All']].concat(S.meta.audiences.filter(function(a){return a[0]!=='any';}));
      d.q('#mf-aud').innerHTML=chips.map(function(c){return '<button type="button" class="mf-chip'+(aud===c[0]?' on':'')+'" data-a="'+c[0]+'">'+esc(c[1])+'</button>';}).join('');
      d.q('#mf-aud').querySelectorAll('button').forEach(function(b){b.onclick=function(){aud=b.dataset.a;paintList();};});
      var list=visible();
      d.q('#mf-list').innerHTML=list.length?list.map(function(f){return '<li><button type="button" class="mf-fmt'+(sel&&sel.id===f.id?' on':'')+'" data-id="'+esc(f.id)+'"><b>'+esc(f.name)+'</b><small>'+esc(label(S.meta.situations,f.situation))+' · '+esc(label(S.meta.audiences,f.audience))+'</small></button></li>';}).join(''):'<li class="mf-empty">'+(S.setup?'Formats are not set up yet. Run the email formats SQL in Supabase.':'No formats match.')+'</li>';
      d.q('#mf-list').querySelectorAll('.mf-fmt').forEach(function(b){b.onclick=function(){sel=S.formats.filter(function(f){return f.id===b.dataset.id;})[0];paintList();preview();};});
    }
    function blanksMark(text,missing){
      var out=esc(text);
      arr(missing).forEach(function(k){out=out.split('{{'+k+'}}').join('<mark class="mf-blank">{{'+k+'}}</mark>');});
      return out;
    }
    function preview(){
      if(!sel){return;}
      var my=++seq,box=d.q('#mf-prev');box.classList.add('busy');
      post(Object.assign({action:'render',template_id:sel.id},ids())).then(function(r){
        if(my!==seq)return;last=r;box.classList.remove('busy');
        box.innerHTML='<div class="mf-row"><span>To</span><b>'+(r.to?esc(r.to):'<em>Add the recipient in Mail</em>')+'</b></div><div class="mf-row"><span>Subject</span><b>'+blanksMark(r.subject,r.missing)+'</b></div><pre class="mf-body">'+blanksMark(r.body,r.missing)+'</pre>';
        d.q('#mf-note').innerHTML=r.missing.length?'<span class="mf-warn">'+r.missing.length+' blank'+(r.missing.length>1?'s':'')+' still to fill: '+r.missing.map(function(k){return esc(k);}).join(', ')+'. Pick the record above, or fill them in Mail before sending.</span>':'All blanks filled.';
        d.q('#mf-use').disabled=false;
      },function(e){if(my!==seq)return;box.classList.remove('busy');box.innerHTML='<p class="mf-err">'+esc(msg(e))+'</p>';d.q('#mf-use').disabled=true;});
    }
    function changed(kind){return function(v){
      if(kind==='contact'&&v&&v.company_id&&F.company&&!F.company.get()){/* the company is found from the contact on the server */}
      clearTimeout(timer);timer=setTimeout(preview,120);
    };}
    F.contact=finder(d.q('#mf-f-contact'),'contact','Search contacts',changed('contact'),preset.contact);
    F.company=finder(d.q('#mf-f-company'),'company','Search companies',changed('company'),preset.company);
    F.model=finder(d.q('#mf-f-model'),'model','Search the roster',changed('model'),preset.model);
    F.prospect=finder(d.q('#mf-f-prospect'),'prospect','Search scouting',changed('prospect'),preset.prospect);
    d.q('.mf-q').addEventListener('input',function(){query=this.value;paintList();});
    d.q('#mf-manage').onclick=function(){d.close();manage();};
    d.q('#mf-use').onclick=function(){
      if(!last)return;
      var out={to:opts.to||last.to,subject:last.subject,body:last.body,link:Object.assign({},last.link,{to_email:opts.to||last.to||null}),missing:last.missing};
      d.close();
      if(typeof opts.apply==='function'){opts.apply(out);return;}
      if(window.MDV_MAIL&&MDV_MAIL.emailTo){
        if(out.to)MDV_MAIL.emailTo([out.to],{subject:out.subject,text:out.body,link:out.link});
        else MDV_MAIL.newMessage({subject:out.subject,text:out.body,link:out.link});
      }else toast('Open Mail to send this.',true);
    };
    if(opts.audience)aud=opts.audience;
    if(opts.template_id)sel=S.formats.filter(function(f){return f.id===opts.template_id;})[0]||null;
    paintList();if(sel)preview();
    return d;
  }).catch(function(e){toast(msg(e),true);});
}

/* ---------- the library ---------- */
function manage(){
  return load(true).then(function(){
    var d=dialog('mf-manage','<header><div><small>EMAIL FORMATS</small><h2>Your formats</h2></div><button type="button" class="mf-x" data-x aria-label="Close">×</button></header><div class="mf-body-wrap" id="mf-m"></div>');
    var editing=null,showArchived=false;
    function listView(){
      editing=null;
      var rows=S.formats.filter(function(f){return showArchived?!f.active:f.active;});
      d.q('#mf-m').innerHTML='<div class="mf-bar"><button type="button" class="mf-btn gold" id="mf-new">+ New format</button><label class="mf-chk"><input type="checkbox" id="mf-arch"'+(showArchived?' checked':'')+'> Show archived</label></div>'
        +(rows.length?'<ul class="mf-table">'+rows.map(function(f){return '<li><div><b>'+esc(f.name)+'</b><small>'+esc(label(S.meta.situations,f.situation))+' · '+esc(label(S.meta.audiences,f.audience))+'</small><p>'+esc(f.subject)+'</p></div><div class="mf-acts"><button type="button" class="mf-btn sm" data-a="edit" data-id="'+esc(f.id)+'">Edit</button><button type="button" class="mf-btn sm" data-a="use" data-id="'+esc(f.id)+'">Use</button><button type="button" class="mf-btn sm" data-a="dup" data-id="'+esc(f.id)+'">Duplicate</button><button type="button" class="mf-btn sm" data-a="'+(f.active?'archive':'restore')+'" data-id="'+esc(f.id)+'">'+(f.active?'Archive':'Restore')+'</button></div></li>';}).join('')+'</ul>':'<p class="mf-empty">'+(showArchived?'Nothing archived.':(S.setup?'Formats are not set up yet. Run the email formats SQL in Supabase.':'No formats yet. Add your first one.'))+'</p>');
      d.q('#mf-new').onclick=function(){editView({name:'',situation:'intro',audience:'brand',subject:'',body:''});};
      d.q('#mf-arch').onchange=function(){showArchived=this.checked;listView();};
      d.q('#mf-m').querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){act(b.dataset.a,b.dataset.id);};});
    }
    function byId(id){return S.formats.filter(function(f){return f.id===id;})[0];}
    function act(a,id){
      var f=byId(id);if(!f)return;
      if(a==='edit')return editView(f);
      if(a==='use'){d.close();return pick({template_id:id});}
      post({action:a,id:id}).then(function(){return load(true);}).then(function(){toast(a==='dup'?'Copy created':a==='archive'?'Archived':'Restored');listView();},function(e){toast(msg(e),true);});
    }
    function editView(f){
      editing=f;var isNew=!f.id;
      var opts=function(list,cur){return list.map(function(x){return '<option value="'+x[0]+'"'+(cur===x[0]?' selected':'')+'>'+esc(x[1])+'</option>';}).join('');};
      var ins=S.meta.groups.map(function(g){return '<optgroup label="'+esc(g.label)+'">'+g.vars.map(function(v){return '<option value="'+g.key+'.'+v[0]+'">'+esc(g.label+': '+v[1])+'</option>';}).join('')+'</optgroup>';}).join('');
      d.q('#mf-m').innerHTML='<div class="mf-form"><label><span>Name</span><input class="mf-in" id="mf-name" maxlength="120" value="'+esc(f.name)+'" placeholder="e.g. Brand introduction"></label>'
        +'<div class="mf-two"><label><span>Situation</span><select class="mf-in" id="mf-sit">'+opts(S.meta.situations,f.situation)+'</select></label><label><span>Who it is for</span><select class="mf-in" id="mf-aud2">'+opts(S.meta.audiences,f.audience)+'</select></label></div>'
        +'<label><span>Subject</span><input class="mf-in" id="mf-sub" maxlength="300" value="'+esc(f.subject)+'" placeholder="Subject line"></label>'
        +'<label><span>Message</span><textarea class="mf-in mf-ta" id="mf-text" placeholder="Write the email. Use the list to add blanks.">'+esc(f.body)+'</textarea></label>'
        +'<div class="mf-ins"><select class="mf-in" id="mf-ins"><option value="">Insert a blank…</option>'+ins+'</select><small>Add <code>|word</code> for a fallback, e.g. <code>{{contact.first_name|there}}</code>.</small></div>'
        +'<p class="mf-err" id="mf-err"></p><div class="mf-bar end"><button type="button" class="mf-btn" id="mf-back">Back</button><button type="button" class="mf-btn gold" id="mf-save">'+(isNew?'Create format':'Save changes')+'</button></div></div>';
      var last='mf-text';
      d.q('#mf-sub').addEventListener('focus',function(){last='mf-sub';});d.q('#mf-text').addEventListener('focus',function(){last='mf-text';});
      d.q('#mf-ins').onchange=function(){
        var v=this.value;if(!v)return;var el=d.q('#'+last),s=el.selectionStart==null?el.value.length:el.selectionStart,e=el.selectionEnd==null?s:el.selectionEnd,tag='{{'+v+'}}';
        el.value=el.value.slice(0,s)+tag+el.value.slice(e);el.focus();el.selectionStart=el.selectionEnd=s+tag.length;this.value='';
      };
      d.q('#mf-back').onclick=listView;
      d.q('#mf-save').onclick=function(){
        var btn=this,body={action:isNew?'create':'update',id:f.id,name:d.q('#mf-name').value,situation:d.q('#mf-sit').value,audience:d.q('#mf-aud2').value,subject:d.q('#mf-sub').value,body:d.q('#mf-text').value};
        btn.disabled=true;d.q('#mf-err').textContent='';
        post(body).then(function(){return load(true);}).then(function(){toast(isNew?'Format created':'Saved');listView();},function(e){d.q('#mf-err').textContent=msg(e);btn.disabled=false;});
      };
    }
    listView();
    return d;
  }).catch(function(e){toast(msg(e),true);});
}

window.MDV_FORMATS={pick:pick,manage:manage,load:load,state:S};

/* Buttons anywhere in the portal: data-format-contact="<id>", data-format-company="<id>", data-format-prospect="<id>" open the picker with that record filled in. */
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest?e.target.closest('[data-format-contact],[data-format-company],[data-format-prospect],[data-format-open]'):null;
  if(!b)return;
  e.preventDefault();e.stopPropagation();
  var preset={},aud;
  if(b.dataset.formatContact)preset.contact={id:b.dataset.formatContact,label:b.dataset.formatLabel||'Contact',sub:b.dataset.formatSub||''};
  if(b.dataset.formatCompany)preset.company={id:b.dataset.formatCompany,label:b.dataset.formatCompanyLabel||b.dataset.formatLabel||'Company',sub:''};
  if(b.dataset.formatProspect){preset.prospect={id:b.dataset.formatProspect,label:b.dataset.formatLabel||'Scouted person',sub:''};aud='scout';}
  if(b.dataset.formatAudience)aud=b.dataset.formatAudience;
  pick({preset:preset,audience:aud,to:b.dataset.formatTo||''});
},true);
})();
