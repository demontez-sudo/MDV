import { requireUser, json, errorResponse, parseBody } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission, uuidish } from './_lib/agent-bridge.mjs';

function splitName(name='') {
  const parts=String(name).trim().split(/\s+/).filter(Boolean);
  return { first_name:parts[0]||null,last_name:parts.slice(1).join(' ')||null };
}

async function resolveCompany(admin, orgId, value) {
  if (!value) return null;
  if (uuidish(value)) {
    const {data}=await admin.from('companies').select('id').eq('organization_id',orgId).eq('id',value).maybeSingle();
    if(data) return data.id;
  }
  const {data}=await admin.from('companies').select('id').eq('organization_id',orgId).eq('legacy_id',String(value)).maybeSingle();
  return data?.id||null;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  try {
    const {user,client}=await requireUser(event);
    const body=parseBody(event);
    const {organization}=await requireStaffOrganization({user,client,organizationId:body.organization_id,organizationSlug:body.organization_slug});
    const admin=await requirePermission(user.id,organization.id,'crm.write');
    const companies=Array.isArray(body.companies)?body.companies:[];
    const contacts=Array.isArray(body.contacts)?body.contacts:[];
    const deletedCompanyIds=Array.isArray(body.deleted_company_ids)?body.deleted_company_ids:[];
    const deletedContactIds=Array.isArray(body.deleted_contact_ids)?body.deleted_contact_ids:[];
    const companyMap={};

    for (const co of companies) {
      if (!co?.name) continue;
      const originalId=String(co.id||'').trim()||null;
      const payload={
        organization_id:organization.id,
        name:String(co.name).trim(),
        company_type:co.type||co.company_type||'other',
        status:co.status||'active',
        tier:co.tier||null,
        website:co.website||null,
        email:co.billingEmail||co.email||null,
        phone:co.phone||null,
        address:{display:co.address||null,market:co.market||null},
        specialties:[co.specialty,...(Array.isArray(co.specialties)?co.specialties:[])].filter(Boolean),
        notes:co.notes||null,
        metadata:{
          legacy_market:co.market||null,instagram:co.instagram||null,owner_key:co.owner||null,
          billing_email:co.billingEmail||null,payment_terms:co.paymentTerms||null,legacy_payload:co
        }
      };
      let row=null,error=null;
      if (originalId && uuidish(originalId)) {
        ({data:row,error}=await admin.from('companies').update(payload).eq('organization_id',organization.id).eq('id',originalId).select('*').single());
      } else {
        payload.legacy_id=originalId || `bridge:${crypto.randomUUID()}`;
        ({data:row,error}=await admin.from('companies').upsert(payload,{onConflict:'organization_id,legacy_id'}).select('*').single());
      }
      if(error) throw error;
      if(originalId) companyMap[originalId]=row.id;
    }

    for (const rawId of deletedContactIds) {
      let q=admin.from('contacts').delete().eq('organization_id',organization.id);
      q=uuidish(rawId)?q.eq('id',rawId):q.eq('legacy_id',String(rawId));
      const {error}=await q;if(error) throw error;
    }
    for (const rawId of deletedCompanyIds) {
      let q=admin.from('companies').delete().eq('organization_id',organization.id);
      q=uuidish(rawId)?q.eq('id',rawId):q.eq('legacy_id',String(rawId));
      const {error}=await q;if(error) throw error;
    }

    const contactMap={};
    for (const ct of contacts) {
      const display=String(ct?.name||'').trim(); if(!display) continue;
      const originalId=String(ct.id||'').trim()||null;
      const names=splitName(display);
      const companyValues=Array.isArray(ct.companies)?ct.companies:[];
      const resolved=[];
      for (const v of companyValues) {
        const id=companyMap[v]||await resolveCompany(admin,organization.id,v);
        if(id&&!resolved.includes(id)) resolved.push(id);
      }
      const payload={
        organization_id:organization.id,
        company_id:resolved[0]||null,
        first_name:names.first_name,last_name:names.last_name,display_name:display,
        role:ct.role||ct.category||null,email:ct.email||null,phone:ct.phone||null,whatsapp:ct.whatsapp||null,
        instagram:ct.instagram||null,preferred_contact:ct.preferredContact||null,market:ct.marketFocus||ct.basedIn||null,
        status:ct.status||'active',notes:ct.notes||null,
        metadata:{category:ct.category||null,pronouns:ct.pronouns||null,agency:ct.agency||null,email2:ct.email2||null,
          based_in:ct.basedIn||null,timezone:ct.timezone||null,owner_key:ct.owner||null,tags:ct.tags||null,
          assistant_name:ct.assistantName||null,assistant_email:ct.assistantEmail||null,legacy_payload:ct}
      };
      let row=null,error=null;
      if(originalId && uuidish(originalId)) {
        ({data:row,error}=await admin.from('contacts').update(payload).eq('organization_id',organization.id).eq('id',originalId).select('*').single());
      } else {
        payload.legacy_id=originalId||`bridge:${crypto.randomUUID()}`;
        ({data:row,error}=await admin.from('contacts').upsert(payload,{onConflict:'organization_id,legacy_id'}).select('*').single());
      }
      if(error) throw error;
      if(originalId) contactMap[originalId]=row.id;
      const del=await admin.from('contact_company_links').delete().eq('organization_id',organization.id).eq('contact_id',row.id);if(del.error)throw del.error;
      if(resolved.length){
        const ins=await admin.from('contact_company_links').insert(resolved.map((company_id,i)=>({organization_id:organization.id,contact_id:row.id,company_id,is_primary:i===0})));
        if(ins.error)throw ins.error;
      }
    }

    return json(200,{ok:true,company_id_map:companyMap,contact_id_map:contactMap});
  } catch(error){return errorResponse(error);}
};
