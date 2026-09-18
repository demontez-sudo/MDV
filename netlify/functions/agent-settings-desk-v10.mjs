import { requireUser, parseBody, json, errorResponse, adminClient, assertPermission } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { getOrganizationCapacity, assertCapacity } from './_lib/entitlements.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}async function one(q){const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    const admin=adminClient();
    if(event.httpMethod==='POST'){
      const action=String(body.action||'');
      if(action==='update_org_settings'){
        await requirePermission(user.id,organization.id,'org.settings.manage');const payload={organization_id:organization.id};for(const k of ['package_domain','public_profile_domain','website_domain','reply_to_email','sender_name','sender_email','logo_url','logo_dark_url','accent_color','primary_color','locale'])if(body[k]!==undefined)payload[k]=body[k];if(body.settings!==undefined)payload.settings=body.settings;const {data,error}=await admin.from('organization_settings').upsert(payload,{onConflict:'organization_id'}).select('*').single();if(error)throw error;if(!data?.organization_id)throw new Error('Organization settings save was not verified.');return json(200,{ok:true,verified:true,settings:data,persisted_at:data.updated_at||new Date().toISOString()});
      }
      if(action==='update_booking_defaults'){
        await requirePermission(user.id,organization.id,'org.settings.manage');const payload={organization_id:organization.id};for(const k of ['agency_fee_rate','default_commission_rate','default_option_expiry_hours','default_payment_terms_days','require_contract_before_job','require_usage_before_confirm'])if(body[k]!==undefined)payload[k]=body[k];if(body.settings!==undefined)payload.settings=body.settings;const {data,error}=await admin.from('organization_booking_defaults').upsert(payload,{onConflict:'organization_id'}).select('*').single();if(error)throw error;if(!data?.organization_id)throw new Error('Booking defaults save was not verified.');return json(200,{ok:true,verified:true,booking_defaults:data,persisted_at:data.updated_at||new Date().toISOString()});
      }
      if(action==='update_finance_settings'){
        await requirePermission(user.id,organization.id,'org.settings.manage');const payload={organization_id:organization.id};for(const k of ['base_currency','tax_mode','invoice_prefix','next_invoice_number','default_tax_rate','default_payment_terms_days','fiscal_year_start_month'])if(body[k]!==undefined)payload[k]=body[k];if(body.settings!==undefined)payload.settings=body.settings;const {data,error}=await admin.from('organization_finance_settings').upsert(payload,{onConflict:'organization_id'}).select('*').single();if(error)throw error;if(!data?.organization_id)throw new Error('Finance settings save was not verified.');return json(200,{ok:true,verified:true,finance_settings:data,persisted_at:data.updated_at||new Date().toISOString()});
      }
      if(action==='update_security_settings'){
        await requirePermission(user.id,organization.id,'security.settings.manage');const payload={organization_id:organization.id};for(const k of ['require_mfa_for_staff','require_mfa_for_finance','session_timeout_minutes','allowed_email_domains','support_access_enabled'])if(body[k]!==undefined)payload[k]=body[k];if(body.settings!==undefined)payload.settings=body.settings;const {data,error}=await admin.from('organization_security_settings').upsert(payload,{onConflict:'organization_id'}).select('*').single();if(error)throw error;if(!data?.organization_id)throw new Error('Security settings save was not verified.');return json(200,{ok:true,verified:true,security_settings:data,persisted_at:data.updated_at||new Date().toISOString()});
      }
      if(action==='onboarding_step'){
        await requirePermission(user.id,organization.id,'onboarding.manage');const status=body.status||'complete';const payload={organization_id:organization.id,step_key:body.step_key,label:body.label||body.step_key,category:body.category||null,required:body.required!==false,status,note:body.note||null,sort_order:Number(body.sort_order||0),completed_by:status==='complete'?user.id:null,completed_at:status==='complete'?new Date().toISOString():null};const {data,error}=await admin.from('organization_onboarding_steps').upsert(payload,{onConflict:'organization_id,step_key'}).select('*').single();if(error)throw error;if(!data?.step_key)throw new Error('Onboarding step save was not verified.');return json(200,{ok:true,verified:true,step:data,persisted_at:data.updated_at||new Date().toISOString()});
      }
      if(['create_market','create_division','create_board'].includes(action)){
        await requirePermission(user.id,organization.id,'structure.manage');
        if(action==='create_market'){const capacity=await getOrganizationCapacity(admin,organization.id);assertCapacity(capacity,'markets',1);const {data,error}=await admin.from('markets').insert({organization_id:organization.id,name:String(body.name||'').trim(),code:body.code||null,city:body.city||null,country_code:body.country_code||null,timezone:body.timezone||null}).select('*').single();if(error)throw error;if(!data?.id)throw new Error('Market creation was not verified.');return json(200,{ok:true,verified:true,market:data,persisted_at:data.created_at||new Date().toISOString()});}
        if(action==='create_division'){const {data,error}=await admin.from('divisions').insert({organization_id:organization.id,name:String(body.name||'').trim(),code:body.code||null,gender_scope:body.gender_scope||null,stage_scope:body.stage_scope||null}).select('*').single();if(error)throw error;if(!data?.id)throw new Error('Division creation was not verified.');return json(200,{ok:true,verified:true,division:data,persisted_at:data.created_at||new Date().toISOString()});}
        const {data,error}=await admin.from('boards').insert({organization_id:organization.id,name:String(body.name||'').trim(),market_id:body.market_id||null,division_id:body.division_id||null}).select('*').single();if(error)throw error;if(!data?.id)throw new Error('Board creation was not verified.');return json(200,{ok:true,verified:true,board:data,persisted_at:data.created_at||new Date().toISOString()});
      }
      return json(400,{error:'Unsupported settings action'});
    }
    await requirePermission(user.id,organization.id,'org.read');
    const canManage=await assertPermission(admin,user.id,organization.id,'org.settings.manage');const canSecurity=await assertPermission(admin,user.id,organization.id,'members.manage');const canSecurityManage=await assertPermission(admin,user.id,organization.id,'security.settings.manage');const canFinance=await assertPermission(admin,user.id,organization.id,'finance.read')||canManage;
    const [settings,bookingDefaults,financeSettings,securitySettings,onboarding,steps,markets,divisions,boards,offices,domains,connections,writeIntegrity]=await Promise.all([
      one(admin.from('organization_settings').select('*').eq('organization_id',organization.id)),
      one(admin.from('organization_booking_defaults').select('*').eq('organization_id',organization.id)),
      canFinance?one(admin.from('organization_finance_settings').select('*').eq('organization_id',organization.id)):Promise.resolve(null),
      canSecurity?one(admin.from('organization_security_settings').select('*').eq('organization_id',organization.id)):Promise.resolve(null),
      one(admin.from('organization_onboarding').select('*').eq('organization_id',organization.id)),
      rows(admin.from('organization_onboarding_steps').select('*').eq('organization_id',organization.id).order('sort_order')),
      rows(admin.from('markets').select('*').eq('organization_id',organization.id).order('sort_order')),
      rows(admin.from('divisions').select('*').eq('organization_id',organization.id).order('sort_order')),
      rows(admin.from('boards').select('*').eq('organization_id',organization.id).order('sort_order')),
      rows(admin.from('offices').select('*').eq('organization_id',organization.id).order('name')),
      canManage?rows(admin.from('organization_domains').select('*').eq('organization_id',organization.id)):Promise.resolve([]),
      canManage?rows(admin.from('integration_connections').select('id,provider,connection_type,status,external_account_label,last_success_at,last_error').eq('organization_id',organization.id)):Promise.resolve([]),
      admin.rpc('portal_write_integrity_v1',{target_org:organization.id}).then(({data,error})=>{if(error)throw error;return data;})
    ]);
    return json(200,{environment:'veux-saas-v16.9.37-write-integrity',organization,organization_settings:settings,booking_defaults:bookingDefaults,finance_settings:financeSettings,security_settings:securitySettings,onboarding,onboarding_steps:steps,structure:{markets,divisions,boards,offices},domains,integrations:connections,write_integrity:writeIntegrity,access:{manage:canManage,security:canSecurity,security_manage:canSecurityManage,finance:canFinance}});
  }catch(error){return errorResponse(error);}
};
