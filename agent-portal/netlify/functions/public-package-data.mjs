import crypto from 'node:crypto';
import { adminClient, json, errorResponse } from './_lib/auth.mjs';

const hashToken = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const cacheHeaders = { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow' };

function validToken(v){return /^[A-Za-z0-9_-]{32,160}$/.test(String(v||''));}
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler = async event => {
  if(event.httpMethod !== 'GET') return json(405,{error:'Method not allowed'}, { ...cacheHeaders, Allow:'GET' });
  try{
    const raw=String(event.queryStringParameters?.token||'').trim();
    if(!validToken(raw)) return json(404,{error:'Package link is invalid or inactive'},cacheHeaders);
    const admin=adminClient();
    const {data:consumed,error:consumeError}=await admin.rpc('consume_package_share_link_v1',{target_token_hash:hashToken(raw),target_actor_label:'Package recipient',target_ip_hash:null,target_user_agent:String(event.headers?.['user-agent']||event.headers?.['User-Agent']||'').slice(0,1000)||null});
    if(consumeError)throw consumeError;
    if(consumed?.verified!==true||consumed?.available!==true||!consumed?.link) return json(404,{error:'Package link is invalid, expired, or inactive'},cacheHeaders);
    const link=consumed.link,recipientState=consumed.recipient||null;

    const [{data:pkg,error:pkgErr},{data:org,error:orgErr},{data:recipient,error:recipientErr}]=await Promise.all([
      admin.from('packages').select('id,organization_id,title,status,intro_message,layout_key,expires_at,metadata,created_at,updated_at').eq('id',link.package_id).eq('organization_id',link.organization_id).maybeSingle(),
      admin.from('organizations').select('id,name,slug,status').eq('id',link.organization_id).maybeSingle(),
      link.recipient_id?admin.from('package_recipients').select('id,display_name').eq('id',link.recipient_id).eq('organization_id',link.organization_id).maybeSingle():Promise.resolve({data:recipientState,error:null})
    ]);
    if(pkgErr)throw pkgErr;if(orgErr)throw orgErr;if(recipientErr)throw recipientErr;
    if(!pkg || !org || org.status!=='active' || ['revoked','archived','expired'].includes(String(pkg.status||''))) return json(404,{error:'Package link is unavailable'},cacheHeaders);

    const packageModels=await rows(admin.from('package_models').select('id,model_id,sort_order,headline,note,visible').eq('organization_id',link.organization_id).eq('package_id',pkg.id).eq('visible',true).order('sort_order'));
    const modelIds=packageModels.map(x=>x.model_id);
    const packageModelIds=packageModels.map(x=>x.id);
    const [models,profiles,measurements,selectedMedia,publicMedia]=await Promise.all([
      modelIds.length?rows(admin.from('models').select('id,display_name,gender,stage,location,primary_market_label,public_slug,legacy_key').eq('organization_id',link.organization_id).in('id',modelIds)):[],
      modelIds.length?rows(admin.from('model_public_profiles').select('model_id,published,headline,bio,show_measurements,show_market,show_socials,metadata').eq('organization_id',link.organization_id).in('model_id',modelIds)):[],
      modelIds.length?rows(admin.from('model_measurements').select('model_id,height_display,bust_display,chest_display,waist_display,hips_display,dress,suit,shoe,hair,eyes').eq('organization_id',link.organization_id).in('model_id',modelIds)):[],
      packageModelIds.length?rows(admin.from('package_model_media').select('package_model_id,media_id,sort_order,model_media(id,model_id,media_type,category,url,caption,photographer,season,usage_permission,sort_order,is_primary,is_public)').in('package_model_id',packageModelIds).order('sort_order')):[],
      modelIds.length?rows(admin.from('model_media').select('id,model_id,media_type,category,url,caption,photographer,season,usage_permission,sort_order,is_primary,is_public').eq('organization_id',link.organization_id).in('model_id',modelIds).eq('is_public',true).order('sort_order')):[]
    ]);
    const modelMap=new Map(models.map(x=>[x.id,x])),profileMap=new Map(profiles.map(x=>[x.model_id,x])),measurementMap=new Map(measurements.map(x=>[x.model_id,x]));
    const selectedByPm=new Map();
    for(const row of selectedMedia){if(!row.model_media?.is_public)continue;if(!selectedByPm.has(row.package_model_id))selectedByPm.set(row.package_model_id,[]);selectedByPm.get(row.package_model_id).push({...row.model_media,package_sort_order:row.sort_order});}
    const publicByModel=new Map();
    for(const media of publicMedia){if(!publicByModel.has(media.model_id))publicByModel.set(media.model_id,[]);publicByModel.get(media.model_id).push(media);}
    const profileFields=Array.isArray(pkg.metadata?.profile_fields)?pkg.metadata.profile_fields:[];
    const modelsOut=packageModels.map(pm=>{
      const m=modelMap.get(pm.model_id)||{},pp=profileMap.get(pm.model_id)||{},mm=measurementMap.get(pm.model_id)||{};
      const packageChosen=selectedByPm.get(pm.id)||[],hasPackageSelection=packageChosen.length>0;
      const chosen=hasPackageSelection?packageChosen:(publicByModel.get(pm.model_id)||[]);
      const wm=pp.metadata&&pp.metadata.website_profile||{},route=String(wm.route_key||m.legacy_key||m.public_slug||'').trim(),profileUrl=pp.published&&route?'https://www.maisondeveux.com/'+encodeURIComponent(route):null;
      const media=chosen.slice().sort((a,b)=>hasPackageSelection?Number(a.package_sort_order??0)-Number(b.package_sort_order??0):Number(b.is_primary)-Number(a.is_primary)||Number(a.sort_order??0)-Number(b.sort_order??0)).map(x=>({id:x.id,media_type:x.media_type,category:x.category,url:x.url,caption:x.caption,photographer:x.photographer,season:x.season,usage_permission:x.usage_permission,is_primary:x.is_primary}));
      return {id:m.id,display_name:m.display_name,public_slug:m.public_slug,profile_url:profileUrl,headline:pm.headline||pp.headline||null,note:pm.note||null,market:profileFields.includes('market')||profileFields.length===0?(m.primary_market_label||m.location||null):null,stage:m.stage||null,bio:profileFields.includes('bio')?pp.bio||null:null,measurements:profileFields.includes('measurements')&&pp.show_measurements!==false?mm:null,media};
    });

    const feedbackRows=link.recipient_id?await rows(admin.from('package_feedback').select('model_id,feedback_type,status,created_at').eq('organization_id',link.organization_id).eq('package_id',pkg.id).eq('recipient_id',link.recipient_id).order('created_at',{ascending:true})):[];

    const shortlistState=new Set();
    for(const row of feedbackRows){
      if(row.feedback_type==='shortlist'&&row.status==='open')shortlistState.add(String(row.model_id));
    }

    const approvedSections=Array.isArray(pkg.metadata?.approved_sections)?pkg.metadata.approved_sections:['book','digitals','motion'];
    return json(200,{ok:true,verified:true,organization:{name:org.name,slug:org.slug},package:{id:pkg.id,title:pkg.title,intro_message:pkg.intro_message,layout_key:pkg.layout_key,expires_at:link.expires_at||pkg.expires_at||null,allow_downloads:link.allow_downloads,profile_fields:profileFields,asset_types:Array.isArray(pkg.metadata?.asset_types)?pkg.metadata.asset_types:[],approved_sections:approvedSections},recipient:{display_name:recipient?.display_name||null},models:modelsOut,feedback_state:{shortlisted_model_ids:[...shortlistState]}},cacheHeaders);
  }catch(error){const r=errorResponse(error);r.headers={...r.headers,...cacheHeaders};return r;}
};
