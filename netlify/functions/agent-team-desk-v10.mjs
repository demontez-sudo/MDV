import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(action==='set_status'){
        await requirePermission(user.id,organization.id,'members.manage');const {data,error}=await client.rpc('set_member_status',{target_org:organization.id,target_member:body.member_id,target_status:body.status});if(error)throw error;return json(200,{ok:true,verified:true,member:data,persisted_at:data?.updated_at||new Date().toISOString()});
      }
      if(action==='set_roles'){
        await requirePermission(user.id,organization.id,'members.manage');const {data,error}=await client.rpc('set_member_roles',{target_org:organization.id,target_member:body.member_id,target_role_ids:Array.isArray(body.role_ids)?body.role_ids:[]});if(error)throw error;return json(200,{ok:true,verified:true,result:data,persisted_at:new Date().toISOString()});
      }
      const admin=await requirePermission(user.id,organization.id,'members.manage');
      if(action==='update_member'){
        const payload={};for(const k of ['job_title'])if(body[k]!==undefined)payload[k]=body[k];if(body.metadata!==undefined)payload.metadata=body.metadata;
        const {data,error}=await admin.from('organization_members').update(payload).eq('organization_id',organization.id).eq('id',body.member_id).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,member:data,persisted_at:data?.updated_at||new Date().toISOString()});
      }
      if(action==='set_scope'){
        const {data,error}=await client.rpc('set_member_access_scope',{target_org:organization.id,target_member:body.member_id,scope_type_value:body.scope_type,scope_id_value:body.scope_id||null,access_level_value:body.access_level||'work',enabled_value:body.enabled!==false});if(error)throw error;
        return json(200,{ok:true,verified:true,scope:data,persisted_at:new Date().toISOString()});
      }
      return json(400,{error:'Unsupported team action'});
    }
    const admin=await requirePermission(user.id,organization.id,'members.read');
    const [members,roles,scopes,preferences,markets,divisions,boards,offices]=await Promise.all([
      rows(admin.from('organization_members').select('*').eq('organization_id',organization.id).eq('member_type','staff').order('created_at')),
      rows(admin.from('roles').select('*').or(`organization_id.is.null,organization_id.eq.${organization.id}`).not('key','in','(model,partner)').order('name')),
      rows(admin.from('member_access_scopes').select('*').eq('organization_id',organization.id)),
      rows(admin.from('member_preferences').select('*').eq('organization_id',organization.id)),
      rows(admin.from('markets').select('id,name').eq('organization_id',organization.id).eq('active',true)),
      rows(admin.from('divisions').select('id,name').eq('organization_id',organization.id).eq('active',true)),
      rows(admin.from('boards').select('id,name,market_id,division_id').eq('organization_id',organization.id).eq('active',true)),
      rows(admin.from('offices').select('id,name,market_id').eq('organization_id',organization.id).eq('active',true))
    ]);
    const memberIds=members.map(m=>m.id);
    const userIds=members.map(m=>m.user_id).filter(Boolean);
    const roleIds=roles.map(r=>r.id);
    const [profiles,roleLinks,rolePermissions]=await Promise.all([
      userIds.length?rows(admin.from('profiles').select('user_id,display_name,first_name,last_name,avatar_url,status,timezone').in('user_id',userIds)):Promise.resolve([]),
      memberIds.length?rows(admin.from('member_roles').select('member_id,role_id').in('member_id',memberIds)):Promise.resolve([]),
      roleIds.length?rows(admin.from('role_permissions').select('role_id,permission_key').in('role_id',roleIds)):Promise.resolve([])
    ]);
    const profileMap=new Map(profiles.map(x=>[x.user_id,x])),roleMap=new Map(roles.map(r=>[r.id,{...r,permissions:rolePermissions.filter(x=>x.role_id===r.id).map(x=>x.permission_key)}]));
    const team=members.map(m=>({...m,profile:profileMap.get(m.user_id)||null,roles:roleLinks.filter(x=>x.member_id===m.id).map(x=>roleMap.get(x.role_id)).filter(Boolean),scopes:scopes.filter(x=>x.member_id===m.id),preferences:preferences.find(x=>x.member_id===m.id)||null}));
    const canManage=await assertPermission(admin,user.id,organization.id,'members.manage');return json(200,{environment:'veux-saas-v10',organization,team,roles:[...roleMap.values()],structure:{markets,divisions,boards,offices},access:{manage:canManage}});
  }catch(error){return errorResponse(error);}
};
