import { requireUser, json, errorResponse } from './_lib/auth.mjs';
import { requireModelPortal, loadModels } from './_lib/portal-bridge.mjs';

async function safe(label, q, warnings){
  try { const {data,error}=await q; if(error) throw error; return data||[]; }
  catch(error){ warnings.push({source:label,message:error?.message||'Unavailable'}); return []; }
}
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const byId=(a)=>new Map((a||[]).map(x=>[String(x.id),x]));

export const handler=async event=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'},{Allow:'GET'});
  try{
    const {user}=await requireUser(event);
    const p=event.queryStringParameters||{};
    const slug=p.organization||p.organization_slug||'maison-de-veux';
    const {admin,organization,modelId,profile,member}=await requireModelPortal({user,organizationSlug:slug});
    const warnings=[];

    const models=await loadModels(admin,organization.id,[modelId]);
    const model=models?.[0]||null;
    if(!model){ const e=new Error('Linked model profile was not found.'); e.statusCode=404; throw e; }

    const [bookingLinks,castingLinks,tasks,travel,visa,contracts,ledger,statements,evaluations,plans,notes,availability,documentLinks,notifications]=await Promise.all([
      safe('booking_models',admin.from('booking_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false}),warnings),
      safe('casting_models',admin.from('casting_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false}),warnings),
      safe('tasks',admin.from('tasks').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false}).limit(250),warnings),
      safe('travel_records',admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('starts_at',{ascending:false}),warnings),
      safe('visa_cases',admin.from('visa_cases').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('hard_deadline',{ascending:true}),warnings),
      safe('contracts',admin.from('contracts').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('updated_at',{ascending:false}),warnings),
      safe('model_ledger_entries',admin.from('model_ledger_entries').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('effective_on',{ascending:false}).limit(500),warnings),
      safe('statements',admin.from('statements').select('*').eq('organization_id',organization.id).eq('model_id',modelId).eq('statement_type','model').order('period_end',{ascending:false}),warnings),
      safe('model_evaluations',admin.from('model_evaluations').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('evaluated_on',{ascending:false}),warnings),
      safe('development_plans',admin.from('development_plans').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false}),warnings),
      safe('model_notes',admin.from('model_notes').select('*').eq('organization_id',organization.id).eq('model_id',modelId).eq('visible_to_model',true).order('created_at',{ascending:false}).limit(100),warnings),
      safe('availability_blocks',admin.from('availability_blocks').select('*').eq('organization_id',organization.id).eq('model_id',modelId).neq('status','cancelled').order('starts_at',{ascending:false}).limit(200),warnings),
      safe('document_links',admin.from('document_links').select('id,document_id,relationship,visible_to_model,created_at,documents(id,name,category,mime_type,size_bytes,status,created_at)').eq('organization_id',organization.id).eq('resource_type','model').eq('resource_id',modelId).eq('visible_to_model',true).order('created_at',{ascending:false}).limit(250),warnings),
      safe('notifications',admin.from('notifications').select('id,notification_type,title,body,status,source_type,source_id,action_url,metadata,created_at').eq('organization_id',organization.id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),warnings)
    ]);

    const bookingIds=uniq(bookingLinks.map(x=>x.booking_id));
    const castingIds=uniq(castingLinks.map(x=>x.casting_id));
    const [bookings,castings,rates,usage]=await Promise.all([
      bookingIds.length?safe('bookings',admin.from('bookings').select('*').eq('organization_id',organization.id).in('id',bookingIds),warnings):[],
      castingIds.length?safe('castings',admin.from('castings').select('*').eq('organization_id',organization.id).in('id',castingIds),warnings):[],
      bookingIds.length?safe('booking_rates',admin.from('booking_rates').select('*').eq('organization_id',organization.id).eq('model_id',modelId).in('booking_id',bookingIds),warnings):[],
      bookingIds.length?safe('booking_usage_terms',admin.from('booking_usage_terms').select('*').eq('organization_id',organization.id).in('booking_id',bookingIds),warnings):[]
    ]);
    const bookingMap=byId(bookings), castingMap=byId(castings);
    const rateMap=new Map(rates.map(x=>[String(x.booking_id),x]));
    const usageMap=new Map(usage.map(x=>[String(x.booking_id),x]));

    const bookingView=bookingLinks.map(link=>({
      ...link,
      booking:bookingMap.get(String(link.booking_id))||null,
      rate:rateMap.get(String(link.booking_id))||null,
      usage:usageMap.get(String(link.booking_id))||null
    }));
    const castingView=castingLinks.map(link=>({...link,casting:castingMap.get(String(link.casting_id))||null}));

    const media=Array.isArray(model.media)?model.media:[];
    const digitals=media.filter(x=>/digital/i.test(String(x.category||x.media_category||x.label||'')));
    const portfolio=media.filter(x=>!digitals.includes(x) && String(x.media_type||'image').toLowerCase()==='image');
    const videos=media.filter(x=>String(x.media_type||'').toLowerCase()==='video');
    const privateProfile=model.private_profile?{
      email:model.private_profile.email||user.email||null,
      phone:model.private_profile.phone||null,
      whatsapp:model.private_profile.whatsapp||null,
      instagram:model.private_profile.instagram||null,
      date_of_birth:model.private_profile.date_of_birth||null,
      nationality:model.private_profile.nationality||null
    }:{email:user.email||null};

    return json(200,{
      ok:true,verified:true,release:'17.3.0-local',
      organization:{id:organization.id,name:organization.name,slug:organization.slug},
      account:{user_id:user.id,email:user.email||privateProfile.email||null,member_status:member?.status||'linked',profile:profile||null},
      model:{...model,private_profile:privateProfile,media:undefined},
      measurements:model.measurement||null,
      media:{all:media,digitals,portfolio,videos},
      commercial:{bookings:bookingView,castings:castingView},
      mobility:{travel,visa_cases:visa},
      availability:{blocks:availability},
      requests:notifications,
      tasks,
      development:{evaluations,plans},
      documents:{contracts,links:documentLinks},
      finance:{ledger,statements},
      notes,
      warnings
    });
  }catch(error){return errorResponse(error);}
};
