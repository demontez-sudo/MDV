import crypto from 'node:crypto';
import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { deliverEmailMessage, emailDeliveryStatus, requireEmailDelivery } from './_lib/email.mjs';

async function rows(query){const {data,error}=await query;if(error)throw error;return data||[];}
function hashToken(token){return crypto.createHash('sha256').update(token).digest('hex');}
function cleanEmail(v){const s=String(v||'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:null;}
function slugify(v){return String(v||'package').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'package';}
function escHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function normalizePublicBase(v){let raw=String(v||'').trim();if(!raw)return 'https://www.maisondeveux.com';if(!/^https?:\/\//i.test(raw))raw='https://'+raw;try{const u=new URL(raw);if(/(^|\.)maisondeveux\.com$/i.test(u.hostname)){u.protocol='https:';u.hostname='www.maisondeveux.com';u.pathname='';u.search='';u.hash='';return u.origin;}u.pathname='';u.search='';u.hash='';return u.origin;}catch{return 'https://www.maisondeveux.com';}}
function deliveryConfig(settings,user,organization){const sender=cleanEmail(settings?.sender_email)||cleanEmail(process.env.VEUX_DEFAULT_SENDER_EMAIL)||cleanEmail(user?.email)||null;const status=emailDeliveryStatus({senderEmail:sender});return {...status,sender_name:settings?.sender_name||organization?.name||'Maison de Veux',sender_email:sender,reply_to_email:cleanEmail(settings?.reply_to_email)||cleanEmail(user?.email)||null,public_package_base:normalizePublicBase(settings?.package_domain||'https://www.maisondeveux.com')};}

function parsePackageBody(event){return parseBody(event);}

async function packageEmailPreview(admin,organizationId,packageId){
  const packageModels=await rows(admin.from('package_models').select('id,model_id,sort_order').eq('organization_id',organizationId).eq('package_id',packageId).eq('visible',true).order('sort_order'));
  if(!packageModels.length)return [];
  const modelIds=packageModels.map(x=>x.model_id);
  const [models,profiles,measurements,selected,fallback]=await Promise.all([
    rows(admin.from('models').select('id,display_name,primary_market_label,stage,legacy_key,public_slug').eq('organization_id',organizationId).in('id',modelIds)),
    rows(admin.from('model_public_profiles').select('model_id,published,metadata').eq('organization_id',organizationId).in('model_id',modelIds)),
    rows(admin.from('model_measurements').select('model_id,height_display,bust_display,chest_display,waist_display,hips_display').eq('organization_id',organizationId).in('model_id',modelIds)),
    rows(admin.from('package_model_media').select('package_model_id,sort_order,model_media(id,model_id,url,is_primary,is_public)').in('package_model_id',packageModels.map(x=>x.id)).order('sort_order')),
    rows(admin.from('model_media').select('id,model_id,url,is_primary,is_public,sort_order').eq('organization_id',organizationId).in('model_id',modelIds).eq('is_public',true).order('sort_order'))
  ]);
  const modelMap=new Map(models.map(x=>[x.id,x]));
  const profileMap=new Map(profiles.map(x=>[x.model_id,x]));
  const measurementMap=new Map(measurements.map(x=>[x.model_id,x]));
  const selectedMap=new Map();
  selected.forEach(x=>{if(x.model_media?.is_public&&!selectedMap.has(x.package_model_id))selectedMap.set(x.package_model_id,x.model_media)});
  const fallbackMap=new Map();
  fallback.forEach(x=>{const prev=fallbackMap.get(x.model_id);if(!prev||x.is_primary)fallbackMap.set(x.model_id,x)});
  return packageModels.map(pm=>{const m=modelMap.get(pm.model_id)||{},pp=profileMap.get(pm.model_id)||{},mm=measurementMap.get(pm.model_id)||{},wm=pp.metadata&&pp.metadata.website_profile||{},route=String(wm.route_key||m.legacy_key||m.public_slug||'').trim(),media=selectedMap.get(pm.id)||fallbackMap.get(pm.model_id)||{};return {...m,height_display:mm.height_display||null,bust_display:mm.bust_display||mm.chest_display||null,waist_display:mm.waist_display||null,hips_display:mm.hips_display||null,image_url:media.url||null,profile_url:pp.published&&route?'https://www.maisondeveux.com/'+encodeURIComponent(route):null}}).slice(0,20);
}

function buildPackageEmailHtml({organization,settings,user,recipient,pkg,intro,publicUrl,preview,packageMarket}){
  const items=Array.isArray(preview)?preview:[];
  const shown=items.slice(0,20);
  const count=items.length||shown.length||1;
  const agencyName=escHtml(organization?.name||'Maison de Veux');
  const recipientName=escHtml(recipient?.display_name||'');
  const greeting=recipientName?`Dear ${recipientName},`:'Hello,';
  const marketRaw=String(packageMarket||shown.find(x=>x?.primary_market_label)?.primary_market_label||'New York').trim();
  const market=escHtml(marketRaw||'New York');
  const safeIntro=escHtml(intro||`Maison de Veux has prepared a private selection of models currently available in ${marketRaw||'New York'} for castings, fittings, shoots and runway. Each model has been selected specifically for your consideration.`);

  const masthead=`PRIVATE CASTING · ${market.toUpperCase()}`;

  // HARD SINGLE-MODEL TEMPLATE:
  // Do not reuse the multi-model contact-sheet hero. Email clients can stretch percentage-based
  // cells when only one item exists. A one-model package gets a dedicated fixed-width portrait.
  if(items.length===1){
    const m=items[0]||{};
    const modelName=escHtml(m.display_name||pkg?.title||'Model');
    const modelHref=`${publicUrl}#model-${encodeURIComponent(m.id||'')}`;
    const sub=[m.primary_market_label||marketRaw,'Available',m.stage].filter(Boolean).map(escHtml).join(' · ');
    const img=m.image_url
      ? `<img src="${escHtml(m.image_url)}" alt="${modelName}" width="180" style="display:block;width:180px!important;max-width:180px!important;height:auto!important;border:0;outline:none;text-decoration:none;margin:0 auto">`
      : `<table role="presentation" width="180" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td height="240" align="center" style="background:#e6ddd0;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#8c7e6e">${escHtml((m.display_name||'M').slice(0,1))}</td></tr></table>`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f2ede5;color:#171512"><div style="display:none!important;max-height:0;overflow:hidden;opacity:0">MDV PACKAGE EMAIL BUILD 16.12.28</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f2ede5">
<tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="700" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%;max-width:700px;background:#f5f0e7;border:1px solid #d8cdbd">

<tr><td align="center" style="padding:23px 38px 19px;border-bottom:1px solid #d8cdbd">
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:2.5px;text-transform:uppercase;color:#8d8174">New York / Paris</div>
  <div style="padding-top:8px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.05">${agencyName}</div>
  <div style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:2.5px;text-transform:uppercase;color:#756c61">${masthead}</div>
  <div style="width:42px;height:1px;background:#a57a42;margin:14px auto 0"></div>
</td></tr>

<tr><td align="center" style="padding:28px 32px 18px">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:29px;letter-spacing:.7px;text-transform:uppercase">A Private Selection</div>
  <div style="padding-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:2.3px;text-transform:uppercase;color:#756c61">Curated for your review</div>
  <div style="padding-top:11px;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:1.7px;text-transform:uppercase;color:#756c61">1 model · ${market} · currently available</div>
</td></tr>

<tr><td align="center" style="padding:4px 32px 22px">
  <table role="presentation" width="220" cellspacing="0" cellpadding="0" border="0" align="center" style="width:220px;max-width:220px">
    <tr><td align="center">${img}</td></tr>
    <tr><td align="center" style="padding:13px 10px 0">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.05;text-transform:uppercase">${modelName}</div>
      <div style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:1.2px;text-transform:uppercase;color:#756c61">${sub}</div>
    </td></tr>
  </table>
</td></tr>

<tr><td style="padding:0 44px 22px">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.55;color:#5a5046">${greeting}</div>
  <div style="padding-top:9px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.58;color:#5a5046">${safeIntro}</div>
</td></tr>

<tr><td align="center" style="padding:0 44px 18px">
  <a href="${escHtml(modelHref)}" target="_blank" rel="noopener noreferrer" style="display:block;background:#171512;color:#f5f0e7;text-decoration:none;padding:17px 18px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">View ${modelName} →</a>
</td></tr>
<tr><td align="center" style="padding:0 44px 31px">
  <a href="${escHtml(publicUrl)}#request" target="_blank" rel="noopener noreferrer" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:1.7px;text-transform:uppercase;color:#a57a42;text-decoration:none">Request Availability →</a>
</td></tr>


<tr><td align="center" style="padding:0 28px 26px">
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:1.6;color:#756c61">
    Having trouble opening the package on mobile?<br>
    <a href="${escHtml(publicUrl)}" target="_blank" rel="noopener noreferrer" style="color:#a57a42;text-decoration:underline;word-break:break-all">Open the private selection in your browser</a>
  </div>
</td></tr>
<tr><td style="padding:17px 28px;background:#171512;color:#e9dfd0">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:1.4px;text-transform:uppercase">Private &amp; Confidential</td>
    <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:1.4px;text-transform:uppercase">Maison de Veux</td>
  </tr></table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
  }


  const portrait=(m,h=188)=>{
    if(!m?.image_url)return `<div style="height:${h}px;background:#e6ddd0;display:table;width:100%;text-align:center"><div style="display:table-cell;vertical-align:middle;font-family:Georgia,serif;font-size:24px;color:#8c7e6e">${escHtml((m?.display_name||'M').slice(0,1))}</div></div>`;
    return `<img src="${escHtml(m.image_url)}" alt="${escHtml(m.display_name||'Maison de Veux model')}" width="310" style="display:block;width:100%;max-width:100%;height:auto;border:0;outline:none;text-decoration:none">`;
  };

  const singleModel=shown.length===1;
  const heroCells=singleModel
    ? `<td align="center" style="padding:0"><div style="width:280px;max-width:72%;margin:0 auto">${portrait(shown[0],340)}</div></td>`
    : shown.slice(0,3).map(m=>`<td width="33.333%" valign="top" style="padding:0 1px">${portrait(m,165)}</td>`).join('');
  const cardCells=[];
  for(let i=0;i<shown.length;i++){
    const m=shown[i],href=`${publicUrl}#model-${encodeURIComponent(m.id||'')}`;
    const sub=[m.primary_market_label||marketRaw,'Available',m.stage].filter(Boolean).map(escHtml).join(' · ');
    cardCells.push(`<td class="model-card" width="33.333%" valign="top" style="width:33.333%;padding:0 6px 20px">
      <a href="${escHtml(href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:#171512;display:block">
        ${portrait(m,180)}
        <div style="padding:13px 12px 15px;border:1px solid #d8cdbd;border-top:0;background:#f8f3eb">
          <div style="font-family:Arial,sans-serif;font-size:9px;letter-spacing:1.8px;color:#a57a42">${String(i+1).padStart(2,'0')}</div>
          <div style="padding-top:6px;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.06;text-transform:uppercase">${escHtml(m.display_name||'Model')}</div>
          <div style="padding-top:6px;font-family:Arial,sans-serif;font-size:8px;line-height:1.5;letter-spacing:1.2px;text-transform:uppercase;color:#756c61">${sub}</div>
          <div style="padding-top:12px;font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#171512">View Model →</div>
        </div>
      </a>
    </td>`);
  }
  const previewRows=[];
  for(let i=0;i<cardCells.length;i+=3){
    previewRows.push(`<tr>${cardCells[i]||'<td width="33.333%"></td>'}${cardCells[i+1]||'<td width="33.333%"></td>'}${cardCells[i+2]||'<td width="33.333%"></td>'}</tr>`);
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@media only screen and (max-width:560px){
  .shell{width:100%!important}
  .pad{padding-left:22px!important;padding-right:22px!important}
  .hero-title{font-size:38px!important}
  .model-card{width:33.333%!important;display:table-cell!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:#f2ede5;color:#171512">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f2ede5">
<tr><td align="center" style="padding:20px 10px">
<table class="shell" role="presentation" width="700" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:700px;background:#f5f0e7;border:1px solid #d8cdbd">

<tr><td class="pad" align="center" style="padding:24px 42px 20px;border-bottom:1px solid #d8cdbd">
  <div style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:2.5px;text-transform:uppercase;color:#8d8174">New York / Paris</div>
  <div style="padding-top:9px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.05">${agencyName}</div>
  <div style="padding-top:9px;font-family:Arial,sans-serif;font-size:8px;letter-spacing:2.6px;text-transform:uppercase;color:#756c61">${masthead}</div>
  <div style="width:46px;height:1px;background:#a57a42;margin:15px auto 0"></div>
</td></tr>

<tr><td class="pad" style="padding:28px 42px 12px;text-align:left"><div style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:2px;color:#a57a42;text-transform:uppercase;padding-bottom:12px">Casting Edit / 001</div>
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:31px;letter-spacing:-.3px;text-transform:uppercase">A Private <span style="color:#a57a42;font-style:italic;text-transform:none">Selection</span></div>
  <div style="padding-top:8px;font-family:Arial,sans-serif;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#756c61">Curated for your review</div>
  <div style="padding-top:13px;font-family:Arial,sans-serif;font-size:8px;letter-spacing:1.8px;text-transform:uppercase;color:#756c61">${count} model${count===1?'':'s'} · ${market} · currently available</div>
</td></tr>

<tr><td style="padding:${singleModel?'8px 22px 20px':'8px 22px 26px'}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${heroCells||'<td style="height:165px;background:#e6ddd0"></td>'}</tr></table>
</td></tr>

<tr><td class="pad" style="padding:0 42px 26px">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.55;color:#5a5046">${greeting}</div>
  <div style="padding-top:10px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.6;color:#5a5046">${safeIntro}</div>
</td></tr>

<tr><td class="pad" align="center" style="padding:0 42px 32px">
  <a href="${escHtml(publicUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;background:#171512;color:#f5f0e7;text-decoration:none;padding:18px 20px;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">View Private Selection →</a>
</td></tr>

<tr><td class="pad" style="padding:0 32px 12px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td style="padding:16px 10px 12px;border-top:1px solid #d8cdbd;font-family:Arial,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#756c61">Your Private Selection</td>
    <td align="right" style="padding:16px 10px 12px;border-top:1px solid #d8cdbd;font-family:Arial,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#756c61">${String(count).padStart(2,'0')} Models</td></tr>
  </table>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${previewRows.join('')}</table>
</td></tr>

<tr><td class="pad" style="padding:22px 42px 10px;border-top:1px solid #d8cdbd">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:#5a5046">Please let us know if you would like additional materials, current availability, or to arrange a casting or fitting.</div>
</td></tr>
<tr><td class="pad" align="center" style="padding:15px 42px 34px">
  <a href="${escHtml(publicUrl)}#request" target="_blank" rel="noopener noreferrer" style="display:block;background:#171512;color:#f5f0e7;text-decoration:none;padding:17px 20px;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Request Availability →</a>
  <div style="padding-top:20px;font-family:Arial,sans-serif;font-size:8px;line-height:1.7;letter-spacing:1.7px;text-transform:uppercase;color:#756c61">Represented by Maison de Veux · New York / Paris</div>
</td></tr>

<tr><td style="padding:18px 28px;background:#171512;color:#e9dfd0">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:1.5px;text-transform:uppercase">Private &amp; Confidential</td>
    <td align="right" style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:1.5px;text-transform:uppercase">Maison de Veux</td>
  </tr></table>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

async function getPackage(admin,orgId,packageId){
  const {data,error}=await admin.from('packages').select('*').eq('organization_id',orgId).eq('id',packageId).maybeSingle();
  if(error)throw error;
  if(!data){const e=new Error('Package not found');e.statusCode=404;throw e;}
  return data;
}

async function replacePackageContent(admin,organization,pkg,body,user){
  const title=String(body.title??pkg?.title??'').trim();
  const modelIds=[...new Set((Array.isArray(body.model_ids)?body.model_ids:[]).filter(Boolean).map(String))];
  if(!title){const e=new Error('Package title is required');e.statusCode=400;throw e;}
  if(!modelIds.length){const e=new Error('Select at least one model');e.statusCode=400;throw e;}

  const validModels=await rows(admin.from('models').select('id').eq('organization_id',organization.id).in('id',modelIds));
  if(validModels.length!==modelIds.length){const e=new Error('One or more selected models are unavailable');e.statusCode=400;throw e;}

  const companyId=body.company_id||null,contactId=body.primary_contact_id||body.contact_id||null,marketId=body.market_id||null;
  const lookups=await Promise.all([
    companyId?admin.from('companies').select('id,name').eq('organization_id',organization.id).eq('id',companyId).maybeSingle():Promise.resolve({data:null,error:null}),
    contactId?admin.from('contacts').select('id,company_id,display_name,email').eq('organization_id',organization.id).eq('id',contactId).maybeSingle():Promise.resolve({data:null,error:null}),
    marketId?admin.from('markets').select('id,name').eq('organization_id',organization.id).eq('id',marketId).eq('active',true).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  for(const x of lookups)if(x.error)throw x.error;
  const company=lookups[0].data,contact=lookups[1].data,market=lookups[2].data;
  if(companyId&&!company){const e=new Error('Selected client / brand is unavailable');e.statusCode=400;throw e;}
  if(contactId&&!contact){const e=new Error('Selected contact is unavailable');e.statusCode=400;throw e;}
  if(marketId&&!market){const e=new Error('Selected market is unavailable');e.statusCode=400;throw e;}
  if(company&&contact&&contact.company_id&&contact.company_id!==company.id){const e=new Error('Selected contact does not belong to the selected client / brand');e.statusCode=400;throw e;}

  const currentMeta=pkg?.metadata||{};
  const assetTypes=Array.isArray(body.asset_types)?[...new Set(body.asset_types.map(String).filter(Boolean))]:Array.isArray(currentMeta.asset_types)?currentMeta.asset_types:['headshots','digitals','polaroids','editorial','runway','comp_card'];
  const profileFields=Array.isArray(body.profile_fields)?[...new Set(body.profile_fields.map(String).filter(Boolean))]:Array.isArray(currentMeta.profile_fields)?currentMeta.profile_fields:['bio','measurements','availability','socials','experience','languages','travel_visa'];
  const bulkRecipientContactIds=Array.isArray(body.bulk_recipient_contact_ids)?[...new Set(body.bulk_recipient_contact_ids.map(String).filter(Boolean))]:Array.isArray(currentMeta.bulk_recipient_contact_ids)?currentMeta.bulk_recipient_contact_ids:[];
  const nextMeta={...currentMeta,updated_from:'agent_package_desk',package_type:String(body.package_type||currentMeta.package_type||'casting'),submission_date:body.submission_date||currentMeta.submission_date||null,asset_types:assetTypes,profile_fields:profileFields,bulk_recipient_contact_ids:bulkRecipientContactIds,subject_line:String(body.subject||currentMeta.subject_line||'').trim()||null,send_timing:String(body.send_timing||currentMeta.send_timing||'send_now'),scheduled_for:body.scheduled_for||currentMeta.scheduled_for||null};
  const status=['draft','ready'].includes(String(body.status||''))?String(body.status):(['draft','ready'].includes(pkg?.status)?pkg.status:'draft');

  const mediaByModel=(body.media_by_model&&typeof body.media_by_model==='object')?body.media_by_model:{};
  const allMedia=await rows(admin.from('model_media').select('id,model_id,media_type,category,is_primary,is_public,sort_order').eq('organization_id',organization.id).in('model_id',modelIds).eq('is_public',true).order('sort_order'));
  const mediaLookup=new Map(allMedia.map(m=>[m.id,m]));
  const categoryMatches=(m)=>{const hay=String((m.category||'')+' '+(m.media_type||'')).toLowerCase();if(m.is_primary&&assetTypes.includes('headshots'))return true;if(assetTypes.includes('digitals')&&/digital/.test(hay))return true;if(assetTypes.includes('polaroids')&&/polaroid/.test(hay))return true;if(assetTypes.includes('editorial')&&/editorial|campaign|beauty|fashion/.test(hay))return true;if(assetTypes.includes('runway')&&/runway|catwalk/.test(hay))return true;if(assetTypes.includes('video')&&/video/.test(hay))return true;return false;};
  const selectedByModel={};
  for(const modelId of modelIds){
    const available=allMedia.filter(m=>m.model_id===modelId);
    const requested=(Array.isArray(mediaByModel[modelId])?mediaByModel[modelId]:[]).map(String).filter(id=>mediaLookup.get(id)?.model_id===modelId);
    let chosen=requested;
    if(!chosen.length){const matched=available.filter(categoryMatches),primary=available.find(m=>m.is_primary);chosen=[...(primary?[primary.id]:[]),...matched.filter(m=>!primary||m.id!==primary.id).map(m=>m.id),...available.filter(m=>!primary||m.id!==primary.id).map(m=>m.id)].slice(0,8);}
    selectedByModel[modelId]=[...new Set(chosen)].slice(0,12);
  }

  const recipientEmail=cleanEmail(body.recipient_email)||cleanEmail(contact?.email);
  const recipientName=String(body.recipient_name||contact?.display_name||'').trim()||null;
  const recipient=(recipientEmail||contact?.id)?{company_id:company?.id||null,contact_id:contact?.id||null,email:recipientEmail,display_name:recipientName,metadata:{source:'agent_package_builder'}}:null;
  const payload={title,slug:pkg?.slug||body.slug||`${slugify(title)}-${Date.now().toString(36)}`,company_id:company?.id||null,primary_contact_id:contact?.id||null,market_id:market?.id||null,status,intro_message:String(body.intro_message||'').trim()||null,private_note:String(body.private_note||'').trim()||null,layout_key:body.layout_key||pkg?.layout_key||'editorial-grid',expires_at:body.expires_at||null,metadata:nextMeta};
  const {data:saved,error}=await admin.rpc('save_package_draft_v1',{target_org:organization.id,target_package:pkg?.id||null,target_payload:payload,target_model_ids:modelIds,target_media_by_model:selectedByModel,target_recipient:recipient,target_user:user.id});
  if(error)throw error;if(!saved?.verified||!saved?.package){const e=new Error('Package save could not be verified.');e.statusCode=500;e.publicMessage='Package was not confirmed as saved. Please retry.';throw e;}
  return {pkg:saved.package,recipient:saved.recipient||null,verified:true,persisted_at:saved.persisted_at,model_count:saved.model_count,media_count:saved.media_count};
}

async function preflightPackageDelivery({admin,organization,user}){
  if(!await assertPermission(admin,user.id,organization.id,'packages.share'))return {response:json(403,{error:'Missing permission: packages.share',code:'PACKAGE_SHARE_PERMISSION_REQUIRED'})};
  if(!await assertPermission(admin,user.id,organization.id,'communications.send'))return {response:json(403,{error:'Missing permission: communications.send',code:'COMMUNICATIONS_SEND_PERMISSION_REQUIRED'})};
  const {data:settings,error:settingsErr}=await admin.from('organization_settings').select('*').eq('organization_id',organization.id).maybeSingle();
  if(settingsErr)throw settingsErr;
  const dc=deliveryConfig(settings,user,organization);
  if(!dc.sender_email)return {response:json(422,{error:'Package email sender is not configured.',code:'EMAIL_SENDER_MISSING',delivery_config:dc})};
  try{requireEmailDelivery({senderEmail:dc.sender_email});}catch(e){return {response:json(e.statusCode||503,{error:e.publicMessage||e.message,code:e.code||'EMAIL_PROVIDER_NOT_CONFIGURED',delivery_config:dc})};}
  return {settings,delivery_config:dc};
}

async function sendExistingPackage({admin,organization,user,event,pkg,body,recipient:existingRecipient=null,preflight=null}){
  // Delivery readiness is checked before any recipient/share/email delivery mutation.
  const ready=preflight||await preflightPackageDelivery({admin,organization,user});
  if(ready.response)return ready;
  const settings=ready.settings,dc=ready.delivery_config,fromEmail=dc.sender_email;

  const recipientEmail=cleanEmail(body.recipient_email||existingRecipient?.email);
  if(!recipientEmail)return {response:json(400,{error:'A valid recipient email is required to send this package'})};
  let recipient=existingRecipient;
  const recipientCompanyId=body.recipient_company_id||existingRecipient?.company_id||null;
  const recipientContactId=body.recipient_contact_id||existingRecipient?.contact_id||null;
  if(!recipient){
    const {data:r,error:rErr}=await admin.from('package_recipients').insert({organization_id:organization.id,package_id:pkg.id,company_id:recipientCompanyId,contact_id:recipientContactId,email:recipientEmail,display_name:String(body.recipient_name||'').trim()||null,sent_at:null,metadata:{source:'agent_package_bulk_delivery'}}).select('*').single();
    if(rErr)throw rErr;recipient=r;
  }else if(recipient.email!==recipientEmail || (body.recipient_name&&body.recipient_name!==recipient.display_name) || recipient.company_id!==recipientCompanyId || recipient.contact_id!==recipientContactId){
    const {data:r,error:rErr}=await admin.from('package_recipients').update({company_id:recipientCompanyId,contact_id:recipientContactId,email:recipientEmail,display_name:String(body.recipient_name||recipient.display_name||'').trim()||null}).eq('organization_id',organization.id).eq('id',recipient.id).select('*').single();
    if(rErr)throw rErr;recipient=r;
  }

  const rawToken=crypto.randomBytes(32).toString('base64url');
  const {data:link,error:linkErr}=await admin.from('package_share_links').insert({
    organization_id:organization.id,package_id:pkg.id,recipient_id:recipient.id,
    token_hash:hashToken(rawToken),status:'active',expires_at:pkg.expires_at||null,
    allow_downloads:body.allow_downloads!==false,created_by:user.id
  }).select('id').single();
  if(linkErr)throw linkErr;
  const sharePath=`/p/${rawToken}`;

  const headerOrigin=String(event.headers?.origin||event.headers?.referer||'').replace(/\/$/,'');
  const brandedBase=normalizePublicBase(body.public_base_url||settings?.package_domain||headerOrigin||'https://www.maisondeveux.com');
  const brandedUrl=brandedBase+sharePath;
  const deliveryBase=normalizePublicBase(process.env.VEUX_PACKAGE_DELIVERY_BASE||brandedBase);
  const publicUrl=deliveryBase+sharePath;
  const canonicalClientUrl='https://www.maisondeveux.com'+sharePath;
  const directFallbackUrl=normalizePublicBase(process.env.VEUX_PACKAGE_FALLBACK_BASE||'https://maison-agent.netlify.app')+sharePath;
  const subject=String(body.subject||`Maison de Veux — ${pkg.title}`);
  const intro=String(body.email_message||body.intro_message||pkg.intro_message||'Please review the models selected for you by Maison de Veux.');
  let packageMarket=null;
  if(pkg.market_id){
    const {data:marketRow,error:marketErr}=await admin.from('markets').select('name,city,code').eq('organization_id',organization.id).eq('id',pkg.market_id).maybeSingle();
    if(marketErr)throw marketErr;
    packageMarket=marketRow?.name||marketRow?.city||marketRow?.code||null;
  }
  const preview=await packageEmailPreview(admin,organization.id,pkg.id);
  const html=buildPackageEmailHtml({organization,settings,user,recipient,pkg,intro,publicUrl:canonicalClientUrl,preview,packageMarket});
  const {data:msg,error:msgErr}=await admin.from('email_messages').insert({organization_id:organization.id,from_name:settings?.sender_name||organization.name||'Maison de Veux',from_email:fromEmail,reply_to:cleanEmail(settings?.reply_to_email)||cleanEmail(user.email)||null,to_emails:[recipientEmail],cc_emails:[],bcc_emails:[],subject,html_body:html,text_body:`${intro}\n\nView package: ${canonicalClientUrl}`,source_type:'package',source_id:pkg.id,idempotency_key:`package:${pkg.id}:${recipient.id}:${link.id}`,created_by:user.id,metadata:{package_id:pkg.id,recipient_id:recipient.id,share_link_id:link.id}}).select('*').single();
  if(msgErr)throw msgErr;

  try{
    const emailResult=await deliverEmailMessage(admin,msg.id);
    // Package activation, recipient sent-state, delivery activity and bearer-URL redaction commit together.
    const {data:finalized,error:finalizeError}=await admin.rpc('finalize_package_delivery_v1',{target_org:organization.id,target_package:pkg.id,target_recipient:recipient.id,target_share_link:link.id,target_email_message:msg.id,target_actor:user.email||'VEUX staff'});
    if(finalizeError)throw finalizeError;if(!finalized?.verified){const e=new Error('Package delivery database finalization could not be verified.');e.statusCode=500;throw e;}
    recipient=finalized.recipient||recipient;
    return {recipient,sharePath,emailResult,publicUrl:canonicalClientUrl,brandedUrl:canonicalClientUrl,directFallbackUrl,persisted_at:finalized.persisted_at};
  }catch(e){
    // Failed delivery must not leave a usable external link behind or retain the bearer URL at rest.
    const {data:revoked,error:revokeError}=await admin.rpc('revoke_package_delivery_v1',{target_org:organization.id,target_share_link:link.id,target_email_message:msg.id});
    if(revokeError||revoked?.verified!==true){const cleanup=new Error('Package delivery failed and secure-link cleanup could not be verified.');cleanup.statusCode=500;cleanup.publicMessage='Package email failed and the secure delivery cleanup needs staff review.';throw cleanup;}
    return {response:json(e.statusCode||502,{error:e.publicMessage||'Package saved, but email delivery failed',code:e.code||'PACKAGE_EMAIL_DELIVERY_FAILED',detail:String(e.message||e),package_id:pkg.id,recipient_id:recipient.id,delivery_config:deliveryConfig(settings,user,organization),cleanup_verified:true})};
  }
}


async function normalizeBulkRecipients({admin,organization,body,pkg}){
  const incoming=Array.isArray(body.recipients)?body.recipients:[];
  if(!incoming.length){
    const email=cleanEmail(body.recipient_email);
    if(!email)return [];
    return [{contact_id:body.recipient_contact_id||null,company_id:body.recipient_company_id||pkg.company_id||null,email,display_name:String(body.recipient_name||'').trim()||null}];
  }
  const contactIds=[...new Set(incoming.map(x=>String(x?.contact_id||'')).filter(Boolean))];
  const contacts=contactIds.length?await rows(admin.from('contacts').select('id,company_id,display_name,email,status').eq('organization_id',organization.id).in('id',contactIds)):[];
  const contactMap=new Map(contacts.map(x=>[String(x.id),x]));
  const out=[],seen=new Set();
  for(const raw of incoming){
    const cid=String(raw?.contact_id||'').trim()||null;
    const contact=cid?contactMap.get(cid):null;
    if(cid&&!contact){const e=new Error('One or more selected package recipients are unavailable.');e.statusCode=400;throw e;}
    const companyId=raw?.company_id||contact?.company_id||pkg.company_id||null;
    if(pkg.company_id&&companyId&&String(companyId)!==String(pkg.company_id)){const e=new Error('A selected recipient does not belong to the package client / brand.');e.statusCode=400;throw e;}
    const email=cleanEmail(raw?.email)||cleanEmail(contact?.email);
    if(!email)continue;
    if(seen.has(email))continue;
    seen.add(email);
    out.push({contact_id:cid,company_id:companyId,email,display_name:String(raw?.display_name||contact?.display_name||'').trim()||null});
  }
  return out;
}

async function bulkSendPackage({admin,organization,user,event,pkg,body}){
  const ready=await preflightPackageDelivery({admin,organization,user});
  if(ready.response)return ready;
  const recipients=await normalizeBulkRecipients({admin,organization,body,pkg});
  if(!recipients.length)return {response:json(400,{error:'Select at least one contact with a valid email address.'})};
  const existing=await rows(admin.from('package_recipients').select('*').eq('organization_id',organization.id).eq('package_id',pkg.id).is('sent_at',null));
  const byContact=new Map(existing.filter(x=>x.contact_id).map(x=>[String(x.contact_id),x]));
  const byEmail=new Map(existing.filter(x=>x.email).map(x=>[String(x.email).toLowerCase(),x]));
  const deliveries=[],failures=[];
  for(const r of recipients){
    const current=(r.contact_id&&byContact.get(String(r.contact_id)))||byEmail.get(String(r.email).toLowerCase())||null;
    const oneBody={...body,recipient_email:r.email,recipient_name:r.display_name,recipient_company_id:r.company_id,recipient_contact_id:r.contact_id};
    const sent=await sendExistingPackage({admin,organization,user,event,pkg,body:oneBody,recipient:current,preflight:ready});
    if(sent.response){
      failures.push({email:r.email,contact_id:r.contact_id,error:'Delivery failed'});
      continue;
    }
    deliveries.push({email:r.email,contact_id:r.contact_id,recipient_id:sent.recipient?.id||null,public_url:sent.brandedUrl||sent.publicUrl||null});
  }
  if(deliveries.length){
    const {error}=await admin.from('packages').update({status:'active'}).eq('organization_id',organization.id).eq('id',pkg.id);
    if(error)throw error;
  }
  return {verified:deliveries.length>0,sent_count:deliveries.length,failed_count:failures.length,deliveries,failures,persisted_at:new Date().toISOString()};
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  let stage='start';
  try{
    stage='auth';
    const {user,client}=await requireUser(event);
    stage='body';
    const body=event.httpMethod==='POST'?parsePackageBody(event):{};
    const slug=event.queryStringParameters?.organization||body.organization_slug||'maison-de-veux';
    stage='organization';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});

    if(event.httpMethod==='POST'){
      stage='permission:packages.write';
      const admin=await requirePermission(user.id,organization.id,'packages.write');
      const action=body.action||'create';
      stage=`action:${action}`;

      if(action==='create'){
        const sendPreflight=body.send_now===true?await preflightPackageDelivery({admin,organization,user}):null;
        if(sendPreflight?.response)return sendPreflight.response;
        stage='create:atomic_content';
        const built=await replacePackageContent(admin,organization,null,body,user);
        if(body.send_now===true){
          const sent=await sendExistingPackage({admin,organization,user,event,pkg:built.pkg,body,recipient:built.recipient,preflight:sendPreflight});
          if(sent.response)return sent.response;
          built.pkg.status='active';
          return json(201,{ok:true,verified:true,persisted_at:sent.persisted_at||built.persisted_at,package:built.pkg,recipient:sent.recipient,share_path:sent.sharePath,email:sent.emailResult,public_url:sent.publicUrl,branded_url:sent.brandedUrl,direct_fallback_url:sent.directFallbackUrl});
        }
        return json(201,{ok:true,verified:true,persisted_at:built.persisted_at,package:built.pkg,recipient:built.recipient,model_count:built.model_count,media_count:built.media_count});
      }

      if(action==='update_draft'){
        const sendPreflight=body.send_now===true?await preflightPackageDelivery({admin,organization,user}):null;
        if(sendPreflight?.response)return sendPreflight.response;
        const packageId=String(body.package_id||'');if(!packageId)return json(400,{error:'package_id is required'});
        const pkg=await getPackage(admin,organization.id,packageId);
        if(!['draft','ready'].includes(pkg.status))return json(409,{error:'Only draft or ready packages can be edited'});
        const built=await replacePackageContent(admin,organization,pkg,body,user);
        if(body.send_now===true){
          const sent=await sendExistingPackage({admin,organization,user,event,pkg:built.pkg,body,recipient:built.recipient,preflight:sendPreflight});
          if(sent.response)return sent.response;
          built.pkg.status='active';
          return json(200,{ok:true,verified:true,persisted_at:sent.persisted_at||built.persisted_at,package:built.pkg,recipient:sent.recipient,share_path:sent.sharePath,email:sent.emailResult,public_url:sent.publicUrl,branded_url:sent.brandedUrl,direct_fallback_url:sent.directFallbackUrl});
        }
        return json(200,{ok:true,verified:true,persisted_at:built.persisted_at,package:built.pkg,recipient:built.recipient,model_count:built.model_count,media_count:built.media_count});
      }

      if(action==='send'){
        const packageId=String(body.package_id||'');if(!packageId)return json(400,{error:'package_id is required'});
        const pkg=await getPackage(admin,organization.id,packageId);
        if(['expired','revoked','archived'].includes(pkg.status))return json(409,{error:`A ${pkg.status} package cannot be sent`});
        const {data:latestRecipient,error:rErr}=await admin.from('package_recipients').select('*').eq('organization_id',organization.id).eq('package_id',pkg.id).is('sent_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(rErr)throw rErr;
        const sent=await sendExistingPackage({admin,organization,user,event,pkg,body,recipient:latestRecipient||null});
        if(sent.response)return sent.response;
        pkg.status='active';
        return json(200,{ok:true,verified:true,persisted_at:sent.persisted_at,package:pkg,recipient:sent.recipient,share_path:sent.sharePath,email:sent.emailResult,public_url:sent.publicUrl,branded_url:sent.brandedUrl,direct_fallback_url:sent.directFallbackUrl});
      }

      if(action==='bulk_send'){
        const packageId=String(body.package_id||'');if(!packageId)return json(400,{error:'package_id is required'});
        const pkg=await getPackage(admin,organization.id,packageId);
        if(['expired','revoked','archived'].includes(pkg.status))return json(409,{error:`A ${pkg.status} package cannot be sent`});
        const result=await bulkSendPackage({admin,organization,user,event,pkg,body});
        if(result.response)return result.response;
        return json(result.failed_count?207:200,{ok:true,verified:result.verified,package:{...pkg,status:result.sent_count?'active':pkg.status},sent_count:result.sent_count,failed_count:result.failed_count,deliveries:result.deliveries,failures:result.failures,persisted_at:result.persisted_at});
      }

      if(action==='duplicate'){
        const packageId=String(body.package_id||'');if(!packageId)return json(400,{error:'package_id is required'});
        const source=await getPackage(admin,organization.id,packageId);
        const title=String(body.title||`${source.title} Copy`).trim()||`${source.title} Copy`;
        const uniqueSlug=`${slugify(title)}-${Date.now().toString(36)}`;
        const {data:saved,error}=await admin.rpc('duplicate_package_v1',{target_org:organization.id,target_source:source.id,target_title:title,target_slug:uniqueSlug,target_user:user.id});
        if(error)throw error;if(!saved?.verified||!saved?.package){const e=new Error('Package duplicate could not be verified.');e.statusCode=500;throw e;}
        return json(201,{ok:true,verified:true,package:saved.package,model_count:saved.model_count,media_count:saved.media_count,duplicated_from:source.id,persisted_at:saved.persisted_at});
      }

      if(action==='archive'){
        const packageId=String(body.package_id||'');if(!packageId)return json(400,{error:'package_id is required'});
        const {data,error}=await admin.from('packages').update({status:'archived'}).eq('organization_id',organization.id).eq('id',packageId).select('*').single();if(error)throw error;
        return json(200,{ok:true,package:data});
      }

      return json(400,{error:'Unsupported package action'});
    }

    stage='permission:packages.read';
    const admin=await requirePermission(user.id,organization.id,'packages.read');
    const packageId=event.queryStringParameters?.package_id||null;
    const builderMode=String(event.queryStringParameters?.builder||'')==='1';
    const responseMode=String(event.queryStringParameters?.response_data||'')==='1';

    if(responseMode){
      stage='responses:data';
      const [packagesRaw,recipientsRaw,activityRaw,feedbackRaw]=await Promise.all([
        rows(admin.from('packages').select('id,title,status,company_id,created_at,updated_at').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(250)),
        rows(admin.from('package_recipients').select('id,package_id,company_id,contact_id,email,display_name,sent_at,delivered_at,opened_at,first_viewed_at,last_viewed_at,view_count,created_at').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500)),
        rows(admin.from('package_activity').select('id,package_id,recipient_id,model_id,event_type,occurred_at,actor_label,metadata').eq('organization_id',organization.id).order('occurred_at',{ascending:false}).limit(2000)),
        rows(admin.from('package_feedback').select('id,package_id,recipient_id,model_id,feedback_type,note,status,created_at,updated_at').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(1500))
      ]);
      const companyIds=[...new Set([...packagesRaw.map(x=>x.company_id),...recipientsRaw.map(x=>x.company_id)].filter(Boolean))];
      const contactIds=[...new Set(recipientsRaw.map(x=>x.contact_id).filter(Boolean))];
      const modelIds=[...new Set([...activityRaw.map(x=>x.model_id),...feedbackRaw.map(x=>x.model_id)].filter(Boolean))];
      const [companies,contacts,models]=await Promise.all([
        companyIds.length?rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).in('id',companyIds)):[],
        contactIds.length?rows(admin.from('contacts').select('id,display_name,email').eq('organization_id',organization.id).in('id',contactIds)):[],
        modelIds.length?rows(admin.from('models').select('id,display_name,public_slug').eq('organization_id',organization.id).in('id',modelIds)):[]
      ]);
      const pMap=new Map(packagesRaw.map(x=>[x.id,x])),coMap=new Map(companies.map(x=>[x.id,x])),ctMap=new Map(contacts.map(x=>[x.id,x])),mMap=new Map(models.map(x=>[x.id,x]));
      const recipients=recipientsRaw.map(x=>{const ct=x.contact_id?ctMap.get(x.contact_id):null,co=x.company_id?coMap.get(x.company_id):null,p=pMap.get(x.package_id);return {...x,recipient_name:x.display_name||ct?.display_name||null,recipient_email:x.email||ct?.email||null,company_name:co?.name||null,package_title:p?.title||null};});
      const rMap=new Map(recipients.map(x=>[x.id,x]));
      const feedback=feedbackRaw.map(x=>{const r=rMap.get(x.recipient_id),p=pMap.get(x.package_id),m=mMap.get(x.model_id);return {...x,recipient_name:r?.recipient_name||null,recipient_email:r?.recipient_email||null,company_name:r?.company_name||null,package_title:p?.title||null,model_name:m?.display_name||null};});
      const activity=activityRaw.map(x=>{const r=rMap.get(x.recipient_id),p=pMap.get(x.package_id),m=mMap.get(x.model_id);return {...x,recipient_name:r?.recipient_name||null,recipient_email:r?.recipient_email||null,company_name:r?.company_name||null,package_title:p?.title||null,model_name:m?.display_name||null};});
      return json(200,{environment:'veux-saas-v16.9.61',organization,response_data:true,packages:packagesRaw.map(x=>({...x,company_name:x.company_id?coMap.get(x.company_id)?.name||null:null})),recipients,activity,feedback});
    }

    if(builderMode){
      stage='builder:permissions';
      const [canModels,canCrm]=await Promise.all([
        assertPermission(admin,user.id,organization.id,'models.read'),
        assertPermission(admin,user.id,organization.id,'crm.read')
      ]);
      if(!canModels||!canCrm)return json(403,{error:'Package Builder requires model and CRM read access.',code:'PACKAGE_BUILDER_ACCESS_REQUIRED'});
      const mediaModelId=String(event.queryStringParameters?.media_model_id||'').trim();
      if(mediaModelId){
        stage='builder:model_media';
        const model=await admin.from('models').select('id,display_name').eq('organization_id',organization.id).eq('id',mediaModelId).maybeSingle();
        if(model.error)throw model.error;
        if(!model.data)return json(404,{error:'Model not found'});
        const media=await rows(admin.from('model_media').select('id,model_id,media_type,category,url,caption,photographer,season,usage_permission,is_primary,is_public,sort_order,created_at').eq('organization_id',organization.id).eq('model_id',mediaModelId).eq('is_public',true).order('is_primary',{ascending:false}).order('sort_order').order('created_at'));
        return json(200,{environment:'veux-saas-v16.9.61',organization,builder:true,media_picker:true,model:model.data,media});
      }
      stage='builder:data';
      const rosterPromise=client.rpc('search_roster',{target_org:organization.id,filter_data:{limit:250,active:true}});
      const packagePromise=packageId?getPackage(admin,organization.id,packageId):Promise.resolve(null);
      const packageModelsPromise=packageId?rows(admin.from('package_models').select('id,model_id,sort_order,headline,note,visible,package_model_media(media_id,sort_order,model_media(id,model_id,media_type,category,url,caption,photographer,season,usage_permission,is_primary,is_public,sort_order))').eq('organization_id',organization.id).eq('package_id',packageId).order('sort_order')):Promise.resolve([]);
      const recipientsPromise=packageId?rows(admin.from('package_recipients').select('id,package_id,company_id,contact_id,email,display_name,sent_at,created_at,updated_at').eq('organization_id',organization.id).eq('package_id',packageId).order('created_at',{ascending:false})):Promise.resolve([]);
      const [rosterResult,markets,companies,contacts,settings,pkg,packageModels,recipients]=await Promise.all([
        rosterPromise,
        rows(admin.from('markets').select('id,name,code,city').eq('organization_id',organization.id).eq('active',true).order('sort_order')),
        rows(admin.from('companies').select('id,name,company_type,status').eq('organization_id',organization.id).order('name').limit(500)),
        rows(admin.from('contacts').select('id,company_id,display_name,role,email,status').eq('organization_id',organization.id).order('display_name').limit(700)),
        admin.from('organization_settings').select('sender_name,sender_email,reply_to_email,package_domain').eq('organization_id',organization.id).maybeSingle().then(x=>x.data||null),
        packagePromise,packageModelsPromise,recipientsPromise
      ]);
      if(rosterResult.error)throw rosterResult.error;
      return json(200,{environment:'veux-saas-v16.9.61',organization,builder:true,
        base:{delivery_config:{...deliveryConfig(settings,user,organization),resend_configured:emailDeliveryStatus().configured}},
        detail:pkg?{package:pkg,models:packageModels,recipients}:null,
        roster:{roster:rosterResult.data||[],markets},
        crm:{companies,contacts}
      });
    }

    if(packageId){
      const pkg=await getPackage(admin,organization.id,packageId);
      const [models,recipients,activity,feedback,conversions]=await Promise.all([
        rows(admin.from('package_models').select('*,models!package_models_model_same_org_fk(id,display_name,public_slug,status,stage,primary_market_label),package_model_media(*,model_media(*))').eq('organization_id',organization.id).eq('package_id',packageId).order('sort_order')),
        rows(admin.from('package_recipients').select('*,companies!package_recipients_company_same_org_fk(id,name),contacts!package_recipients_contact_same_org_fk(id,display_name,email)').eq('organization_id',organization.id).eq('package_id',packageId).order('created_at',{ascending:false})),
        rows(admin.from('package_activity').select('*').eq('organization_id',organization.id).eq('package_id',packageId).order('occurred_at',{ascending:false}).limit(500)),
        rows(admin.from('package_feedback').select('*,models(id,display_name)').eq('organization_id',organization.id).eq('package_id',packageId).order('created_at',{ascending:false})),
        rows(admin.from('package_conversions').select('*').eq('organization_id',organization.id).eq('package_id',packageId).order('converted_at',{ascending:false}))
      ]);
      const {data:settings}=await admin.from('organization_settings').select('sender_name,sender_email,reply_to_email,package_domain').eq('organization_id',organization.id).maybeSingle();
      return json(200,{environment:'veux-saas-v6',organization,package:pkg,models,recipients,activity,feedback,conversions,delivery_config:{...deliveryConfig(settings,user,organization),resend_configured:emailDeliveryStatus().configured}});
    }

    const [packagesRaw,openFeedbackRaw,signalsRaw,recipientStatusRaw,allFeedbackStatusRaw]=await Promise.all([
      rows(admin.from('packages').select('id,title,slug,status,company_id,primary_contact_id,market_id,intro_message,layout_key,expires_at,created_at,updated_at').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(250)),
      rows(admin.from('package_feedback').select('id,package_id,recipient_id,model_id,feedback_type,note,status,created_at').eq('organization_id',organization.id).eq('status','open').order('created_at',{ascending:false}).limit(250)),
      rows(admin.from('client_model_signals').select('*').eq('organization_id',organization.id).order('weighted_score',{ascending:false}).limit(100)),
      rows(admin.from('package_recipients').select('id,package_id,email,display_name,sent_at,opened_at,first_viewed_at,last_viewed_at,view_count').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(3000)),
      rows(admin.from('package_feedback').select('id,package_id,recipient_id,model_id,feedback_type,status,created_at').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(3000))
    ]);
    const companyIds=[...new Set([...packagesRaw.map(x=>x.company_id),...signalsRaw.map(x=>x.company_id)].filter(Boolean))];
    const contactIds=[...new Set(signalsRaw.map(x=>x.contact_id).filter(Boolean))];
    const modelIds2=[...new Set([...openFeedbackRaw.map(x=>x.model_id),...signalsRaw.map(x=>x.model_id)].filter(Boolean))];
    const packageIds=[...new Set(openFeedbackRaw.map(x=>x.package_id).filter(Boolean))];
    const [companies2,contacts2,models2,feedbackPackages,settings]=await Promise.all([
      companyIds.length?rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).in('id',companyIds)):[],
      contactIds.length?rows(admin.from('contacts').select('id,display_name,email').eq('organization_id',organization.id).in('id',contactIds)):[],
      modelIds2.length?rows(admin.from('models').select('id,display_name').eq('organization_id',organization.id).in('id',modelIds2)):[],
      packageIds.length?rows(admin.from('packages').select('id,title').eq('organization_id',organization.id).in('id',packageIds)):[],
      admin.from('organization_settings').select('sender_name,sender_email,reply_to_email,package_domain').eq('organization_id',organization.id).maybeSingle().then(x=>x.data||null)
    ]);
    const coMap=new Map(companies2.map(x=>[x.id,x])),ctMap=new Map(contacts2.map(x=>[x.id,x])),mMap=new Map(models2.map(x=>[x.id,x])),pMap=new Map(feedbackPackages.map(x=>[x.id,x]));
    const packageViewMap=new Map();
    for(const r of recipientStatusRaw){
      const k=String(r.package_id||'');if(!k)continue;
      const v=packageViewMap.get(k)||{recipient_count:0,sent_count:0,opened_count:0,total_views:0,last_opened_at:null,last_viewed_at:null};
      v.recipient_count++;
      if(r.sent_at)v.sent_count++;
      const opened=r.opened_at||r.first_viewed_at||null;
      if(opened){
        v.opened_count++;
        if(!v.last_opened_at||new Date(opened)>new Date(v.last_opened_at))v.last_opened_at=opened;
      }
      v.total_views+=Number(r.view_count||0);
      if(r.last_viewed_at&&(!v.last_viewed_at||new Date(r.last_viewed_at)>new Date(v.last_viewed_at)))v.last_viewed_at=r.last_viewed_at;
      packageViewMap.set(k,v);
    }
    const packageResponseMap=new Map();
    for(const f of allFeedbackStatusRaw){
      const k=String(f.package_id||'');if(!k)continue;
      const v=packageResponseMap.get(k)||{response_count:0,last_response_at:null,response_types:{}};
      v.response_count++;
      const ft=String(f.feedback_type||'response');
      v.response_types[ft]=(v.response_types[ft]||0)+1;
      if(f.created_at&&(!v.last_response_at||new Date(f.created_at)>new Date(v.last_response_at)))v.last_response_at=f.created_at;
      packageResponseMap.set(k,v);
    }
    const packages=packagesRaw.map(x=>{
      const view=packageViewMap.get(String(x.id))||{recipient_count:0,sent_count:0,opened_count:0,total_views:0,last_opened_at:null,last_viewed_at:null};
      const resp=packageResponseMap.get(String(x.id))||{response_count:0,last_response_at:null,response_types:{}};
      let view_status='Not Sent';
      if(view.sent_count>0)view_status='Sent';
      if(view.opened_count>0)view_status='Viewed';
      if(resp.response_count>0)view_status='Responded';
      return {...x,companies:x.company_id?coMap.get(x.company_id)||null:null,
        tracking:{...view,...resp,view_status}
      };
    });
    const openFeedback=openFeedbackRaw.map(x=>({...x,models:mMap.get(x.model_id)||null,packages:pMap.get(x.package_id)||null}));
    const signals=signalsRaw.map(x=>({...x,companies:coMap.get(x.company_id)||null,contacts:x.contact_id?ctMap.get(x.contact_id)||null:null,models:mMap.get(x.model_id)||null}));
    return json(200,{environment:'veux-saas-v6',organization,packages,open_feedback:openFeedback,client_model_signals:signals,delivery_config:{...deliveryConfig(settings,user,organization),resend_configured:emailDeliveryStatus().configured}});
  }catch(error){
    console.error('[VEUX package desk]',{stage,message:error?.message||String(error),code:error?.code||null,details:error?.details||null,hint:error?.hint||null});
    if(error?.statusCode)return errorResponse(error);
    return json(500,{error:`Package server error (${stage})`,code:error?.code||'PACKAGE_SERVER_ERROR'});
  }
};
