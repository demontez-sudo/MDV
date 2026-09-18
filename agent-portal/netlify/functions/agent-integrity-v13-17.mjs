import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

function check(key,label,status,detail,group='Relational Integrity',meta={}){return {key,label,status,detail,group,meta};}
function ids(rows){return new Set((rows||[]).map(x=>String(x.id)));}
function missing(rows,field,set){return (rows||[]).filter(x=>x[field]&& !set.has(String(x[field])));}
function countBy(rows,key){const out={}; for(const r of rows||[]){const k=String(r[key]??'unknown');out[k]=(out[k]||0)+1;} return out;}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'org.settings.manage');
    const orgId=organization.id;
    const tables={
      models:'id,status,stage', companies:'id', contacts:'id', organization_members:'id,user_id,status', partner_agencies:'id,portal_enabled',
      bookings:'id,status,company_id,primary_contact_id,assigned_member_id', booking_models:'id,booking_id,model_id,status',
      castings:'id,status,company_id,primary_contact_id,assigned_member_id', casting_models:'id,casting_id,model_id,status',
      events:'id,status,event_type,booking_id,casting_id,company_id,contact_id,owner_member_id', event_models:'id,event_id,model_id,visible_to_model',
      tasks:'id,status,model_id,booking_id,casting_id,company_id,contact_id,partner_agency_id', task_assignments:'id,task_id,member_id,model_id,partner_agency_id',
      packages:'id,status,company_id,primary_contact_id', package_models:'id,package_id,model_id,visible', package_recipients:'id,package_id,company_id,contact_id,email',
      documents:'id,status,visibility', document_links:'id,document_id,resource_type,resource_id,visible_to_model,visible_to_partner'
    };
    const q=async(name)=>{
      const r=await admin.from(name).select(tables[name]).eq('organization_id',orgId);
      if(r.error) throw new Error(`${name}: ${r.error.message}`);
      return r.data||[];
    };
    const [models,companies,contacts,members,partners,bookings,bookingModels,castings,castingModels,events,eventModels,tasks,taskAssignments,packages,packageModels,packageRecipients,documents,documentLinks]=await Promise.all([
      q('models'),q('companies'),q('contacts'),q('organization_members'),q('partner_agencies'),q('bookings'),q('booking_models'),q('castings'),q('casting_models'),q('events'),q('event_models'),q('tasks'),q('task_assignments'),q('packages'),q('package_models'),q('package_recipients'),q('documents'),q('document_links')
    ]);
    const modelIds=ids(models), companyIds=ids(companies), contactIds=ids(contacts), memberIds=ids(members), partnerIds=ids(partners), bookingIds=ids(bookings), castingIds=ids(castings), eventIds=ids(events), taskIds=ids(tasks), packageIds=ids(packages), documentIds=ids(documents);
    const checks=[];

    const bmBad=[...missing(bookingModels,'booking_id',bookingIds),...missing(bookingModels,'model_id',modelIds)];
    checks.push(check('booking-links','Booking ↔ model links',bmBad.length?'fail':'pass',bmBad.length?`${bmBad.length} invalid booking/model relationship reference(s)`:`${bookingModels.length} booking-model link(s) valid`,'Bookings'));
    const bookingsWithoutModels=bookings.filter(b=>!bookingModels.some(x=>String(x.booking_id)===String(b.id)) && !['cancelled','closed'].includes(String(b.status||'')));
    checks.push(check('booking-coverage','Active bookings have models',bookingsWithoutModels.length?'warn':'pass',bookingsWithoutModels.length?`${bookingsWithoutModels.length} active booking(s) have no model attached`:'All active bookings have at least one model','Bookings',{ids:bookingsWithoutModels.slice(0,20).map(x=>x.id)}));

    const cmBad=[...missing(castingModels,'casting_id',castingIds),...missing(castingModels,'model_id',modelIds)];
    checks.push(check('casting-links','Casting ↔ model links',cmBad.length?'fail':'pass',cmBad.length?`${cmBad.length} invalid casting/model relationship reference(s)`:`${castingModels.length} casting-model link(s) valid`,'Castings'));
    const openCastingsWithoutModels=castings.filter(c=>['open','submitted','callback'].includes(String(c.status||''))&&!castingModels.some(x=>String(x.casting_id)===String(c.id)));
    checks.push(check('casting-coverage','Open castings have submissions',openCastingsWithoutModels.length?'warn':'pass',openCastingsWithoutModels.length?`${openCastingsWithoutModels.length} open/submitted casting(s) have no model rows`:'Open castings have model rows','Castings'));

    const eventBad=[...missing(eventModels,'event_id',eventIds),...missing(eventModels,'model_id',modelIds),...missing(events,'booking_id',bookingIds),...missing(events,'casting_id',castingIds),...missing(events,'company_id',companyIds),...missing(events,'contact_id',contactIds),...missing(events,'owner_member_id',memberIds)];
    checks.push(check('calendar-links','Calendar relational links',eventBad.length?'fail':'pass',eventBad.length?`${eventBad.length} calendar reference(s) point outside the organization inventory`:`${events.length} event(s) and ${eventModels.length} event-model link(s) valid`,'Calendar'));

    const taskBad=[...missing(taskAssignments,'task_id',taskIds),...missing(taskAssignments,'member_id',memberIds),...missing(taskAssignments,'model_id',modelIds),...missing(taskAssignments,'partner_agency_id',partnerIds),...missing(tasks,'model_id',modelIds),...missing(tasks,'booking_id',bookingIds),...missing(tasks,'casting_id',castingIds),...missing(tasks,'company_id',companyIds),...missing(tasks,'contact_id',contactIds),...missing(tasks,'partner_agency_id',partnerIds)];
    checks.push(check('task-links','Task ownership links',taskBad.length?'fail':'pass',taskBad.length?`${taskBad.length} invalid task relationship reference(s)`:`${tasks.length} task(s), ${taskAssignments.length} assignment(s) relationally valid`,'Tasks'));
    const unassigned=tasks.filter(t=>!['completed','cancelled'].includes(String(t.status||''))&&!taskAssignments.some(a=>String(a.task_id)===String(t.id)));
    checks.push(check('task-coverage','Open task assignment coverage',unassigned.length?'warn':'pass',unassigned.length?`${unassigned.length} open task(s) have no assignment`:'Every open task has an assignment','Tasks',{ids:unassigned.slice(0,20).map(x=>x.id)}));

    const packageBad=[...missing(packageModels,'package_id',packageIds),...missing(packageModels,'model_id',modelIds),...missing(packageRecipients,'package_id',packageIds),...missing(packageRecipients,'company_id',companyIds),...missing(packageRecipients,'contact_id',contactIds),...missing(packages,'company_id',companyIds),...missing(packages,'primary_contact_id',contactIds)];
    checks.push(check('package-links','Package relational links',packageBad.length?'fail':'pass',packageBad.length?`${packageBad.length} invalid package relationship reference(s)`:`${packages.length} package(s) structurally linked`,'Packages'));
    const sentNoRecipient=packages.filter(p=>['sent','active'].includes(String(p.status||''))&&!packageRecipients.some(r=>String(r.package_id)===String(p.id)));
    const activeNoModels=packages.filter(p=>['ready','sent','active'].includes(String(p.status||''))&&!packageModels.some(m=>String(m.package_id)===String(p.id)&&m.visible!==false));
    const pkgWarn=sentNoRecipient.length+activeNoModels.length;
    checks.push(check('package-readiness','Package send readiness',pkgWarn?'warn':'pass',pkgWarn?`${sentNoRecipient.length} sent/active without recipient · ${activeNoModels.length} ready/sent/active without visible models`:'Active packages have recipients and visible models','Packages'));

    const docBad=missing(documentLinks,'document_id',documentIds);
    checks.push(check('document-links','Document link integrity',docBad.length?'fail':'pass',docBad.length?`${docBad.length} document link(s) reference a missing document`:`${documentLinks.length} document link(s) valid`,'Documents'));
    const sharedWithoutLink=documents.filter(d=>['model_shared','partner_shared'].includes(String(d.visibility||''))&&!documentLinks.some(l=>String(l.document_id)===String(d.id)));
    const visibilityMismatch=documentLinks.filter(l=>(l.visible_to_model||l.visible_to_partner)&&!['model','booking','casting','partner_agency','package','task','event','contract','travel','visa','season'].includes(String(l.resource_type||'')));
    checks.push(check('document-sharing','Document sharing consistency',(sharedWithoutLink.length||visibilityMismatch.length)?'warn':'pass',(sharedWithoutLink.length||visibilityMismatch.length)?`${sharedWithoutLink.length} shared document(s) have no resource link · ${visibilityMismatch.length} unusual visible link(s)`:'Shared documents have explicit resource links','Documents'));

    const bookingRefs=[...missing(bookings,'company_id',companyIds),...missing(bookings,'primary_contact_id',contactIds),...missing(bookings,'assigned_member_id',memberIds)];
    const castingRefs=[...missing(castings,'company_id',companyIds),...missing(castings,'primary_contact_id',contactIds),...missing(castings,'assigned_member_id',memberIds)];
    checks.push(check('crm-operational-links','CRM references from bookings/castings',(bookingRefs.length||castingRefs.length)?'fail':'pass',(bookingRefs.length||castingRefs.length)?`${bookingRefs.length+castingRefs.length} booking/casting CRM reference(s) invalid`:'Booking and casting CRM references are valid','CRM'));

    const duplicateRecipientKeys={};
    for(const r of packageRecipients){const k=`${r.package_id}|${String(r.email||'').trim().toLowerCase()}`; if(r.email)duplicateRecipientKeys[k]=(duplicateRecipientKeys[k]||0)+1;}
    const duplicateRecipients=Object.values(duplicateRecipientKeys).filter(n=>n>1).length;
    checks.push(check('duplicate-package-recipients','Duplicate package recipient rows',duplicateRecipients?'warn':'pass',duplicateRecipients?`${duplicateRecipients} package/email combination(s) appear more than once`:'No duplicate package/email recipient combinations detected','Packages'));

    const fail=checks.filter(x=>x.status==='fail').length,warn=checks.filter(x=>x.status==='warn').length,pass=checks.filter(x=>x.status==='pass').length;
    const gate=fail?'blocked':warn?'review':'clean';
    return json(200,{environment:'veux-v13.17-relational-integrity',generated_at:new Date().toISOString(),organization:{id:orgId,name:organization.name,slug:organization.slug},gate,summary:{pass,warn,fail,total:checks.length},inventory:{models:models.length,companies:companies.length,contacts:contacts.length,members:members.length,partners:partners.length,bookings:bookings.length,booking_models:bookingModels.length,castings:castings.length,casting_models:castingModels.length,events:events.length,event_models:eventModels.length,tasks:tasks.length,task_assignments:taskAssignments.length,packages:packages.length,package_models:packageModels.length,package_recipients:packageRecipients.length,documents:documents.length,document_links:documentLinks.length},status_counts:{bookings:countBy(bookings,'status'),castings:countBy(castings,'status'),tasks:countBy(tasks,'status'),packages:countBy(packages,'status')},checks});
  }catch(error){return errorResponse(error);}
};
