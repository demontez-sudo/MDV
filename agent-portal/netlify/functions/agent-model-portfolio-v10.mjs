import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;}

const WEBSITE_BOOK_CATEGORIES=new Set(['headshot','editorial','runway','commercial','portfolio','polaroid','book']);
function websiteEligible(category,mediaType){
  const c=String(category||'').trim().toLowerCase();
  if(!c)return false;
  if(String(mediaType||'').trim().toLowerCase()==='video')return true;
  if(c.includes('digital'))return true;
  if(c.includes('motion'))return true;
  return WEBSITE_BOOK_CATEGORIES.has(c);
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const modelId=body.model_id||p.model_id;
    if(!modelId)return json(400,{error:'model_id is required'});

    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(action==='set_primary_media'){
        await requirePermission(user.id,organization.id,'media.write');
        if(!body.media_id)return json(400,{error:'media_id is required'});
        const {data,error}=await client.rpc('set_model_primary_media',{target_org:organization.id,target_model:modelId,target_media:body.media_id});if(error)throw error;if(!data)throw new Error('Primary media change was not verified.');return json(200,{ok:true,verified:true,media:data,message:'Profile photo updated. It is now the public website Headshot.',persisted_at:new Date().toISOString()});
      }
      if(action==='create_media'){
        const admin=await requirePermission(user.id,organization.id,'media.write');
        const url=String(body.url||'').trim();if(!url)return json(400,{error:'url is required'});
        const createCategory=body.category||'Portfolio';
        const payload={organization_id:organization.id,model_id:modelId,media_type:body.media_type||'image',category:createCategory,provider:body.provider||'external',url,public_id:body.public_id||null,caption:body.caption||null,photographer:body.photographer||null,usage_permission:body.usage_permission||null,sort_order:Number(body.sort_order||0),is_public:body.is_public!==false&&websiteEligible(createCategory,body.media_type),metadata:body.metadata||{}};
        const {data,error}=await admin.from('model_media').insert(payload).select('*').single();if(error)throw error;if(!data?.id)throw new Error('Media save was not verified.');return json(200,{ok:true,verified:true,media:data,persisted_at:new Date().toISOString()});
      }
      if(action==='delete_media'){
        const admin=await requirePermission(user.id,organization.id,'media.write');
        const media=await one(admin.from('model_media').select('id,is_primary,is_public,url').eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.media_id));
        if(!media)return json(404,{error:'Media item not found'});
        if(media.is_primary)return json(409,{error:'The model profile photo cannot be permanently deleted. Set another Headshot as the profile photo first.'});
        const {data,error}=await admin.from('model_media').delete().eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.media_id).select('id').single();if(error)throw error;return json(200,{ok:true,verified:true,deleted_id:data.id,message:'Media permanently deleted',persisted_at:new Date().toISOString()});
      }
      if(action==='reorder_media'){
        await requirePermission(user.id,organization.id,'media.write');
        const ids=Array.isArray(body.media_ids)?body.media_ids:[];
        const {data,error}=await client.rpc('save_model_media_order_v1',{target_org:organization.id,target_model:modelId,target_media_ids:ids});if(error)throw error;if(data==null)throw new Error('Media order was not verified.');return json(200,{ok:true,verified:true,updated:data,persisted_at:new Date().toISOString()});
      }
      if(action==='save_portfolio_set'){
        await requirePermission(user.id,organization.id,'media.write');
        const {data,error}=await client.rpc('save_model_portfolio_set',{target_org:organization.id,target_model:modelId,target_set:body.portfolio_set_id||null,set_name:String(body.name||''),set_purpose:body.purpose||'portfolio',media_ids:Array.isArray(body.media_ids)?body.media_ids:[]});if(error)throw error;return json(200,{ok:true,portfolio_set:data});
      }
      if(action==='replace_primary_and_hide'){
        const admin=await requirePermission(user.id,organization.id,'media.write');
        if(!body.media_id||!body.replacement_media_id)return json(400,{error:'Current media and replacement Headshot are required'});
        if(String(body.media_id)===String(body.replacement_media_id))return json(400,{error:'Choose a different Headshot as the replacement.'});
        const current=await one(admin.from('model_media').select('id,is_primary,is_public,category').eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.media_id));
        const next=await one(admin.from('model_media').select('id,is_primary,is_public,category,media_type,url').eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.replacement_media_id));
        if(!current)return json(404,{error:'Current media item not found'});
        if(!current.is_primary)return json(409,{error:'This image is no longer the primary Headshot. Refresh and try again.'});
        if(!next)return json(404,{error:'Replacement Headshot not found'});
        if(String(next.category||'').toLowerCase()!=='headshot')return json(409,{error:'The replacement must be categorized as Headshot.'});
        if(String(next.media_type||'image').toLowerCase()!=='image')return json(409,{error:'The replacement profile Headshot must be an image.'});
        const {data:primary,error:pe}=await client.rpc('set_model_primary_media',{target_org:organization.id,target_model:modelId,target_media:next.id});
        if(pe)throw pe;
        const allowed={is_public:false};
        for(const k of ['category','caption','photographer','usage_permission','sort_order'])if(body[k]!==undefined)allowed[k]=body[k];
        const {data:updated,error:ue}=await admin.from('model_media').update(allowed).eq('organization_id',organization.id).eq('model_id',modelId).eq('id',current.id).select('*').single();
        if(ue)throw ue;
        return json(200,{ok:true,media:updated,primary_media:primary,replacement_media_id:next.id,message:'New primary Headshot set and previous profile image hidden.'});
      }
      if(action==='update_media'){
        const admin=await requirePermission(user.id,organization.id,'media.write');
        const existing=await one(admin.from('model_media').select('id,is_primary,is_public,category,media_type').eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.media_id));
        if(!existing)return json(404,{error:'Media item not found'});
        if(existing.is_primary&&body.is_public===false)return json(409,{error:'The current profile photo cannot be hidden without a replacement. Choose another Headshot and use Set New Primary + Hide This Image.'});
        if(existing.is_primary&&body.category!==undefined&&String(body.category).toLowerCase()!=='headshot')return json(409,{error:'The current profile photo cannot leave the Headshot category without a replacement. Choose another Headshot first.'});
        const allowed={}; for(const k of ['category','caption','photographer','usage_permission','sort_order','is_public']) if(body[k]!==undefined) allowed[k]=body[k];
        if(existing.is_primary){allowed.is_public=true;allowed.category='Headshot';}
        else if(allowed.is_public===true){
          const nextCategory=allowed.category!==undefined?allowed.category:existing.category;
          const nextType=allowed.media_type!==undefined?allowed.media_type:existing.media_type;
          if(!websiteEligible(nextCategory,nextType))return json(409,{error:'Only Main Book, Digital and Motion media can be made public. Change the category first.'});
        }
        const {data,error}=await admin.from('model_media').update(allowed).eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.media_id).select('*').single();if(error)throw error;if(!data?.id)throw new Error('Media update was not verified.');return json(200,{ok:true,verified:true,media:data,persisted_at:new Date().toISOString()});
      }
      if(action==='create_media_version'){
        const admin=await requirePermission(user.id,organization.id,'media.write');
        const media=await one(admin.from('model_media').select('*').eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.media_id));if(!media)return json(404,{error:'media not found'});
        const versions=await rows(admin.from('model_media_versions').select('version_no').eq('organization_id',organization.id).eq('media_id',media.id).order('version_no',{ascending:false}).limit(1));
        const {data,error}=await admin.from('model_media_versions').insert({organization_id:organization.id,media_id:media.id,version_no:(versions[0]?.version_no||0)+1,url:body.url||media.url,public_id:body.public_id||media.public_id||null,caption:body.caption??media.caption,metadata:body.metadata||{},created_by:user.id}).select('*').single();if(error)throw error;return json(200,{ok:true,version:data});
      }
      if(action==='publish_profile'){
        const admin=await requirePermission(user.id,organization.id,'public_profiles.manage');
        const allowed={organization_id:organization.id,model_id:modelId};for(const k of ['published','headline','bio','template_key','show_measurements','show_market','show_agent_contact','show_socials','contact_name','contact_email','contact_phone','seo_title','seo_description'])if(body[k]!==undefined)allowed[k]=body[k];if(body.published===true)allowed.published_at=new Date().toISOString();
        if(body.social_links&&typeof body.social_links==='object'){
          const existing=await one(admin.from('model_public_profiles').select('metadata').eq('organization_id',organization.id).eq('model_id',modelId));
          const cleanLinks={};for(const k of ['tiktok','website'])if(typeof body.social_links[k]==='string'&&body.social_links[k].trim())cleanLinks[k]=body.social_links[k].trim();
          allowed.metadata={...(existing?.metadata||{}),social_links:cleanLinks};
        }
        const {data,error}=await admin.from('model_public_profiles').upsert(allowed,{onConflict:'model_id'}).select('*').single();if(error)throw error;return json(200,{ok:true,public_profile:data});
      }
      return json(400,{error:'Unsupported model portfolio action'});
    }

    const admin=await requirePermission(user.id,organization.id,'models.read');
    const canMedia=await assertPermission(admin,user.id,organization.id,'media.read');
    const canMediaWrite=await assertPermission(admin,user.id,organization.id,'media.write');
    const canPrivate=await assertPermission(admin,user.id,organization.id,'models.private.read');
    const canPublic=await assertPermission(admin,user.id,organization.id,'public_profiles.read');
    const canPublicManage=await assertPermission(admin,user.id,organization.id,'public_profiles.manage');
    const model=await one(admin.from('models').select('*').eq('organization_id',organization.id).eq('id',modelId));if(!model)return json(404,{error:'model not found'});
    const media=canMedia?await rows(admin.from('model_media').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('category').order('sort_order')):[];
    const mediaIds=media.map(x=>x.id);
    const [measurements,markets,divisions,staffAssignments,staffMembers,versions,sets,publicProfile,compCards,tags,skills]=await Promise.all([
      one(admin.from('model_measurements').select('*').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('model_market_assignments').select('*,markets!model_market_market_same_org_fk(id,name,code,city)').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('model_division_assignments').select('*,divisions!model_division_division_same_org_fk(id,name),boards!model_division_board_same_org_fk(id,name)').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('model_staff_assignments').select('*').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('organization_members').select('id,user_id,job_title').eq('organization_id',organization.id).eq('member_type','staff')),
      canMedia&&mediaIds.length?rows(admin.from('model_media_versions').select('*').eq('organization_id',organization.id).in('media_id',mediaIds).order('created_at',{ascending:false})):Promise.resolve([]),
      canMedia?rows(admin.from('model_portfolio_sets').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('updated_at',{ascending:false})):Promise.resolve([]),
      canPublic?one(admin.from('model_public_profiles').select('*').eq('organization_id',organization.id).eq('model_id',modelId)):Promise.resolve(null),
      canPublic?rows(admin.from('model_comp_cards').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('updated_at',{ascending:false})):Promise.resolve([]),
      rows(admin.from('model_tag_assignments').select('tag_id,model_tags(id,name,category,color)').eq('organization_id',organization.id).eq('model_id',modelId)),
      rows(admin.from('model_skill_assignments').select('skill_id,proficiency,verified,note,model_skills(id,name,category)').eq('organization_id',organization.id).eq('model_id',modelId))
    ]);
    const staffUserIds=staffMembers.map(x=>x.user_id).filter(Boolean);
    const profiles=staffUserIds.length?await rows(admin.from('profiles').select('user_id,display_name,avatar_url').in('user_id',staffUserIds)):[];
    const setIds=sets.map(x=>x.id);
    const setItems=canMedia&&setIds.length?await rows(admin.from('model_portfolio_set_items').select('*').eq('organization_id',organization.id).in('portfolio_set_id',setIds)):[];
    let privateProfile=null;if(canPrivate)privateProfile=await one(admin.from('model_private_profiles').select('*').eq('organization_id',organization.id).eq('model_id',modelId));
    const memberMap=new Map(staffMembers.map(x=>[x.id,x])),profileMap=new Map(profiles.map(x=>[x.user_id,x]));
    const staff=staffAssignments.map(a=>{const m=memberMap.get(a.member_id);return {...a,member:m?{...m,profile:profileMap.get(m.user_id)||null}:null};});
    return json(200,{environment:'veux-saas-v10',organization,model,measurements,private_profile:privateProfile,markets,divisions,staff,media,media_versions:versions,portfolio_sets:sets.map(s=>({...s,items:setItems.filter(i=>i.portfolio_set_id===s.id)})),public_profile:publicProfile,comp_cards:compCards,tags:tags.map(x=>x.model_tags).filter(Boolean),skills:skills.map(x=>({...x.model_skills,proficiency:x.proficiency,verified:x.verified,note:x.note})).filter(x=>x.id),access:{media:canMedia,media_write:canMediaWrite,private:canPrivate,public_profiles:canPublic,public_profiles_manage:canPublicManage}});
  }catch(error){return errorResponse(error);}
};
