import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'site.control');

    const [models,publicProfiles,media]=await Promise.all([
      rows(admin.from('models').select('id,display_name,legacy_key,public_slug,gender,stage,status').eq('organization_id',organization.id).eq('active',true)),
      rows(admin.from('model_public_profiles').select('model_id,published,updated_at').eq('organization_id',organization.id)),
      rows(admin.from('model_media').select('model_id,is_primary,is_public,category').eq('organization_id',organization.id))
    ]);

    const profileByModel=new Map(publicProfiles.map(p=>[String(p.model_id),p]));
    const mediaByModel=new Map();
    for(const m of media){
      const k=String(m.model_id);
      if(!mediaByModel.has(k))mediaByModel.set(k,[]);
      mediaByModel.get(k).push(m);
    }

    const noMedia=[],noPublicHeadshot=[],publishedNoHeadshot=[],unpublishedDraft=[],noProfile=[];
    for(const m of models){
      const list=mediaByModel.get(String(m.id))||[];
      const profile=profileByModel.get(String(m.id))||null;
      const hasPublicHeadshot=list.some(x=>x.is_primary&&x.is_public);
      if(!list.length)noMedia.push(m);
      else if(!hasPublicHeadshot)noPublicHeadshot.push(m);
      if(!profile)noProfile.push(m);
      else if(profile.published&&!hasPublicHeadshot)publishedNoHeadshot.push(m);
      else if(!profile.published)unpublishedDraft.push(m);
    }

    return json(200,{
      ok:true,
      counts:{
        models:models.length,
        published:publicProfiles.filter(p=>p.published).length,
        draft:unpublishedDraft.length,
        no_profile:noProfile.length,
        no_media:noMedia.length,
        no_public_headshot:noPublicHeadshot.length,
        published_missing_headshot:publishedNoHeadshot.length
      },
      no_profile:noProfile.map(m=>({id:m.id,display_name:m.display_name})),
      no_media:noMedia.map(m=>({id:m.id,display_name:m.display_name})),
      published_missing_headshot:publishedNoHeadshot.map(m=>({id:m.id,display_name:m.display_name})),
      unpublished_draft:unpublishedDraft.map(m=>({id:m.id,display_name:m.display_name}))
    });
  }catch(error){return errorResponse(error);}
};
