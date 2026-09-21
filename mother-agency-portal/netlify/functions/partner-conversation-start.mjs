import { requireUser, adminClient, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requirePartnerPortal } from './_lib/portal-bridge.mjs';

const TYPES=['partner','partner_agency','mother_agency','general','direct',null];

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);
    const b=parseBody(event),slug=b.organization_slug||'maison-de-veux';
    const ctx=await requirePartnerPortal({user,organizationSlug:slug});
    const admin=adminClient(),orgId=ctx.organization.id,partnerId=ctx.partnerAgencyId;

    const existing=await admin.from('conversations').select('id,subject,status,partner_agency_id,updated_at')
      .eq('organization_id',orgId).eq('partner_agency_id',partnerId).neq('status','closed').order('updated_at',{ascending:false}).limit(1);
    if(existing.error)throw existing.error;
    if(existing.data&&existing.data[0])return json(200,{ok:true,created:false,conversation:existing.data[0]});

    const partner=await admin.from('partner_agencies').select('id,companies(name)').eq('id',partnerId).maybeSingle();
    const name=(partner.data&&partner.data.companies&&partner.data.companies.name)||'Mother Agency';
    let lastError=null;
    for(const type of TYPES){
      const row={organization_id:orgId,partner_agency_id:partnerId,subject:`${name} · Maison de Veux`,status:'active'};
      if(type)row.conversation_type=type;
      const made=await admin.from('conversations').insert(row).select('id,subject,status,partner_agency_id,updated_at').single();
      if(!made.error)return json(200,{ok:true,created:true,conversation:made.data});
      lastError=made.error;
    }
    const e=new Error('A conversation could not be opened yet: '+(lastError&&lastError.message||'unknown error'));e.statusCode=500;throw e;
  }catch(error){return errorResponse(error);}
};
