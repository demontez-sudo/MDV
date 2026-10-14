/* Contracts: attach the PDF to a contract and send it for e-signature from inside the portal.
   Shared by Finance & Legal → Contracts and by Scout Records → Deal.
   Flow: upload PDF (secure storage) → attach to the contract → create the signature request → add signers → email the secure signing link (/sign). */
(function(){
'use strict';
if(window.MDV_CONTRACTS)return;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function arr(v){return Array.isArray(v)?v:[];}
function bridge(){var b=window.VEUX_AGENT_V4;if(!b||!b.api)throw new Error('Secure session is not ready');return b;}
function org(){try{return bridge().state.org.slug||'maison-de-veux';}catch(e){return 'maison-de-veux';}}
function orgId(){try{return bridge().state.org.id||null;}catch(e){return null;}}
function post(path,body){return bridge().api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),__fresh:true});}
function legal(body){return post('/api/agent/legal',Object.assign({organization_slug:org()},body));}
function getLegal(){return bridge().api('/api/agent/legal?organization='+encodeURIComponent(org())+'&_t='+Date.now(),{method:'GET',headers:{},__fresh:true});}
function msg(e){return (e&&e.message)||String(e||'Something went wrong');}
function toast(m,bad){var o=document.querySelector('.ct-toast');if(o)o.remove();var d=document.createElement('div');d.className='ct-toast'+(bad?' bad':'');d.textContent=m;document.body.appendChild(d);setTimeout(function(){d.remove();},4200);}

var ALLOWED=/^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i;
var MAX=25*1048576;
function docsOf(contract){var t=contract&&contract.structured_terms;return t&&typeof t==='object'?arr(t.documents):[];}
function closed(status){return /^(completed|signed|declined|cancel|void|expired|rejected)/i.test(String(status||''));}

/* ---- documents ---- */
async function upload(file,contractId){
  if(!file)throw new Error('Choose a file first.');
  var mime=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'');
  if(!ALLOWED.test(mime))throw new Error('Use a PDF (or a Word file) for the contract.');
  if(file.size>MAX)throw new Error('That file is over 25 MB.');
  var oid=orgId();if(!oid)throw new Error('The organization is not loaded yet. Refresh and try again.');
  var start=await post('/api/storage/upload-url',{organization_id:oid,name:file.name,mime_type:mime,size_bytes:file.size,category:'contracts',visibility:'staff',resource_type:'contract',resource_id:contractId||null,visible_to_model:false,visible_to_partner:false});
  if(!start||!start.signed_url)throw new Error('The secure upload link was not returned.');
  var up=await fetch(start.signed_url,{method:'PUT',headers:{'Content-Type':mime},body:file});
  if(!up.ok)throw new Error('The upload failed ('+up.status+').');
  var fin=await post('/api/storage/finalize',{upload_session_id:start.upload_session_id,relationship:'contract_document',metadata:{source:'contract'}});
  var doc=fin&&fin.document;if(!doc||!doc.id)throw new Error('The upload could not be confirmed.');
  return doc;
}
async function attach(contractId,docId){
  var r=await legal({action:'attach_contract_document',contract_id:contractId,document_id:docId});
  if(!r||r.verified!==true)throw new Error('The PDF was not confirmed as attached.');
  return r;
}
async function detach(contractId,docId){
  var r=await legal({action:'remove_contract_document',contract_id:contractId,document_id:docId});
  if(!r||r.verified!==true)throw new Error('The PDF was not confirmed as removed.');
  return r;
}
async function openDoc(docId){
  try{
    var r=await bridge().api('/api/storage/download-url?document_id='+encodeURIComponent(docId),{method:'GET',headers:{},__fresh:true});
    if(!r||!r.url)throw new Error('The document is unavailable.');
    window.open(r.url,'_blank','noopener');
  }catch(e){toast(msg(e),true);}
}

/* ---- signing ---- */
async function findOpenRequest(contractId){
  var d=await getLegal();
  var reqs=arr(d.signature_requests).filter(function(x){return String(x.contract_id)===String(contractId);});
  return {open:reqs.filter(function(x){return !closed(x.status);})[0]||null,all:reqs,legal:d};
}
async function sendRequest(contractId,signers,opts){
  opts=opts||{};
  var existing=await findOpenRequest(contractId),req=existing.open,resend=false;
  if(req)resend=true;
  else{
    var created=await legal({action:'create_signature_request',contract_id:contractId,provider:'veux_sign',expires_at:opts.expires_at||null});
    req=created&&created.signature_request;
    if(!req||!req.id)throw new Error('The signature request could not be created.');
  }
  var list=arr(signers).filter(function(s){return s&&String(s.email||'').trim();});
  if(list.length)await legal({action:'add_signers',signature_request_id:req.id,signers:list});
  var oid=orgId();
  var out=await post('/api/agent/signature/send',{organization_id:oid,signature_request_id:req.id,resend:resend||undefined,expires_at:opts.expires_at||undefined});
  if(!out||out.verified!==true)throw new Error('The signing email was not confirmed as sent.');
  return {request:req,sent:arr(out.signers)};
}

