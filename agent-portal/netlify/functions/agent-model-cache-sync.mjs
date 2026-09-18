import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission, findModel } from './_lib/agent-bridge.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);const body=parseBody(event);
    const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug});
    const admin=await requirePermission(user.id,organization.id,'models.write');
    const measurements=body.measurements&&typeof body.measurements==='object'?body.measurements:{};
    const headshots=body.headshots&&typeof body.headshots==='object'?body.headshots:{};
    const privateProfiles=body.private_profiles&&typeof body.private_profiles==='object'?body.private_profiles:{};
    const canPrivate=await import('./_lib/auth.mjs').then(m=>m.assertPermission(admin,user.id,organization.id,'models.private.write'));
    let mCount=0,hCount=0,pCount=0;
    for(const [key,m] of Object.entries(measurements)){
      const model=await findModel(admin,organization.id,key);if(!model)continue;
      const payload={organization_id:organization.id,model_id:model.id,height_display:m.height||null,bust_display:m.bust||null,chest_display:m.chest||null,
        waist_display:m.waist||null,hips_display:m.hips||null,dress:m.dress||null,suit:m.suit||null,shoe:m.shoe||null,hair:m.hair||null,eyes:m.eyes||null,
        skin:m.skin||null,notes:m.notes||null,metadata:{legacy:m}};
      const {error}=await admin.from('model_measurements').upsert(payload,{onConflict:'model_id'});if(error)throw error;mCount++;
    }
    for(const [key,url] of Object.entries(headshots)){
      const model=await findModel(admin,organization.id,key);if(!model)continue;
      const legacyId=`headshot:${key}`;
      if(!url){const {error}=await admin.from('model_media').delete().eq('organization_id',organization.id).eq('legacy_id',legacyId);if(error)throw error;continue;}
      if(!/^https?:\/\//i.test(String(url)))continue;
      const {error}=await admin.from('model_media').upsert({organization_id:organization.id,model_id:model.id,legacy_id:legacyId,media_type:'image',category:'Headshot',
        provider:String(url).includes('cloudinary')?'cloudinary':'legacy',url,is_primary:true,is_public:true,metadata:{bridge:'agent-v4'}},{onConflict:'organization_id,legacy_id'});if(error)throw error;hCount++;
    }
    if(canPrivate){
      for(const [key,p] of Object.entries(privateProfiles)){
        const model=await findModel(admin,organization.id,key);if(!model)continue;
        const {error}=await admin.from('model_private_profiles').upsert({organization_id:organization.id,model_id:model.id,email:p.email||null,phone:p.phone||null,
          whatsapp:p.whatsapp||null,instagram:p.instagram||null,metadata:{legacy:p}},{onConflict:'model_id'});if(error)throw error;pCount++;
      }
    }
    return json(200,{ok:true,measurements:mCount,headshots:hCount,private_profiles:pCount});
  }catch(error){return errorResponse(error);}
};
