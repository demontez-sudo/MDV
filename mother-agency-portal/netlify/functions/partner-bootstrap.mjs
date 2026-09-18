import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requirePartnerPortal, loadTeam, loadModels } from './_lib/portal-bridge.mjs';

async function rows(query){const {data,error}=await query;if(error)throw error;return data||[];}
function safeMessage(error){return String(error?.code||error?.message||'query_failed').slice(0,160);}
async function safeRows(warnings,label,query){try{return await rows(query);}catch(error){warnings.push({section:label,error:safeMessage(error)});return[];}}
function indexBy(rows,key='id'){return new Map((rows||[]).map(x=>[String(x?.[key]||''),x]));}
function attachById(rows,idKey,parentMap,outKey){return (rows||[]).map(x=>({...x,[outKey]:parentMap.get(String(x?.[idKey]||''))||null}));}
function groupBy(rows,key){const out=new Map();for(const row of rows||[]){const k=String(row?.[key]||'');if(!out.has(k))out.set(k,[]);out.get(k).push(row);}return out;}

export const handler=async(event)=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  let stage='authenticate';
  try{
    const warnings=[];
    const {user}=await requireUser(event);
    stage='portal_context';
    const slug=event.queryStringParameters?.organization||'maison-de-veux';
    const {admin,organization,member,profile,partnerAgencyId}=await requirePartnerPortal({user,organizationSlug:slug});
    stage='partner_core';

    const {data:partnerRow,error:partnerError}=await admin.from('partner_agencies').select('*').eq('organization_id',organization.id).eq('id',partnerAgencyId).maybeSingle();
    if(partnerError)throw partnerError;
    if(!partnerRow){const e=new Error('Partner agency profile was not found');e.statusCode=404;throw e;}
    let company=null;
    if(partnerRow.company_id){
      const {data,error}=await admin.from('companies').select('*').eq('organization_id',organization.id).eq('id',partnerRow.company_id).maybeSingle();
      if(error)warnings.push({section:'partner.company',error:safeMessage(error)});else company=data||null;
    }
    const partner={...partnerRow,companies:company};

    const placementsRaw=await safeRows(warnings,'placements',admin.from('model_placements').select('*').eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).in('status',['active','pending','placed']).order('created_at',{ascending:false}));
    const marketIds=[...new Set(placementsRaw.map(x=>x.market_id).filter(Boolean))];
    const marketRows=marketIds.length?await safeRows(warnings,'placements.markets',admin.from('markets').select('id,name,code').eq('organization_id',organization.id).in('id',marketIds)):[];
    const placements=attachById(placementsRaw,'market_id',indexBy(marketRows),'markets');
    const modelIds=[...new Set(placements.map(x=>x.model_id).filter(Boolean))];

    const [loadedModels,team]=await Promise.all([loadModels(admin,organization.id,modelIds),loadTeam(admin,organization.id)]);
    const models=loadedModels.map(({private_profile,...model})=>model);

    const safeByModels=async(label,table,select='*',extra)=>{
      if(!modelIds.length)return[];
      let q=admin.from(table).select(select).eq('organization_id',organization.id).in('model_id',modelIds);
      if(extra)q=extra(q);
      return safeRows(warnings,label,q);
    };

    const [bookingLinksRaw,castingLinksRaw,eventLinksRaw,availabilityBlocks,availabilityRequests,tasks,travelRaw,visa,workAuth,ledger,statements,approvals,notifications]=await Promise.all([
      safeByModels('activity.booking_links','booking_models','id,booking_id,model_id,status,response_at,role_label,notes'),
      safeByModels('activity.casting_links','casting_models','id,casting_id,model_id,status,slot_at,response_at,feedback'),
      safeByModels('schedule.event_links','event_models','id,event_id,model_id,attendance_status,visible_to_model,response_required,response_at,notes',q=>q.eq('visible_to_model',true)),
      safeByModels('schedule.availability_blocks','availability_blocks','*',q=>q.in('status',['approved','pending']).order('starts_at',{ascending:true})),
      safeByModels('schedule.availability_requests','availability_requests','*',q=>q.neq('status','cancelled').order('starts_at',{ascending:true})),
      safeRows(warnings,'activity.tasks',admin.from('tasks').select('*').eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).eq('visibility','partner_shared').order('due_at',{ascending:true})),
      safeByModels('mobility.travel','travel_records','*',q=>q.eq('visible_to_partner',true).order('starts_at',{ascending:true})),
      safeByModels('mobility.visa','visa_cases','*',q=>q.eq('visible_to_partner',true).order('hard_deadline',{ascending:true})),
      safeByModels('mobility.work_authorizations','work_authorizations','*',q=>q.eq('visible_to_partner',true)),
      safeRows(warnings,'finance.ledger',admin.from('partner_ledger_entries').select('*').eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).eq('status','posted').order('effective_on',{ascending:false})),
      safeRows(warnings,'finance.statements',admin.from('statements').select('*').eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).eq('statement_type','mother_agency').order('period_end',{ascending:false})),
      safeRows(warnings,'approvals',admin.from('approval_requests').select('id,model_id,partner_agency_id,request_type,resource_type,resource_id,title,details,status,requested_at,decided_at,decision_note,expires_at,requested_by').eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).eq('visible_to_partner',true).order('requested_at',{ascending:false})),
      safeRows(warnings,'notifications',admin.from('notifications').select('*').eq('organization_id',organization.id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(100))
    ]);

    const bookingIds=[...new Set(bookingLinksRaw.map(x=>x.booking_id).filter(Boolean))];
    const castingIds=[...new Set(castingLinksRaw.map(x=>x.casting_id).filter(Boolean))];
    const eventIds=[...new Set(eventLinksRaw.map(x=>x.event_id).filter(Boolean))];
    const travelIds=[...new Set(travelRaw.map(x=>x.id).filter(Boolean))];
    const [bookingRows,castingRows,eventRows,travelSegments,housingBookings]=await Promise.all([
      bookingIds.length?safeRows(warnings,'activity.bookings',admin.from('bookings').select('*').eq('organization_id',organization.id).in('id',bookingIds)):[],
      castingIds.length?safeRows(warnings,'activity.castings',admin.from('castings').select('*').eq('organization_id',organization.id).in('id',castingIds)):[],
      eventIds.length?safeRows(warnings,'schedule.events',admin.from('events').select('*').eq('organization_id',organization.id).in('id',eventIds)):[],
      travelIds.length?safeRows(warnings,'mobility.travel_segments',admin.from('travel_segments').select('*').eq('organization_id',organization.id).in('travel_record_id',travelIds)):[],
      travelIds.length?safeRows(warnings,'mobility.housing',admin.from('housing_bookings').select('*').eq('organization_id',organization.id).in('travel_record_id',travelIds)):[]
    ]);
    const bookingLinks=attachById(bookingLinksRaw,'booking_id',indexBy(bookingRows),'bookings');
    const castingLinks=attachById(castingLinksRaw,'casting_id',indexBy(castingRows),'castings');
    const eventLinks=attachById(eventLinksRaw,'event_id',indexBy(eventRows),'events');
    const segmentsByTravel=groupBy(travelSegments,'travel_record_id');
    const housingByTravel=groupBy(housingBookings,'travel_record_id');
    const travel=travelRaw.map(x=>({...x,travel_segments:segmentsByTravel.get(String(x.id))||[],housing_bookings:housingByTravel.get(String(x.id))||[]}));

    const commissions=bookingIds.length?await safeRows(warnings,'finance.booking_commissions',admin.from('booking_rates').select('booking_id,model_id,currency,mother_agency_rate,mother_agency_amount,talent_gross,notes').eq('organization_id',organization.id).in('model_id',modelIds).in('booking_id',bookingIds)):[];
    const usageTerms=bookingIds.length?await safeRows(warnings,'finance.booking_usage_terms',admin.from('booking_usage_terms').select('booking_id,notes,currency,created_at,updated_at').eq('organization_id',organization.id).in('booking_id',bookingIds)):[];

    const conversationRows=await safeRows(warnings,'conversations',admin.from('conversations').select('id,subject,conversation_type,status,partner_agency_id,updated_at').eq('organization_id',organization.id).eq('partner_agency_id',partnerAgencyId).neq('status','closed').order('updated_at',{ascending:false}));
    const conversationIds=conversationRows.map(x=>x.id);
    const messages=conversationIds.length?await safeRows(warnings,'conversations.messages',admin.from('messages').select('id,conversation_id,sender_user_id,sender_label,body,message_type,visibility,sent_at,edited_at,deleted_at').eq('organization_id',organization.id).in('conversation_id',conversationIds).eq('visibility','participants').is('deleted_at',null).order('sent_at',{ascending:true})):[];

    let documents=[];
    if(modelIds.length){
      const links=await safeRows(warnings,'documents.links',admin.from('document_links').select('id,document_id,resource_type,resource_id,relationship,visible_to_partner').eq('organization_id',organization.id).eq('resource_type','model').in('resource_id',modelIds).eq('visible_to_partner',true));
      const documentIds=[...new Set(links.map(x=>x.document_id).filter(Boolean))];
      const documentRows=documentIds.length?await safeRows(warnings,'documents.records',admin.from('documents').select('id,name,category,mime_type,storage_provider,storage_bucket,storage_path,external_url,visibility,status,created_at').eq('organization_id',organization.id).in('id',documentIds)):[];
      documents=attachById(links,'document_id',indexBy(documentRows),'documents');
    }

    return json(200,{
      environment:'veux-desk-v16.7.14-smart-calendar',portal:'partner',organization,
      current_user:{id:user.id,email:user.email,profile,membership:member},
      partner,placements,models,team,
      activity:{bookings:bookingLinks,castings:castingLinks,events:eventLinks,tasks},
      schedule:{events:eventLinks,availability_blocks:availabilityBlocks,availability_requests:availabilityRequests},
      mobility:{travel,visa_cases:visa,work_authorizations:workAuth},
      finance:{booking_commissions:commissions,booking_usage_terms:usageTerms,ledger,statements},
      approvals,conversations:conversationRows,messages,documents,notifications,
      bootstrap_warnings:warnings
    });
  }catch(error){if((error?.statusCode||500)>=500)error.publicMessage=`Mother Agency Portal data could not finish loading (${stage}).`;return errorResponse(error);}
};
