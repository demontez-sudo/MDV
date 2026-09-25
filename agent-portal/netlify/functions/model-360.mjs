import { requireUser, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
import { loadModels } from './_lib/portal-bridge.mjs';
import { websiteProfileStatus } from './_lib/website-profile.mjs';
import { logModelActivity, actorFor } from './_lib/model-activity.mjs';

function isMissingColumn(err){const m=String(err?.message||'');return err?.code==='PGRST204'||err?.code==='42703'||/column .* (does not exist|of relation)|could not find the .* column/i.test(m);}

async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function one(q){const {data,error}=await q;if(error)throw error;return data||null;}
const clean=(obj,keys)=>Object.fromEntries(keys.filter(k=>Object.prototype.hasOwnProperty.call(obj,k)).map(k=>[k,obj[k]===''?null:obj[k]]));

function stagedError(stage,error){const e=new Error(`${stage}: ${error?.message||'write failed'}`);e.statusCode=409;e.publicMessage=`Could not save ${stage}.`+(error?.code?` Database code: ${error.code}.`:'')+' The previous model ID was preserved.';return e;}
async function saveOne(stage,q){try{return await one(q);}catch(error){throw stagedError(stage,error);}}
async function saveRows(stage,q){try{return await rows(q);}catch(error){throw stagedError(stage,error);}}

export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event);
    const body=event.httpMethod==='POST'?parseBody(event):{};
    const slug=body.organization_slug||event.queryStringParameters?.organization||'maison-de-veux';
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:slug});

    if(event.httpMethod==='POST'){
      const admin=await requirePermission(user.id,organization.id,'models.write');
      const action=String(body.action||'update_profile');
      if(action==='create_model'){
        const src=body.profile||{};
        const displayName=String(src.display_name||'').trim();
        if(!displayName){const e=new Error('display_name is required');e.statusCode=400;throw e;}
        const parts=displayName.split(/\s+/);
        const stage=String(src.stage||'New Face').trim()||'New Face';
        const department=String(body.department||((/^(new face|development)$/i.test(stage))?'Development':stage==='Creator'?'Creator':(src.gender==='Men'?'Men':'Women'))).trim();
        const represented=[...new Set((Array.isArray(body.represented_markets)?body.represented_markets:[]).map(x=>String(x||'').trim()).filter(Boolean))];
        const primary=String(body.primary_market||src.primary_market_label||'').trim();
        const profile={...src,first_name:String(src.first_name||parts[0]||displayName).trim(),last_name:src.last_name===undefined?(parts.slice(1).join(' ')||null):(src.last_name||null),display_name:displayName,stage:stage,status:src.status||'active',primary_market_label:primary||src.primary_market_label||null,active:src.active!==false};
        const priv=clean(body.private_profile||{},['email','phone','whatsapp','instagram','nationality','internal_notes','emergency_contact','metadata']);
        const measure=clean(body.measurements||{},['height_cm','height_display','bust_cm','bust_display','chest_cm','chest_display','waist_cm','waist_display','hips_cm','hips_display','dress','suit','shoe','hair','eyes','skin','notes','metadata']);
        if(body.create_website_profile===true){
          const canPublicManage=await assertPermission(admin,user.id,organization.id,'public_profiles.manage');
          if(!canPublicManage){const e=new Error('Public profile management permission is required');e.statusCode=403;throw e;}
        }
        const {data:created,error:createError}=await admin.rpc('create_model_full_v1',{
          target_org:organization.id,
          profile_data:profile,
          private_data:priv,
          measurement_data:measure,
          department_name:department||null,
          represented_markets:represented,
          primary_market_name:primary||null,
          target_market_id:body.market_id||null,
          target_division_id:body.division_id||null,
          target_board_id:body.board_id||null,
          file_metadata:body.file_metadata&&typeof body.file_metadata==='object'?body.file_metadata:{},
          create_website_profile:body.create_website_profile===true,
          website_data:{route_key:body.route_key||null,public_slug:body.public_slug||null,headline:body.public_headline||null,bio:body.public_bio||null}
        });
        if(createError)throw stagedError('new model file',createError);
        if(created?.verified!==true||!created?.model?.id){const e=new Error('New model save could not be verified');e.statusCode=409;throw e;}
        return json(200,{ok:true,verified:true,model:created.model,placement:{department:department||null,represented_markets:represented,primary_market:primary||null,market_id:body.market_id||null,division_id:body.division_id||null,board_id:body.board_id||null},website_profile:created.website_profile||null,persisted_at:created.persisted_at});
      }
      const modelId=body.model_id;
      if(!modelId){const e=new Error('model_id is required');e.statusCode=400;throw e;}
      if(action==='archive_model'||action==='restore_model'){
        const active=action==='restore_model';
        const model=await one(admin.from('models').update({active,status:active?'active':'archived'}).eq('organization_id',organization.id).eq('id',modelId).select('*').single());
        return json(200,{ok:true,verified:true,model,persisted_at:model?.updated_at||new Date().toISOString()});
      }
      if(action==='update_profile'){
        const patch=clean(body.profile||{},['first_name','last_name','display_name','gender','status','location','public_slug','represented_since','active']);
        if(patch.display_name && !patch.first_name){patch.first_name=String(patch.display_name).trim().split(/\s+/)[0]||patch.display_name;}
        const priv=clean(body.private_profile||{},['email','phone','whatsapp','instagram','nationality','internal_notes']);
        const {data:saved,error:saveError}=await admin.rpc('update_model_identity_private_v1',{target_org:organization.id,target_model:modelId,profile_data:patch,private_data:priv});
        if(saveError)throw saveError;
        if(saved?.verified!==true){const e=new Error('Model profile save could not be verified');e.statusCode=409;throw e;}
        await logModelActivity(admin,{organization_id:organization.id,model_id:modelId,kind:'profile',title:'Profile edited',detail:Object.keys(patch).join(', '),...(await actorFor(admin,user)),link_page:'overview'});
        return json(200,{ok:true,verified:true,model:saved.model,private_profile:saved.private_profile||null,persisted_at:saved.persisted_at});
      }

      if(action==='create_website_profile'){
        const canPublicManage=await assertPermission(admin,user.id,organization.id,'public_profiles.manage');
        if(!canPublicManage){const e=new Error('Public profile management permission is required');e.statusCode=403;throw e;}
        const {data,error}=await admin.rpc('create_model_website_profile_v1',{
          target_org:organization.id,
          target_model:modelId,
          requested_route_key:body.route_key||null,
          requested_public_slug:body.public_slug||null,
          profile_data:body.public_profile&&typeof body.public_profile==='object'?body.public_profile:{}
        });
        if(error)throw stagedError('website profile',error);
        if(!data?.model&&!data?.website_profile){const e=new Error('Website profile save could not be verified');e.statusCode=409;throw e;}
        return json(200,{ok:true,verified:true,...(data||{}),persisted_at:data?.public_profile?.updated_at||new Date().toISOString()});
      }
      if(action==='mark_website_profile_deployed'){
        const canPublicManage=await assertPermission(admin,user.id,organization.id,'public_profiles.manage');
        if(!canPublicManage){const e=new Error('Public profile management permission is required');e.statusCode=403;throw e;}
        const current=await one(admin.from('model_public_profiles').select('*').eq('organization_id',organization.id).eq('model_id',modelId).maybeSingle());
        if(!current){const e=new Error('Create the Website Profile first');e.statusCode=409;throw e;}
        const model=await one(admin.from('models').select('legacy_key,public_slug').eq('organization_id',organization.id).eq('id',modelId).maybeSingle());
        const routeKey=String(model?.legacy_key||current.metadata?.website_profile?.route_key||'').trim().toLowerCase();
        if(!routeKey){const e=new Error('Website route is not configured');e.statusCode=409;throw e;}
        const websiteMeta={...(current.metadata?.website_profile||{}),route_key:routeKey,profile_url:'https://www.maisondeveux.com/'+routeKey,site_origin:'https://maison-'+routeKey+'.netlify.app',deployment_status:'deployed',deployed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        const metadata={...(current.metadata||{}),website_profile:websiteMeta};
        const public_profile=await one(admin.from('model_public_profiles').update({metadata,updated_at:new Date().toISOString()}).eq('organization_id',organization.id).eq('model_id',modelId).select('*').single());
        return json(200,{ok:true,verified:true,public_profile,website_profile:{...websiteProfileStatus({...model,id:modelId,media:[]},public_profile),deployment_status:'deployed'},persisted_at:public_profile?.updated_at||new Date().toISOString()});
      }
      if(action==='update_full_file'){
        const modelId=body.model_id;
        if(!modelId){const e=new Error('model_id is required');e.statusCode=400;throw e;}
        const src=body.profile||{};
        const gender=String(src.gender||'').trim();
        const stage=String(src.stage||'').trim()||'New Face';
        const department=String(body.department||((/^(new face|development)$/i.test(stage))?'Development':stage==='Creator'?'Creator':(gender==='Men'?'Men':'Women'))).trim();
        const represented=[...new Set((Array.isArray(body.represented_markets)?body.represented_markets:[]).map(x=>String(x||'').trim()).filter(Boolean))];
        const primary=String(body.primary_market||src.primary_market_label||'').trim();
        if(body.public_profile&&typeof body.public_profile==='object'){
          const canPublicManage=await assertPermission(admin,user.id,organization.id,'public_profiles.manage');
          if(!canPublicManage){const e=new Error('Public profile management permission is required');e.statusCode=403;throw e;}
        }
        const multiPlacements=Array.isArray(body.placements)?body.placements.filter(x=>x&&typeof x==='object'):[];
        const rpcName=multiPlacements.length?'save_model_full_file_v2':'save_model_full_file_v1';
        const rpcArgs=multiPlacements.length?{
          target_org:organization.id,
          target_model:modelId,
          profile_data:src,
          private_data:body.private_profile&&typeof body.private_profile==='object'?body.private_profile:{},
          measurement_data:body.measurements&&typeof body.measurements==='object'?body.measurements:{},
          public_data:body.public_profile&&typeof body.public_profile==='object'?body.public_profile:null,
          placements:multiPlacements,
          primary_market_name:primary,
          file_metadata:body.file_metadata&&typeof body.file_metadata==='object'?body.file_metadata:{}
        }:{
          target_org:organization.id,
          target_model:modelId,
          profile_data:src,
          private_data:body.private_profile&&typeof body.private_profile==='object'?body.private_profile:{},
          measurement_data:body.measurements&&typeof body.measurements==='object'?body.measurements:{},
          public_data:body.public_profile&&typeof body.public_profile==='object'?body.public_profile:null,
          department_name:department,
          represented_markets:represented,
          primary_market_name:primary,
          file_metadata:body.file_metadata&&typeof body.file_metadata==='object'?body.file_metadata:{}
        };
        const {data,error}=await admin.rpc(rpcName,rpcArgs);
        if(error)throw stagedError('model file transaction',error);
        if(!data?.model?.id){const e=new Error('Model file transaction could not be verified');e.statusCode=409;throw e;}
        return json(200,{ok:true,verified:true,...(data||{}),persisted_at:data?.model?.updated_at||new Date().toISOString()});
      }
      if(action==='update_measurements'){
        const m=clean(body.measurements||{},['height_cm','height_display','bust_cm','bust_display','chest_cm','chest_display','waist_cm','waist_display','hips_cm','hips_display','dress','suit','shoe','hair','eyes','skin','notes']);
        const measurements=await one(admin.from('model_measurements').upsert({organization_id:organization.id,model_id:modelId,...m},{onConflict:'model_id'}).select('*').single());
        await logModelActivity(admin,{organization_id:organization.id,model_id:modelId,kind:'profile',title:'Measurements updated',detail:Object.keys(m).join(', '),...(await actorFor(admin,user)),link_page:'materials'});
        return json(200,{ok:true,verified:true,measurements,persisted_at:measurements?.updated_at||new Date().toISOString()});
      }
      if(action==='create_note'){
        const text=String(body.body||body.note||'').trim();if(!text){const e=new Error('body is required');e.statusCode=400;throw e;}
        const base={organization_id:organization.id,model_id:modelId,body:text,pinned:body.pinned===true,created_by:user.id};
        let note;
        try{note=await one(admin.from('model_notes').insert({...base,visible_to_model:body.visible_to_model===true}).select('*').single());}
        catch(e){if(!isMissingColumn(e))throw e;note=await one(admin.from('model_notes').insert(base).select('*').single());}
        await logModelActivity(admin,{organization_id:organization.id,model_id:modelId,kind:'note',title:body.visible_to_model===true?'Note added (shareable)':'Note added',detail:text.slice(0,160),...(await actorFor(admin,user)),link_page:'record',link_id:note?.id});
        return json(201,{ok:true,verified:true,note,persisted_at:note?.created_at||new Date().toISOString()});
      }
      if(action==='update_note'){
        if(!body.note_id){const e=new Error('note_id is required');e.statusCode=400;throw e;}
        const patch={};if(body.body!==undefined)patch.body=String(body.body||'').trim();if(body.pinned!==undefined)patch.pinned=body.pinned===true;
        const withVis=body.visible_to_model!==undefined?{...patch,visible_to_model:body.visible_to_model===true}:patch;
        const runUpdate=p=>one(admin.from('model_notes').update(p).eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.note_id).select('*').single());
        let note;try{note=await runUpdate(withVis);}catch(e){if(!isMissingColumn(e)||withVis===patch)throw e;note=await runUpdate(patch);}
        await logModelActivity(admin,{organization_id:organization.id,model_id:modelId,kind:'note',title:body.visible_to_model!==undefined?(body.visible_to_model===true?'Note made shareable':'Note made internal'):'Note updated',detail:String(note?.body||'').slice(0,160),...(await actorFor(admin,user)),link_page:'record',link_id:body.note_id});
        return json(200,{ok:true,verified:true,note,persisted_at:note?.updated_at||new Date().toISOString()});
      }
      if(action==='delete_note'){
        if(!body.note_id){const e=new Error('note_id is required');e.statusCode=400;throw e;}
        const deleted=await one(admin.from('model_notes').delete().eq('organization_id',organization.id).eq('model_id',modelId).eq('id',body.note_id).select('id').single());
        await logModelActivity(admin,{organization_id:organization.id,model_id:modelId,kind:'note',title:'Note deleted',...(await actorFor(admin,user))});
        return json(200,{ok:true,verified:true,deleted_note_id:deleted.id,persisted_at:new Date().toISOString()});
      }
      return json(400,{error:'Unsupported model action'});
    }

    const admin=await requirePermission(user.id,organization.id,'models.read');
    const modelId=event.queryStringParameters?.model_id;
    if(!modelId){const e=new Error('model_id is required');e.statusCode=400;throw e;}
    const model=(await loadModels(admin,organization.id,[modelId]))[0];
    if(!model){const e=new Error('Model not found');e.statusCode=404;throw e;}

    const permissionKeys=['bookings.read','packages.read','tasks.read','development.read','mobility.read','contracts.read','usage.read','finance.read','models.write','public_profiles.read','public_profiles.manage'];
    const permissionPairs=await Promise.all(permissionKeys.map(async key=>[key,await assertPermission(admin,user.id,organization.id,key)]));
    const access=Object.fromEntries(permissionPairs);
    const publicProfile=(access['public_profiles.read']||access['public_profiles.manage'])?await one(admin.from('model_public_profiles').select('*').eq('organization_id',organization.id).eq('model_id',modelId).maybeSingle()):null;
    model.public_profile=publicProfile;
    const websiteProfile=websiteProfileStatus(model,publicProfile);
    const empty=Promise.resolve([]);
    // 16.9.37: explicit relational hydration. Avoid fragile PostgREST embedded joins so
    // Model 360 reads the exact same canonical rows written by the desk functions.
    const [bookingLinks,castingLinks,packageLinks,tasks,evaluationRows,planRows,travelRows,visa,contracts,usageRows,ledger,statements,notes]=await Promise.all([
      access['bookings.read']?rows(admin.from('booking_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false})):empty,
      access['bookings.read']?rows(admin.from('casting_models').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false})):empty,
      access['packages.read']?rows(admin.from('package_models').select('id,package_id,model_id,sort_order,headline,note,visible,created_at,updated_at').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false})):empty,
      access['tasks.read']?rows(admin.from('tasks').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false}).limit(250)):empty,
      access['development.read']?rows(admin.from('model_evaluations').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('evaluated_on',{ascending:false})):empty,
      access['development.read']?rows(admin.from('development_plans').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('created_at',{ascending:false})):empty,
      access['mobility.read']?rows(admin.from('travel_records').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('starts_at',{ascending:false})):empty,
      access['mobility.read']?rows(admin.from('visa_cases').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('hard_deadline',{ascending:true})):empty,
      access['contracts.read']?rows(admin.from('contracts').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('updated_at',{ascending:false})):empty,
      access['usage.read']?rows(admin.from('usage_rights').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('ends_on',{ascending:true})):empty,
      access['finance.read']?rows(admin.from('model_ledger_entries').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('effective_on',{ascending:false}).limit(500)):empty,
      access['finance.read']?rows(admin.from('statements').select('*').eq('organization_id',organization.id).eq('model_id',modelId).eq('statement_type','model').order('period_end',{ascending:false})):empty,
      rows(admin.from('model_notes').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(250))
    ]);

    const noteAuthorIds=[...new Set(notes.map(x=>x.created_by).filter(Boolean))];
    const noteAuthors=noteAuthorIds.length?await rows(admin.from('profiles').select('user_id,display_name').in('user_id',noteAuthorIds)):[];
    const noteAuthorMap=new Map(noteAuthors.map(x=>[String(x.user_id),x.display_name]));
    for(const note of notes)note.author_name=noteAuthorMap.get(String(note.created_by))||null;

    const bookingIds=[...new Set(bookingLinks.map(x=>x.booking_id).filter(Boolean))];
    const castingIds=[...new Set(castingLinks.map(x=>x.casting_id).filter(Boolean))];
    const packageIds=[...new Set(packageLinks.map(x=>x.package_id).filter(Boolean))];
    const evaluationIds=evaluationRows.map(x=>x.id).filter(Boolean);
    const planIds=planRows.map(x=>x.id).filter(Boolean);
    const travelIds=travelRows.map(x=>x.id).filter(Boolean);
    const [bookingParents,castingParents,packageParents,evaluationScores,developmentGoals,travelSegments,housingBookings,bookingRates,bookingUsage]=await Promise.all([
      bookingIds.length?rows(admin.from('bookings').select('*').eq('organization_id',organization.id).in('id',bookingIds)):empty,
      castingIds.length?rows(admin.from('castings').select('*').eq('organization_id',organization.id).in('id',castingIds)):empty,
      packageIds.length?rows(admin.from('packages').select('*').eq('organization_id',organization.id).in('id',packageIds)):empty,
      evaluationIds.length?rows(admin.from('model_evaluation_scores').select('*').eq('organization_id',organization.id).in('evaluation_id',evaluationIds).order('sort_order')):empty,
      planIds.length?rows(admin.from('development_goals').select('*').eq('organization_id',organization.id).in('development_plan_id',planIds).order('created_at')):empty,
      travelIds.length?rows(admin.from('travel_segments').select('*').eq('organization_id',organization.id).in('travel_record_id',travelIds).order('departs_at')):empty,
      travelIds.length?rows(admin.from('housing_bookings').select('*').eq('organization_id',organization.id).in('travel_record_id',travelIds).order('check_in_at')):empty,
      bookingIds.length?rows(admin.from('booking_rates').select('booking_id,model_id,unit_amount,currency,talent_gross,talent_net_estimate,notes').eq('organization_id',organization.id).eq('model_id',modelId).in('booking_id',bookingIds)):empty,
      bookingIds.length?rows(admin.from('booking_usage_terms').select('booking_id,model_id,notes,currency,created_at,updated_at').eq('organization_id',organization.id).in('booking_id',bookingIds)):empty
    ]);
    const entityCompanyIds=[...new Set([
      ...bookingParents.map(x=>x.company_id),...castingParents.map(x=>x.company_id),...packageParents.map(x=>x.company_id),...usageRows.map(x=>x.company_id)
    ].filter(Boolean))];
    const entityCompanies=entityCompanyIds.length?await rows(admin.from('companies').select('id,name,company_type,status').eq('organization_id',organization.id).in('id',entityCompanyIds)):[];
    const entityCompanyMap=new Map(entityCompanies.map(x=>[String(x.id),x]));
    const bookingParentMap=new Map(bookingParents.map(x=>[String(x.id),{...x,companies:entityCompanyMap.get(String(x.company_id))||null}]));
    const castingParentMap=new Map(castingParents.map(x=>[String(x.id),{...x,companies:entityCompanyMap.get(String(x.company_id))||null}]));
    const packageParentMap=new Map(packageParents.map(x=>[String(x.id),{...x,companies:entityCompanyMap.get(String(x.company_id))||null}]));
    const scoresByEvaluation=new Map(); for(const row of evaluationScores){const k=String(row.evaluation_id);if(!scoresByEvaluation.has(k))scoresByEvaluation.set(k,[]);scoresByEvaluation.get(k).push(row);}
    const goalsByPlan=new Map(); for(const row of developmentGoals){const k=String(row.development_plan_id);if(!goalsByPlan.has(k))goalsByPlan.set(k,[]);goalsByPlan.get(k).push(row);}
    const segmentsByTravel=new Map(); for(const row of travelSegments){const k=String(row.travel_record_id);if(!segmentsByTravel.has(k))segmentsByTravel.set(k,[]);segmentsByTravel.get(k).push(row);}
    const housingByTravel=new Map(); for(const row of housingBookings){const k=String(row.travel_record_id);if(!housingByTravel.has(k))housingByTravel.set(k,[]);housingByTravel.get(k).push(row);}
    const rateMap=new Map(bookingRates.map(x=>[String(x.booking_id),x]));
    const usageMap=new Map(bookingUsage.map(x=>[String(x.booking_id),x]));
    const bookingView=bookingLinks.map(x=>{const parent=bookingParentMap.get(String(x.booking_id))||null;return {...x,bookings:parent,shared_state:{rate:rateMap.get(String(x.booking_id))||null,usage:usageMap.get(String(x.booking_id))||null,payment_status:parent?.metadata?.payment_status||null,call_time:parent?.call_time||null,wrap_time:parent?.wrap_time||null}};});
    const castings=castingLinks.map(x=>({...x,castings:castingParentMap.get(String(x.casting_id))||null}));
    const packages=packageLinks.map(x=>({...x,packages:packageParentMap.get(String(x.package_id))||null}));
    const evaluations=evaluationRows.map(x=>({...x,model_evaluation_scores:scoresByEvaluation.get(String(x.id))||[]}));
    const plans=planRows.map(x=>({...x,development_goals:goalsByPlan.get(String(x.id))||[]}));
    const travel=travelRows.map(x=>({...x,travel_segments:segmentsByTravel.get(String(x.id))||[],housing_bookings:housingByTravel.get(String(x.id))||[]}));
    const usage=usageRows.map(x=>({...x,companies:entityCompanyMap.get(String(x.company_id))||null}));

    const placements=await rows(admin.from('model_placements').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('updated_at',{ascending:false}));
    const partnerIds=[...new Set(placements.map(x=>x.partner_agency_id).filter(Boolean))];
    const marketIds=[...new Set(placements.map(x=>x.market_id).filter(Boolean))];
    const partners=partnerIds.length?await rows(admin.from('partner_agencies').select('id,company_id,partner_type,portal_enabled,metadata').eq('organization_id',organization.id).in('id',partnerIds)):[];
    const companyIds=[...new Set(partners.map(x=>x.company_id).filter(Boolean))];
    const companies=companyIds.length?await rows(admin.from('companies').select('id,name,company_type,status').eq('organization_id',organization.id).in('id',companyIds)):[];
    const markets=marketIds.length?await rows(admin.from('markets').select('id,name,code').eq('organization_id',organization.id).in('id',marketIds)):[];
    const companyMap=new Map(companies.map(x=>[String(x.id),x]));
    const partnerMap=new Map(partners.map(x=>[String(x.id),{...x,company:companyMap.get(String(x.company_id))||null}]));
    const marketMap=new Map(markets.map(x=>[String(x.id),x]));
    const placementView=placements.map(x=>({...x,partner_agency:partnerMap.get(String(x.partner_agency_id))||null,market:marketMap.get(String(x.market_id))||null}));

    const [allMarkets,allDivisions,allBoards]=access['models.write']?await Promise.all([
      rows(admin.from('markets').select('id,name,code').eq('organization_id',organization.id).eq('active',true).order('sort_order')),
      rows(admin.from('divisions').select('id,name,code,gender_scope,stage_scope').eq('organization_id',organization.id).eq('active',true).order('sort_order')),
      rows(admin.from('boards').select('id,name,market_id,division_id').eq('organization_id',organization.id).eq('active',true).order('sort_order'))
    ]):[[],[],[]];
    return json(200,{environment:'veux-agency-v16.9.17-model-website-profile',organization,model,access,website_profile:websiteProfile,
      bookings:bookingView,castings,packages,tasks,development:{evaluations,plans},mobility:{travel,visa_cases:visa},
      legal:{contracts,usage_rights:usage},finance:{ledger,statements},notes,relations:{placements:placementView},lookups:{markets:allMarkets,divisions:allDivisions,boards:allBoards}});
  }catch(error){return errorResponse(error);}
};
