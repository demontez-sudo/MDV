import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
const group=(list,key)=>{const m=new Map();for(const x of list){const k=x[key];if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;};
const DEFAULT_WEIGHTS={runway:18,body_proportion:12,posture:12,heel_foot_control:12,posing:12,editorial:12,commercial:10,professionalism:12};
const ACTIVITY_TYPES=new Set(['test_shoot','digitals','runway_training','posing','movement','portfolio_review','wellness','meeting','skill_training','other']);
function normActivityType(v){const k=String(v||'other').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');if(ACTIVITY_TYPES.has(k))return k;const map={test:'test_shoot',shoot:'test_shoot',runway:'runway_training',walk:'runway_training',portfolio:'portfolio_review',training:'skill_training',skills:'skill_training'};return map[k]||'other';}
function weightedScore(list,key){
  let total=0,weights=0;
  for(const x of list||[]){const v=x&&x[key]!=null?Number(x[key]):NaN;if(!Number.isFinite(v))continue;const w=Number(x.weight||DEFAULT_WEIGHTS[x.category_key]||1);if(w<=0)continue;total+=v*w;weights+=w;}
  return weights?Math.round((total/weights)*10)/10:null;
}
function goalTitle(score){
  const label=score.category_label||String(score.category_key||'Development').replaceAll('_',' ');
  const map={runway:'Runway control & casting-ready walk',body_proportion:'Body presentation & line awareness',posture:'Posture, carriage & camera presence',heel_foot_control:'Heel / foot control & stability',posing:'Posing range & transition control',editorial:'Editorial expression & image range',commercial:'Commercial adaptability & client energy',professionalism:'Professionalism, timing & set readiness'};
  return map[score.category_key]||('Strengthen '+label);
}
async function ensureSmartPlan(admin,org,modelId,evaluationId,userId){
  const existing=await rows(admin.from('development_plans').select('*').eq('organization_id',org).eq('model_id',modelId).in('status',['active','draft']).order('updated_at',{ascending:false}).limit(1));
  if(existing[0])return existing[0];
  const {data,error}=await admin.from('development_plans').insert({organization_id:org,model_id:modelId,title:'Career Development Gameplan',status:'active',starts_on:new Date().toISOString().slice(0,10),target_date:new Date(Date.now()+90*86400000).toISOString().slice(0,10),summary:'Smart development plan generated from model evaluations and agency goals.',baseline_evaluation_id:evaluationId,metadata:{source:'smart_evaluation',created_by:userId}}).select('*').single();
  if(error)throw error;return data;
}
async function touchGoalsFromScores(admin,org,modelId,evaluation,userId,scores){
  const weak=(scores||[]).filter(x=>Number.isFinite(Number(x.current_score))&&(Number(x.current_score)<7||Number(x.potential_score||x.current_score)-Number(x.current_score)>=1.5)).sort((a,b)=>Number(a.current_score)-Number(b.current_score)).slice(0,4);
  if(!weak.length)return [];
  const plan=await ensureSmartPlan(admin,org,modelId,evaluation.id,userId);
  const existing=await rows(admin.from('development_goals').select('id,category,title,status').eq('organization_id',org).eq('development_plan_id',plan.id).not('status','in','(\"complete\",\"completed\")'));
  const existingCats=new Set(existing.map(x=>x.category));
  const rowsToAdd=weak.filter(x=>!existingCats.has(x.category_key)).map(x=>({organization_id:org,development_plan_id:plan.id,category:x.category_key,title:goalTitle(x),description:`Current ${Number(x.current_score).toFixed(1)} / 10 · Potential ${x.potential_score==null?'—':Number(x.potential_score).toFixed(1)}. Focus area automatically identified from the latest evaluation.`,status:'not_started',priority:Number(x.current_score)<6?'high':'normal',target_date:new Date(Date.now()+45*86400000).toISOString().slice(0,10),currency:'USD',metadata:{source:'smart_evaluation',evaluation_id:evaluation.id,baseline_score:Number(x.current_score),potential_score:x.potential_score==null?null:Number(x.potential_score)}}));
  if(rowsToAdd.length){const {data,error}=await admin.from('development_goals').insert(rowsToAdd).select('*');if(error)throw error;return data||[];}
  return [];
}
export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),body=event.httpMethod==='POST'?parseBody(event):{},p=event.queryStringParameters||{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      await requirePermission(user.id,organization.id,'development.write');
      const action=String(body.action||'');
      if(action==='goal_status'){
        const {data,error}=await client.rpc('set_development_goal_status',{target_org:organization.id,target_goal:body.goal_id,target_status:body.status,result_note_value:body.result_note||null});if(error)throw error;return json(200,{ok:true,verified:true,goal:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='create_plan'||action==='update_plan'){
        const payload={organization_id:organization.id,model_id:body.model_id,title:String(body.title||'').trim(),status:body.status||'active',starts_on:body.starts_on||null,target_date:body.target_date||null,owner_member_id:body.owner_member_id||null,summary:body.summary||null};
        if(!payload.model_id||!payload.title)return json(400,{error:'model_id and title are required'});
        let q=action==='create_plan'?client.from('development_plans').insert(payload):client.from('development_plans').update(payload).eq('organization_id',organization.id).eq('id',body.plan_id);
        const {data,error}=await q.select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,plan:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='create_goal'){
        const payload={organization_id:organization.id,development_plan_id:body.plan_id,category:body.category||'development',title:String(body.title||'').trim(),description:body.description||null,status:body.status||'not_started',priority:body.priority||'normal',target_date:body.target_date||null,owner_member_id:body.owner_member_id||null,cost_budget:body.cost_budget==null?null:Number(body.cost_budget),currency:body.currency||'USD'};
        if(!payload.development_plan_id||!payload.title)return json(400,{error:'plan_id and title are required'});
        const {data,error}=await client.from('development_goals').insert(payload).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,goal:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='create_activity'||action==='update_activity'){
        const payload={organization_id:organization.id,model_id:body.model_id,development_plan_id:body.plan_id||null,activity_type:normActivityType(body.activity_type),title:String(body.title||'').trim(),scheduled_at:body.scheduled_at||null,completed_at:body.completed_at||null,status:body.status||'planned',provider_company_id:body.provider_company_id||null,owner_member_id:body.owner_member_id||null,cost_amount:body.cost_amount==null?null:Number(body.cost_amount),currency:body.currency||'USD',notes:body.notes||null,result_note:body.result_note||null};
        if(!payload.model_id||!payload.title)return json(400,{error:'model_id and title are required'});
        let q=action==='create_activity'?client.from('development_activities').insert(payload):client.from('development_activities').update(payload).eq('organization_id',organization.id).eq('id',body.activity_id);
        const {data,error}=await q.select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,activity:data,persisted_at:data?.updated_at||data?.created_at||new Date().toISOString()});
      }
      if(action==='create_evaluation'||action==='update_evaluation'){
        const modelId=body.model_id||null;
        if(!modelId)return json(400,{error:'model_id is required'});
        const cleanScore=(v)=>v===null||v===undefined||v===''?null:Number(v);
        const incoming=Array.isArray(body.scores)?body.scores:[];
        const normalized=incoming.filter(x=>x&&x.category_key).map((x,i)=>({category_key:String(x.category_key),category_label:String(x.category_label||x.category_key),weight:x.weight==null?Number(DEFAULT_WEIGHTS[String(x.category_key)]||1):Number(x.weight),current_score:cleanScore(x.current_score),potential_score:cleanScore(x.potential_score),notes:x.notes||null,sort_order:x.sort_order==null?i:Number(x.sort_order)}));
        let current=body.smart_score===false?cleanScore(body.overall_current):weightedScore(normalized,'current_score');
        let potential=body.smart_score===false?cleanScore(body.overall_potential):weightedScore(normalized,'potential_score');
        if(current===null)current=cleanScore(body.overall_current);if(potential===null)potential=cleanScore(body.overall_potential);
        if(current!==null&&(Number.isNaN(current)||current<0||current>10))return json(400,{error:'overall_current must be between 0 and 10'});
        if(potential!==null&&(Number.isNaN(potential)||potential<0||potential>10))return json(400,{error:'overall_potential must be between 0 and 10'});
        const payload={organization_id:organization.id,model_id:modelId,evaluation_type:body.evaluation_type||'full',evaluated_on:body.evaluated_on||new Date().toISOString().slice(0,10),overall_current:current,overall_potential:potential,executive_summary:body.executive_summary||null,market_notes:body.market_notes&&typeof body.market_notes==='object'?body.market_notes:{},ai_assisted:!!body.ai_assisted,status:body.status||'draft',metadata:{smart_score:body.smart_score!==false,auto_goals:!!body.auto_goals,weights:normalized.reduce((a,x)=>(a[x.category_key]=x.weight,a),{})}};
        if(action==='update_evaluation'&&!body.evaluation_id)return json(400,{error:'evaluation_id is required'});
        for(const x of normalized){
          if(x.current_score!==null&&(Number.isNaN(x.current_score)||x.current_score<0||x.current_score>10))return json(400,{error:`${x.category_label} current score must be between 0 and 10`});
          if(x.potential_score!==null&&(Number.isNaN(x.potential_score)||x.potential_score<0||x.potential_score>10))return json(400,{error:`${x.category_label} potential score must be between 0 and 10`});
        }
        const {data:saved,error:saveError}=await client.rpc('save_model_evaluation_v1',{target_org:organization.id,target_evaluation:action==='update_evaluation'?body.evaluation_id:null,target_payload:payload,target_scores:normalized,target_user:user.id});
        if(saveError)throw saveError;if(!saved?.verified||!saved?.evaluation){const e=new Error('Evaluation save could not be verified.');e.statusCode=500;e.publicMessage='Evaluation was not confirmed as saved. Please retry.';throw e;}
        const evaluation=saved.evaluation,scoreRows=Array.isArray(saved.scores)?saved.scores:[];
        let touchedGoals=[];let warning=null;
        if(body.auto_goals){try{touchedGoals=await touchGoalsFromScores(client,organization.id,modelId,evaluation,user.id,scoreRows);}catch(e){warning='Evaluation saved, but smart development goals could not be refreshed.';}}
        return json(action==='create_evaluation'?201:200,{ok:true,verified:true,persisted_at:saved.persisted_at,evaluation:{...evaluation,overall_current:current,overall_potential:potential,model_evaluation_scores:scoreRows},touched_goals:touchedGoals,warning});
      }

      if(action==='smart_gameplan'){
        const modelId=body.model_id||null;if(!modelId)return json(400,{error:'model_id is required'});
        const latest=await rows(client.from('model_evaluations').select('*').eq('organization_id',organization.id).eq('model_id',modelId).order('evaluated_on',{ascending:false}).limit(1));
        const evaluation=latest[0]||null;
        const scores=evaluation?await rows(client.from('model_evaluation_scores').select('*').eq('organization_id',organization.id).eq('evaluation_id',evaluation.id).order('sort_order')):[];
        const plan=await ensureSmartPlan(client,organization.id,modelId,evaluation?.id||null,user.id);
        const generated=evaluation?await touchGoalsFromScores(client,organization.id,modelId,evaluation,user.id,scores):[];
        const standard=[
          ['image_skin','Skin & Grooming','Maintain a consistent skin/grooming routine and flag professional support needs early.'],
          ['wellness_routine','Wellness & Routine','Protect sleep, hydration, balanced nutrition and recovery around castings and travel.'],
          ['training_movement','Training & Movement','Maintain movement, posture, runway and mobility sessions appropriate to current bookings.'],
          ['portfolio_image','Portfolio & Image','Keep digitals, polaroids and portfolio assets season-ready.'],
          ['career_market','Career & Market','Review market targets, castings, tests and client positioning with the booking team.']
        ];
        const existing=await rows(client.from('development_goals').select('category').eq('organization_id',organization.id).eq('development_plan_id',plan.id).not('status','in','(\"complete\",\"completed\")'));
        const have=new Set(existing.map(x=>x.category));
        const add=standard.filter(x=>!have.has(x[0])).map((x,i)=>({organization_id:organization.id,development_plan_id:plan.id,category:x[0],title:x[1],description:x[2],status:'not_started',priority:'normal',target_date:new Date(Date.now()+(30+i*7)*86400000).toISOString().slice(0,10),currency:'USD',metadata:{source:'smart_gameplan'}}));
        let standardGoals=[];if(add.length){const {data,error}=await client.from('development_goals').insert(add).select('*');if(error)throw error;standardGoals=data||[];}
        return json(200,{ok:true,verified:true,plan,generated_goals:generated,standard_goals:standardGoals,persisted_at:new Date().toISOString()});
      }
      return json(400,{error:'Unsupported development action'});
    }
    const admin=await requirePermission(user.id,organization.id,'development.read'),modelId=p.model_id||null;
    let evalQ=admin.from('model_evaluations').select('*').eq('organization_id',organization.id).order('evaluated_on',{ascending:false});if(modelId)evalQ=evalQ.eq('model_id',modelId);
    let planQ=admin.from('development_plans').select('*').eq('organization_id',organization.id).order('target_date',{ascending:true});if(modelId)planQ=planQ.eq('model_id',modelId);
    let actQ=admin.from('development_activities').select('*').eq('organization_id',organization.id).order('scheduled_at',{ascending:false});if(modelId)actQ=actQ.eq('model_id',modelId);
    const [evaluations,plans,activities,scores,goals,models,companies]=await Promise.all([
      rows(evalQ.limit(350)),rows(planQ.limit(350)),rows(actQ.limit(500)),rows(admin.from('model_evaluation_scores').select('*').eq('organization_id',organization.id).limit(3000)),rows(admin.from('development_goals').select('*').eq('organization_id',organization.id).limit(2500)),rows(admin.from('models').select('id,display_name,public_slug').eq('organization_id',organization.id).limit(1000)),rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).limit(1000))
    ]);
    const mm=new Map(models.map(x=>[x.id,x])),cm=new Map(companies.map(x=>[x.id,x])),scoreMap=group(scores,'evaluation_id'),goalMap=group(goals,'development_plan_id'),activityMap=group(activities,'development_plan_id');
    return json(200,{environment:'veux-saas-v9',organization,evaluations:evaluations.map(x=>({...x,models:mm.get(x.model_id)||null,model_evaluation_scores:scoreMap.get(x.id)||[]})),plans:plans.map(x=>({...x,models:mm.get(x.model_id)||null,development_goals:goalMap.get(x.id)||[],development_activities:activityMap.get(x.id)||[]})),activities:activities.map(x=>({...x,models:mm.get(x.model_id)||null,companies:cm.get(x.provider_company_id)||null}))});
  }catch(error){return errorResponse(error);}
};
