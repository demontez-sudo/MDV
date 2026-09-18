import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
const num=v=>Number(v||0);
const now=()=>Date.now();
function ageDays(v){if(!v)return null;const t=new Date(v).getTime();return Number.isFinite(t)?Math.max(0,Math.floor((now()-t)/86400000)):null;}
function maxDate(values){let best=null,bestT=0;for(const v of values){const t=new Date(v||0).getTime();if(Number.isFinite(t)&&t>bestT){bestT=t;best=v;}}return best;}
function statusBand(score,lastDays,outstanding,status){
  if(String(status||'').toLowerCase()==='prospect')return 'Prospect';
  if(outstanding>0)return lastDays!=null&&lastDays>45?'Attention':'Active';
  if(score>=80)return 'Priority'; if(score>=62)return 'Active'; if(score>=44)return 'Warm'; return 'Dormant';
}
function scoreRelationship({status,tier,interactions,bookings,castings,packages,opens,lastDays,outstanding,paid}){
  let s=25;
  const st=String(status||'').toLowerCase();if(st==='active')s+=10;if(st==='prospect')s+=2;if(st==='inactive')s-=18;
  const tr=String(tier||'').toLowerCase();if(/vip|a|priority|key|top/.test(tr))s+=10;
  s+=Math.min(15,interactions*1.5)+Math.min(18,bookings*4)+Math.min(10,castings*1.5)+Math.min(12,packages*2)+Math.min(8,opens);
  if(paid>0)s+=Math.min(8,Math.log10(paid+1)*1.4);
  if(lastDays==null)s-=8;else if(lastDays<=7)s+=8;else if(lastDays<=30)s+=4;else if(lastDays>120)s-=12;else if(lastDays>60)s-=6;
  if(outstanding>0)s-=Math.min(12,4+Math.log10(outstanding+1));
  return Math.max(0,Math.min(100,Math.round(s)));
}
function nextAction({status,lastDays,outstanding,contacts,packages,bookings}){
  if(outstanding>0)return `Follow up on ${Math.round(outstanding).toLocaleString()} outstanding`;
  if(!contacts)return 'Add a primary decision-maker contact';
  if(String(status||'').toLowerCase()==='prospect')return 'Plan first outreach and log the relationship';
  if(lastDays==null||lastDays>75)return 'Re-engage relationship this week';
  if(!packages&&!bookings)return 'Send a targeted model package';
  if(lastDays>30)return 'Schedule a relationship follow-up';
  return 'Keep warm · review upcoming needs';
}
function companyInsight(c,ctx){
  const act=ctx.activity.filter(x=>x.company_id===c.id),bs=ctx.bookings.filter(x=>x.company_id===c.id),cs=ctx.castings.filter(x=>x.company_id===c.id),ps=ctx.packages.filter(x=>x.company_id===c.id),ins=ctx.invoices.filter(x=>x.company_id===c.id),rec=ctx.recipients.filter(x=>x.company_id===c.id),links=ctx.links.filter(x=>x.company_id===c.id);
  const last=maxDate([...act.map(x=>x.occurred_at),...bs.map(x=>x.updated_at||x.starts_at),...cs.map(x=>x.updated_at||x.starts_at),...ps.map(x=>x.updated_at||x.created_at),...rec.map(x=>x.last_viewed_at||x.opened_at||x.sent_at)]),lastDays=ageDays(last);
  const outstanding=ins.reduce((n,x)=>n+num(x.amount_due),0),invoiced=ins.reduce((n,x)=>n+num(x.total),0),paid=ins.reduce((n,x)=>n+num(x.amount_paid),0),opens=rec.reduce((n,x)=>n+num(x.view_count||((x.opened_at||x.first_viewed_at)?1:0)),0);
  const contactIds=new Set([...links.map(x=>x.contact_id),...ctx.contacts.filter(x=>x.company_id===c.id).map(x=>x.id)]);
  const score=scoreRelationship({status:c.status,tier:c.tier,interactions:act.length,bookings:bs.length,castings:cs.length,packages:ps.length,opens,lastDays,outstanding,paid});
  return {company_id:c.id,score,band:statusBand(score,lastDays,outstanding,c.status),last_activity_at:last,last_activity_days:lastDays,contact_count:contactIds.size,booking_count:bs.length,casting_count:cs.length,package_count:ps.length,package_views:opens,invoiced_total:invoiced,paid_total:paid,outstanding_total:outstanding,next_action:nextAction({status:c.status,lastDays,outstanding,contacts:contactIds.size,packages:ps.length,bookings:bs.length}),summary:[contactIds.size?`${contactIds.size} contact${contactIds.size===1?'':'s'}`:null,bs.length?`${bs.length} booking${bs.length===1?'':'s'}`:null,ps.length?`${ps.length} package${ps.length===1?'':'s'}`:null,lastDays!=null?`active ${lastDays}d ago`:'no logged activity'].filter(Boolean).join(' · ')};
}
function contactInsight(c,ctx){
  const act=ctx.activity.filter(x=>x.contact_id===c.id),bs=ctx.bookings.filter(x=>x.primary_contact_id===c.id||x.casting_director_contact_id===c.id),cs=ctx.castings.filter(x=>x.primary_contact_id===c.id||x.casting_director_contact_id===c.id),rec=ctx.recipients.filter(x=>x.contact_id===c.id),links=ctx.links.filter(x=>x.contact_id===c.id),last=maxDate([...act.map(x=>x.occurred_at),...rec.map(x=>x.last_viewed_at||x.opened_at||x.sent_at),...bs.map(x=>x.updated_at||x.starts_at),...cs.map(x=>x.updated_at||x.starts_at)]),lastDays=ageDays(last);
  const score=scoreRelationship({status:c.status,tier:c.metadata?.relationship_tier,interactions:act.length,bookings:bs.length,castings:cs.length,packages:rec.length,opens:rec.reduce((n,x)=>n+num(x.view_count),0),lastDays,outstanding:0,paid:0});
  return {contact_id:c.id,score,band:statusBand(score,lastDays,0,c.status),last_activity_at:last,last_activity_days:lastDays,interaction_count:act.length,booking_count:bs.length,casting_count:cs.length,package_count:rec.length,linked_company_count:links.length||(+!!c.company_id),next_action:nextAction({status:c.status,lastDays,outstanding:0,contacts:1,packages:rec.length,bookings:bs.length}),summary:[c.role||'Professional contact',links.length>1?`${links.length} linked companies`:null,lastDays!=null?`active ${lastDays}d ago`:'no logged activity'].filter(Boolean).join(' · ')};
}
export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:p.organization||'maison-de-veux'});
    const admin=await requirePermission(user.id,organization.id,'crm.read');
    const [companies,contacts,links,activity,bookings,castings,packages,invoices,recipients]=await Promise.all([
      rows(admin.from('companies').select('id,name,company_type,status,tier,metadata,updated_at').eq('organization_id',organization.id).limit(800)),
      rows(admin.from('contacts').select('id,company_id,display_name,role,status,metadata,updated_at').eq('organization_id',organization.id).limit(1000)),
      rows(admin.from('contact_company_links').select('contact_id,company_id,relationship_role,is_primary').eq('organization_id',organization.id).limit(2200)),
      rows(admin.from('crm_activity').select('company_id,contact_id,activity_type,occurred_at').eq('organization_id',organization.id).order('occurred_at',{ascending:false}).limit(2500)),
      rows(admin.from('bookings').select('id,company_id,primary_contact_id,casting_director_contact_id,status,starts_at,updated_at').eq('organization_id',organization.id).limit(1600)),
      rows(admin.from('castings').select('id,company_id,primary_contact_id,casting_director_contact_id,status,starts_at,updated_at').eq('organization_id',organization.id).limit(1600)),
      rows(admin.from('packages').select('id,company_id,status,created_at,updated_at').eq('organization_id',organization.id).limit(1600)),
      rows(admin.from('invoices').select('id,company_id,status,total,amount_paid,amount_due,issue_date,updated_at').eq('organization_id',organization.id).limit(1800)),
      rows(admin.from('package_recipients').select('company_id,contact_id,sent_at,opened_at,first_viewed_at,last_viewed_at,view_count').eq('organization_id',organization.id).limit(2800))
    ]);
    const ctx={companies,contacts,links,activity,bookings,castings,packages,invoices,recipients};
    const company_insights=companies.map(c=>companyInsight(c,ctx)),contact_insights=contacts.map(c=>contactInsight(c,ctx));
    const priority=company_insights.filter(x=>x.score>=80).length,needs_follow_up=company_insights.filter(x=>x.last_activity_days==null||x.last_activity_days>45||x.outstanding_total>0).length,outstanding=company_insights.reduce((n,x)=>n+x.outstanding_total,0);
    return json(200,{environment:'veux-saas-v16.9.57',organization,summary:{companies:companies.length,contacts:contacts.length,priority_relationships:priority,needs_follow_up,outstanding_total:outstanding},company_insights,contact_insights,generated_at:new Date().toISOString()});
  }catch(error){return errorResponse(error);}
};
