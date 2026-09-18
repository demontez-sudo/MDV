import { requireUser, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { requireStaffOrganization, requirePermission } from './_lib/agent-bridge.mjs';
async function rows(q){const {data,error}=await q;if(error)throw error;return data||[];}
export const handler=async(event)=>{
  if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
  try{
    const {user,client}=await requireUser(event),p=event.queryStringParameters||{},body=event.httpMethod==='POST'?parseBody(event):{};
    const {organization}=await requireStaffOrganization({user,client,organizationSlug:body.organization_slug||p.organization||'maison-de-veux'});
    if(event.httpMethod==='POST'){
      const admin=await requirePermission(user.id,organization.id,'messages.write'),action=String(body.action||'');
      if(action==='send'){
        const text=String(body.body||'').trim();if(!text)return json(400,{error:'message body is required'});
        const conversationId=body.conversation_id||null,modelId=body.model_id||null,subject=String(body.subject||'Agent message').trim();
        if(!conversationId&&!modelId)return json(400,{error:'model_id is required for a new conversation'});
        const {data:saved,error:saveError}=await admin.rpc('send_staff_model_message_v1',{target_org:organization.id,target_conversation:conversationId,target_model:modelId,target_subject:subject,target_body:text,target_sender:user.id,target_sender_label:body.sender_label||'Maison de Veux'});
        if(saveError)throw saveError;if(!saved?.verified||!saved?.message){const e=new Error('Message save could not be verified.');e.statusCode=500;throw e;}
        return json(200,{ok:true,verified:true,conversation_id:saved.conversation_id,message:saved.message,persisted_at:saved.persisted_at});
      }
      if(action==='status'){
        const status=String(body.status||'active');if(!['active','archived','closed'].includes(status))return json(400,{error:'invalid conversation status'});
        const {data,error}=await admin.from('conversations').update({status}).eq('organization_id',organization.id).eq('id',body.conversation_id).select('*').single();if(error)throw error;return json(200,{ok:true,verified:true,conversation:data,persisted_at:data?.updated_at||new Date().toISOString()});
      }
      return json(400,{error:'Unsupported communications action'});
    }
    const admin=await requirePermission(user.id,organization.id,'messages.read');
    const conversations=await rows(admin.from('conversations').select('*').eq('organization_id',organization.id).order('updated_at',{ascending:false}).limit(500));
    const ids=conversations.map(x=>x.id),companyIds=[...new Set(conversations.map(x=>x.company_id).filter(Boolean))];
    // New-message recipient choices must come from the live roster, not only models
    // that already have conversations. Otherwise a fresh communications desk has
    // zero selectable recipients even when the organization has an active roster.
    const [messages,models,companies]=await Promise.all([
      ids.length?rows(admin.from('messages').select('*').eq('organization_id',organization.id).in('conversation_id',ids).is('deleted_at',null).order('sent_at',{ascending:true}).limit(5000)):[],
      rows(admin.from('models').select('id,display_name,public_slug,status,active,primary_market_label,stage').eq('organization_id',organization.id).eq('active',true).order('display_name',{ascending:true}).limit(1000)),
      companyIds.length?rows(admin.from('companies').select('id,name').eq('organization_id',organization.id).in('id',companyIds)):[]
    ]);
    const mm=new Map(models.map(x=>[x.id,x])),cm=new Map(companies.map(x=>[x.id,x]));
    return json(200,{environment:'veux-saas-v13.6',organization,conversations:conversations.map(c=>({...c,model:mm.get(c.model_id)||null,company:cm.get(c.company_id)||null,messages:messages.filter(m=>m.conversation_id===c.id)})),models});
  }catch(error){return errorResponse(error);}
};
