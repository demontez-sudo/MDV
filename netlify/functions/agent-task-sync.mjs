import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission, uuidish, findModel, findMember } from './_lib/agent-bridge.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const body=parseBody(event);
    const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug});
    const admin=await requirePermission(user.id,organization.id,'tasks.write');
    const tasks=Array.isArray(body.tasks)?body.tasks:[];
    const deleted=Array.isArray(body.deleted_ids)?body.deleted_ids:[];
    const idMap={};

    for(const raw of deleted){
      let q=admin.from('tasks').delete().eq('organization_id',organization.id);
      q=uuidish(raw)?q.eq('id',raw):q.eq('legacy_id',String(raw));
      const {error}=await q;if(error)throw error;
    }

    for(const t of tasks){
      if(!t?.title) continue;
      const originalId=String(t.id||'').trim()||null;
      const model=await findModel(admin,organization.id,t.modelKey||t.model_id||t.model||null);
      const statusMap={done:'completed',complete:'completed',completed:'completed',open:'open','in progress':'in_progress',in_progress:'in_progress',blocked:'blocked',waiting:'waiting',cancelled:'cancelled'};
      const status=statusMap[String(t.status||'open').toLowerCase()]||'open';
      const priority=['low','normal','high','urgent','critical'].includes(String(t.priority||'normal').toLowerCase())?String(t.priority||'normal').toLowerCase():'normal';
      let dueAt=null;
      if(t.due){ const d=new Date(/T/.test(t.due)?t.due:`${t.due}T23:59:00Z`); if(!Number.isNaN(d.getTime())) dueAt=d.toISOString(); }
      const payload={organization_id:organization.id,title:t.title,description:t.body||t.description||null,status,priority,due_at:dueAt,
        category:t.category||null,model_id:model?.id||null,visibility:t.isPersonal?'private':'organization',source:t.source||'manual',created_by:user.id,
        metadata:{legacy_payload:t,legacy_from_key:t.fromKey||null,legacy_to_key:t.toKey||t.owner||null}};
      let row=null,error=null;
      if(originalId&&uuidish(originalId))({data:row,error}=await admin.from('tasks').update(payload).eq('organization_id',organization.id).eq('id',originalId).select('*').single());
      else {payload.legacy_id=originalId||`bridge:${crypto.randomUUID()}`;({data:row,error}=await admin.from('tasks').upsert(payload,{onConflict:'organization_id,legacy_id'}).select('*').single());}
      if(error)throw error;if(originalId)idMap[originalId]=row.id;

      const assignmentDelete=await admin.from('task_assignments').delete().eq('organization_id',organization.id).eq('task_id',row.id);if(assignmentDelete.error)throw assignmentDelete.error;
      const member=await findMember(admin,organization.id,t.toKey||t.owner||null);
      if(member){
        const a=await admin.from('task_assignments').insert({organization_id:organization.id,task_id:row.id,member_id:member.id,assignment_role:'assignee',assigned_by:user.id});if(a.error)throw a.error;
      }else if(model){
        const a=await admin.from('task_assignments').insert({organization_id:organization.id,task_id:row.id,model_id:model.id,assignment_role:'assignee',assigned_by:user.id});if(a.error)throw a.error;
      }
    }
    return json(200,{ok:true,id_map:idMap});
  }catch(error){return errorResponse(error);}
};
