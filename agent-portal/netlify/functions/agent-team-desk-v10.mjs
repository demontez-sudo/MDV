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
      /* ---- custom roles: create, change what a role allows, delete ---- */
      if(['create_role','save_role','delete_role'].includes(action)){
        const KEY=/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
        const cleanPerms=async()=>{
          const want=[...new Set((Array.isArray(body.permissions)?body.permissions:[]).map(x=>String(x||'').trim()).filter(Boolean))];
          if(want.some(k=>!KEY.test(k)||k.length>80))throw Object.assign(new Error('Unknown permission'),{statusCode:400,publicMessage:'One of the permissions is not valid.'});
          /* nobody can hand out access they do not have themselves */
          for(const k of want){if(!await assertPermission(admin,user.id,organization.id,k))throw Object.assign(new Error('No such access'),{statusCode:403,publicMessage:'You can only give a role access that you have yourself ('+k+').'});}
          return want;
        };
        const ownedRole=async(id)=>{
          const {data,error}=await admin.from('roles').select('*').eq('id',id).maybeSingle();if(error)throw error;
          if(!data)throw Object.assign(new Error('not found'),{statusCode:404,publicMessage:'That role was not found.'});
          if(data.organization_id!==organization.id)throw Object.assign(new Error('system role'),{statusCode:403,publicMessage:'Built-in roles cannot be changed. Make a copy of it as a new role instead.'});
          return data;
        };
        const withPerms=async(role)=>{const {data,error}=await admin.from('role_permissions').select('permission_key').eq('role_id',role.id);if(error)throw error;return {...role,permissions:(data||[]).map(x=>x.permission_key)};};
        const setPerms=async(roleId,keys)=>{
          const {error:de}=await admin.from('role_permissions').delete().eq('role_id',roleId);if(de)throw de;
          if(keys.length){const {error:ie}=await admin.from('role_permissions').insert(keys.map(k=>({role_id:roleId,permission_key:k})));if(ie)throw ie;}
        };
        if(action==='create_role'){
          const name=String(body.name||'').trim().slice(0,60);if(!name)throw Object.assign(new Error('name'),{statusCode:400,publicMessage:'Give the role a name.'});
          const keys=await cleanPerms();
          const base='custom-'+(name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'role');
          let role=null,tryKey=base;
          for(let i=0;i<4&&!role;i++){
            const {data,error}=await admin.from('roles').insert({organization_id:organization.id,key:tryKey,name}).select('*').single();
            if(!error){role=data;break;}
            if(String(error.code)==='23505'){tryKey=base+'-'+Math.random().toString(36).slice(2,6);continue;}
            throw error;
          }
          if(!role)throw Object.assign(new Error('key'),{statusCode:409,publicMessage:'A role with that name already exists.'});
          await setPerms(role.id,keys);
          return json(200,{ok:true,verified:true,role:await withPerms(role),persisted_at:new Date().toISOString()});
        }
        if(action==='save_role'){
          const role=await ownedRole(body.role_id);
          const keys=await cleanPerms();
          const name=String(body.name||'').trim().slice(0,60);
          if(name&&name!==role.name){const {error}=await admin.from('roles').update({name}).eq('id',role.id);if(error)throw error;role.name=name;}
          await setPerms(role.id,keys);
          return json(200,{ok:true,verified:true,role:await withPerms(role),persisted_at:new Date().toISOString()});
        }
        const role=await ownedRole(body.role_id);
        const {count,error:ce}=await admin.from('member_roles').select('member_id',{count:'exact',head:true}).eq('role_id',role.id);if(ce)throw ce;
        if(count)throw Object.assign(new Error('in use'),{statusCode:409,publicMessage:'This role is still given to '+count+' '+(count===1?'person':'people')+'. Move them to another role first.'});
        await admin.from('role_permissions').delete().eq('role_id',role.id);
        const {error:de}=await admin.from('roles').delete().eq('id',role.id);if(de)throw de;
        return json(200,{ok:true,verified:true,deleted:role.id,persisted_at:new Date().toISOString()});
      }
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
