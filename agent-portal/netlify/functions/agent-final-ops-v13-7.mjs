import { requireUser, parseBody, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

const EDITORIAL_SYNC_KEY='mdvc_editorial_2026';
async function rows(q){ const {data,error}=await q; if(error) throw error; return data||[]; }
function cleanText(v){return String(v==null?'':v).trim();}
function slugify(v){return cleanText(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}
function galleryList(v){
  if(Array.isArray(v))return v.map(cleanText).filter(Boolean);
  return cleanText(v).split(/[\n,]+/).map(cleanText).filter(Boolean);
}
function storyId(){return 'ed_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);}
async function editorialStories(admin){
  const {data,error}=await admin.from('mdv_sync').select('data,updated_at').eq('key',EDITORIAL_SYNC_KEY).maybeSingle();
  if(error)throw error;
  return {stories:Array.isArray(data?.data)?data.data:[],updated_at:data?.updated_at||null};
}
async function canAny(admin,userId,orgId,keys){
  for(const key of keys){if(await assertPermission(admin,userId,orgId,key))return true;}
  return false;
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod)) return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const admin=adminClient();

    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(action==='mark_notification'){
        const {data,error}=await admin.from('notifications').update({status:'read',read_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('user_id',user.id).eq('id',body.notification_id).select('*').single();
        if(error) throw error; return json(200,{ok:true,verified:true,notification:data,persisted_at:data?.read_at||new Date().toISOString()});
      }
      if(action==='mark_all_notifications'){
        const {error}=await admin.from('notifications').update({status:'read',read_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('user_id',user.id).in('status',['pending','sent','delivered']);
        if(error) throw error; return json(200,{ok:true});
      }
      if(action==='promote_partner'){
        await requirePermission(user.id,organization.id,'crm.write');
        if(!body.company_id) return json(400,{error:'company_id is required'});
        const company=(await rows(admin.from('companies').select('id').eq('organization_id',organization.id).eq('id',body.company_id).limit(1)))[0];
        if(!company) return json(404,{error:'Company not found'});
        const payload={organization_id:organization.id,company_id:body.company_id,partner_type:body.partner_type||'mother_agency',portal_enabled:body.portal_enabled!==false,default_commission_rate:body.default_commission_rate==null?null:Number(body.default_commission_rate),notes:body.notes||null};
        const {data,error}=await admin.from('partner_agencies').upsert(payload,{onConflict:'organization_id,company_id'}).select('*').single();
        if(error) throw error; return json(200,{ok:true,verified:true,partner:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='log_press'){
        await requirePermission(user.id,organization.id,'crm.write');
        if(!body.company_id&&!body.contact_id) return json(400,{error:'company_id or contact_id is required'});
        const {data,error}=await admin.from('crm_activity').insert({organization_id:organization.id,company_id:body.company_id||null,contact_id:body.contact_id||null,activity_type:body.activity_type||'press',direction:'internal',subject:body.subject||null,summary:body.summary||null,occurred_at:body.occurred_at||new Date().toISOString(),created_by:user.id,metadata:Object.assign({desk:'editorial_press'},body.metadata||{})}).select('*').single();
        if(error) throw error; return json(200,{ok:true,verified:true,activity:data,persisted_at:data?.created_at||new Date().toISOString()});
      }
      if(action==='save_story'){
        const allowed=await canAny(admin,user.id,organization.id,['crm.write','communications.send']);
        if(!allowed)return json(403,{error:'Editorial publishing permission required'});
        const city=cleanText(body.city).toLowerCase();
        const status=cleanText(body.status||'draft').toLowerCase();
        if(!['newyork','paris','both'].includes(city))return json(400,{error:'Market must be New York, Paris, or Both'});
        if(!['draft','published','archived'].includes(status))return json(400,{error:'Invalid story status'});
        const modelName=cleanText(body.modelName);
        const brand=cleanText(body.brand);
        if(!modelName&&!brand)return json(400,{error:'Model name or story title is required'});
        const existing=await editorialStories(admin);
        const id=cleanText(body.id)||storyId();
        const prior=existing.stories.find(x=>x&&x.id===id)||{};
        const now=new Date().toISOString();
        const story={
          ...prior,
          id,
          city,
          slug:slugify(body.slug||modelName||brand)||id,
          brand,
          status,
          caption:cleanText(body.caption),
          credits:Array.isArray(body.credits)?body.credits:prior.credits||[],
          gallery:galleryList(body.gallery),
          createdAt:prior.createdAt||now,
          heroImage:cleanText(body.heroImage),
          modelName,
          publishedAt:status==='published'?(prior.status==='published'&&prior.publishedAt?prior.publishedAt:now):null,
          brandInstagram:cleanText(body.brandInstagram),
          modelInstagram:cleanText(body.modelInstagram),
          updatedAt:now
        };
        const {data:saved,error:saveError}=await admin.rpc('save_editorial_story_v1',{target_org:organization.id,target_key:EDITORIAL_SYNC_KEY,target_story:story,target_actor:user.id,target_archive:false});
        if(saveError)throw saveError;if(saved?.verified!==true)throw new Error('Editorial story save could not be verified');
        return json(200,{ok:true,verified:true,story:saved.story,blog_path:saved.blog_path,persisted_at:saved.persisted_at});
      }
      if(action==='archive_story'){
        const allowed=await canAny(admin,user.id,organization.id,['crm.write','communications.send']);
        if(!allowed)return json(403,{error:'Editorial publishing permission required'});
        const id=cleanText(body.id);if(!id)return json(400,{error:'Story id is required'});
        const existing=await editorialStories(admin),prior=existing.stories.find(x=>x&&x.id===id);
        if(!prior)return json(404,{error:'Story not found'});
        const {data:saved,error}=await admin.rpc('save_editorial_story_v1',{target_org:organization.id,target_key:EDITORIAL_SYNC_KEY,target_story:prior,target_actor:user.id,target_archive:true});if(error)throw error;if(saved?.verified!==true)throw new Error('Editorial archive could not be verified');
        return json(200,{ok:true,verified:true,story:saved.story,persisted_at:saved.persisted_at});
      }
      return json(400,{error:'Unsupported action'});
    }

    const canCrm=await assertPermission(admin,user.id,organization.id,'crm.read');
    const canEditorial=canCrm||await canAny(admin,user.id,organization.id,['documents.read','communications.send']);
    const notifications=await rows(admin.from('notifications').select('*').eq('organization_id',organization.id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(100));
    if(String(p.notifications_only||'')==='1') return json(200,{ok:true,organization:{id:organization.id,slug:organization.slug},notifications});
    let companies=[],contacts=[],partners=[],placements=[],markets=[],models=[],press=[];
    if(canCrm){
      [companies,contacts,partners,placements,markets,models,press]=await Promise.all([
        rows(admin.from('companies').select('*').eq('organization_id',organization.id).order('name').limit(600)),
        rows(admin.from('contacts').select('*').eq('organization_id',organization.id).order('display_name').limit(800)),
        rows(admin.from('partner_agencies').select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(300)),
        rows(admin.from('model_placements').select('*').eq('organization_id',organization.id).order('updated_at',{ascending:false}).limit(600)),
        rows(admin.from('markets').select('id,name,code,city,country_code').eq('organization_id',organization.id).order('name')),
        rows(admin.from('models').select('id,display_name,public_slug,status,primary_market_label').eq('organization_id',organization.id).eq('active',true).order('display_name').limit(500)),
        rows(admin.from('crm_activity').select('*').eq('organization_id',organization.id).in('activity_type',['press','editorial','announcement','media','pr']).order('occurred_at',{ascending:false}).limit(200))
      ]);
    }
    const editorial=canEditorial?await editorialStories(admin):{stories:[],updated_at:null};
    const cm=new Map(companies.map(x=>[x.id,x]));
    const mm=new Map(models.map(x=>[x.id,x]));
    const mk=new Map(markets.map(x=>[x.id,x]));
    const contactMap=new Map(contacts.map(x=>[x.id,x]));
    return json(200,{environment:'veux-saas-v16.7.7',organization,notifications,companies,contacts,
      partner_agencies:partners.map(x=>({...x,company:cm.get(x.company_id)||null})),
      placements:placements.map(x=>({...x,model:mm.get(x.model_id)||null,market:mk.get(x.market_id)||null})),
      press_activity:press.map(x=>({...x,company:cm.get(x.company_id)||null,contact:contactMap.get(x.contact_id)||null})),
      editorial_stories:editorial.stories,editorial_updated_at:editorial.updated_at,
      editorial_blogs:{newyork:'/newyork/news',paris:'/paris/news'},
      access:{crm:!!canCrm,crm_write:await assertPermission(admin,user.id,organization.id,'crm.write'),editorial:!!canEditorial}
    });
  }catch(error){ return errorResponse(error); }
};