/* ---- dialog ---- */
function dialog(o){
  o=o||{};
  var c=o.contract||{},docs=docsOf(c),signers=arr(o.signers).length?o.signers.slice(0,4):[{display_name:'',email:''}];
  var back=document.createElement('div');back.className='ct-back';
  function paint(){
    back.innerHTML='<section class="ct-dlg" role="dialog" aria-modal="true" aria-label="Send for e-signature"><header><div><small>E-SIGNATURE</small><h2>'+esc(c.title||'Contract')+'</h2></div><button type="button" data-x aria-label="Close">×</button></header>'
      +'<div class="ct-body">'
      +'<div class="ct-step"><b>1 · The contract PDF</b>'
      +(docs.length?docs.map(function(d){return '<p class="ct-doc">📄 '+esc(d.name||'Contract.pdf')+' <button type="button" class="ct-link" data-view="'+esc(d.id)+'">View</button></p>';}).join('')
        :'<p class="ct-warn">No PDF is attached yet. The signer would have nothing to read.</p>')
      +'<label class="ct-up">'+(docs.length?'Replace the PDF':'Upload the PDF')+'<input type="file" id="ct-file" accept="application/pdf,.pdf" hidden></label></div>'
      +'<div class="ct-step"><b>2 · Who needs to sign?</b>'
      +signers.map(function(s,i){return '<div class="ct-sg"><input data-sn="'+i+'" placeholder="Full name" value="'+esc(s.display_name||'')+'"><input data-se="'+i+'" type="email" placeholder="Email" value="'+esc(s.email||'')+'"></div>';}).join('')
      +(signers.length<4?'<button type="button" class="ct-link" data-addsg>+ Add another signer</button>':'')+'</div>'
      +'<div class="ct-step"><b>3 · Send</b><label class="ct-exp">Link valid for <select id="ct-days"><option value="7">7 days</option><option value="14" selected>14 days</option><option value="30">30 days</option></select></label>'
      +'<p class="ct-hint">Each signer gets an email with a secure link. They read the PDF and sign by typing their name. You will see the status here and in Finance &amp; Legal → Signatures.</p></div>'
      +'<p class="ct-err" id="ct-err"></p></div>'
      +'<footer><button type="button" class="ct-btn" data-x>Cancel</button><button type="button" class="ct-btn gold" id="ct-send">Send for signature</button></footer></section>';
    back.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){back.remove();};});
    back.querySelectorAll('[data-view]').forEach(function(b){b.onclick=function(){openDoc(b.dataset.view);};});
    var add=back.querySelector('[data-addsg]');if(add)add.onclick=function(){read();signers.push({display_name:'',email:''});paint();};
    var f=back.querySelector('#ct-file');
    if(f)f.onchange=async function(){
      var file=f.files&&f.files[0];if(!file)return;read();
      var err=back.querySelector('#ct-err');err.textContent='Uploading…';
      try{
        var doc=await upload(file,c.id);var r=await attach(c.id,doc.id);
        c.structured_terms=r.contract&&r.contract.structured_terms||c.structured_terms;docs=docsOf(c);
        if(o.onChange)o.onChange(r.contract);
        paint();
      }catch(e){err.textContent=msg(e);}
    };
    back.querySelector('#ct-send').onclick=send;
  }
  function read(){back.querySelectorAll('[data-sn]').forEach(function(i){signers[+i.dataset.sn].display_name=i.value.trim();});back.querySelectorAll('[data-se]').forEach(function(i){signers[+i.dataset.se].email=i.value.trim();});}
  async function send(){
    read();var err=back.querySelector('#ct-err'),btn=back.querySelector('#ct-send');err.textContent='';
    var list=signers.filter(function(s){return s.email;});
    if(!docs.length&&!window.confirm('There is no PDF attached. Send anyway?'))return;
    btn.disabled=true;btn.textContent='Sending…';
    try{
      var days=Number((back.querySelector('#ct-days')||{}).value)||14;
      var res=await sendRequest(c.id,list,{expires_at:new Date(Date.now()+days*864e5).toISOString()});
      back.remove();
      toast('Sent for signature to '+(res.sent.length||list.length)+' signer'+((res.sent.length||list.length)===1?'':'s')+'.');
      if(o.onSent)o.onSent(res);
    }catch(e){err.textContent=msg(e);btn.disabled=false;btn.textContent='Send for signature';}
  }
  document.body.appendChild(back);paint();
}

window.MDV_CONTRACTS={upload:upload,attach:attach,detach:detach,openDoc:openDoc,docsOf:docsOf,sendRequest:sendRequest,dialog:dialog,findOpenRequest:findOpenRequest,legal:legal,getLegal:getLegal,closed:closed,toast:toast};
})();
