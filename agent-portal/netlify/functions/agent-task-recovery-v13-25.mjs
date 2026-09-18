import { requireUser, parseBody, json, errorResponse, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){ const {data,error}=await q; if(error) throw error; return data||[]; }
function norm(v){ return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' '); }
function legacyOwner(task){
  const m=task?.metadata||{};
  const p=m.legacy_payload||{};
  return String(m.legacy_to_key||p.toKey||p.owner||p.assignee||'').trim();
}
function displayMember(m){ return m?.profile?.display_name || m?.job_title || m?.email || 'Staff'; }
function suggest(task,members){
  const owner=norm(legacyOwner(task));
  const hay=norm([task.title,task.category,task.description].filter(Boolean).join(' '));
  let best=null,score=0,why='';
  for(const m of members){
    const name=norm(displayMember(m)); const title=norm(m.job_title);
    let s=0,r='';
    if(owner && name && (name.includes(owner)||owner.includes(name))){s=100;r='legacy owner match';}
    else if(owner && title && (title.includes(owner)||owner.includes(title))){s=90;r='legacy role match';}
    else {
      const rules=[
        [/visa|immigration|travel|passport/,/travel|visa|mobility/],
        [/invoice|payment|commission|accounting|finance/,/account|finance/],
        [/press|pr|media|editorial/,/press|pr|marketing/],
        [/social|content|instagram|tiktok/,/social|content|marketing/],
        [/walk|runway|pose|movement/,/movement|pose|development/],
        [/creative|shoot|test|image/,/creative|image|photo/],
        [/booking|casting|client|option|hold/,/booker|director|founder/]
      ];
      for(const [taskRx,roleRx] of rules){ if(taskRx.test(hay)&&roleRx.test(title)){s=Math.max(s,65);r='role/category match';} }
    }
    if(s>score){best=m;score=s;why=r;}
  }
  return best&&score>=60?{member_id:best.id,member_name:displayMember(best),score,reason:why}:null;
}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod)) return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,event.httpMethod==='POST'?'tasks.manage':'tasks.read');

    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(!['assign','bulk_assign'].includes(action)) return json(400,{error:'Unsupported recovery action'});
      const ids=action==='assign'?[body.task_id]:(Array.isArray(body.task_ids)?body.task_ids:[]);
      const taskIds=[...new Set(ids.filter(Boolean))];
      const memberId=String(body.member_id||'').trim();
      if(!taskIds.length) return json(400,{error:'No tasks selected'});
      if(!memberId) return json(400,{error:'member_id is required'});
      const member=await rows(admin.from('organization_members').select('id').eq('organization_id',organization.id).eq('id',memberId).eq('member_type','staff').limit(1));
      if(!member.length) return json(400,{error:'Staff member not found'});
      const existing=await rows(admin.from('task_assignments').select('task_id').eq('organization_id',organization.id).in('task_id',taskIds));
      const already=new Set(existing.map(x=>x.task_id));
      const insertIds=taskIds.filter(id=>!already.has(id));
      if(insertIds.length){
        const payload=insertIds.map(taskId=>({organization_id:organization.id,task_id:taskId,member_id:memberId,assignment_role:'assignee',assigned_by:user.id}));
        const {error}=await admin.from('task_assignments').insert(payload); if(error) throw error;
      }
      return json(200,{ok:true,requested:taskIds.length,assigned:insertIds.length,skipped_existing:taskIds.length-insertIds.length});
    }

    const [tasks,assignments,members,profiles]=await Promise.all([
      rows(admin.from('tasks').select('id,title,description,status,priority,due_at,category,source,model_id,metadata').eq('organization_id',organization.id).not('status','in','("completed","cancelled")').order('due_at',{ascending:true,nullsFirst:false}).limit(1500)),
      rows(admin.from('task_assignments').select('task_id,member_id,model_id,partner_agency_id').eq('organization_id',organization.id).limit(4000)),
      rows(admin.from('organization_members').select('id,user_id,job_title,status').eq('organization_id',organization.id).eq('member_type','staff').in('status',['active','invited']).order('job_title')),
      rows(admin.from('profiles').select('user_id,display_name,email,avatar_url'))
    ]);
    const profileMap=new Map(profiles.map(x=>[x.user_id,x]));
    const staff=members.map(m=>({...m,profile:profileMap.get(m.user_id)||null}));
    const assigned=new Set(assignments.map(a=>a.task_id));
    const unassigned=tasks.filter(t=>!assigned.has(t.id)).map(t=>({...t,legacy_owner:legacyOwner(t)||null,suggestion:suggest(t,staff)}));
    const groups={};
    for(const t of unassigned){const k=t.legacy_owner||'No legacy owner';groups[k]=(groups[k]||0)+1;}
    const canManage=await assertPermission(admin,user.id,organization.id,'tasks.manage');
    return json(200,{environment:'veux-v13.25-task-recovery',organization:{id:organization.id,name:organization.name,slug:organization.slug},summary:{open_tasks:tasks.length,unassigned:unassigned.length,legacy_owner_groups:Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([owner,count])=>({owner,count}))},tasks:unassigned,members:staff,access:{manage:canManage}});
  }catch(error){ return errorResponse(error); }
};
