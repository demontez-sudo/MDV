import crypto from 'node:crypto';
import { adminClient, json, errorResponse, parseBody } from './auth.mjs';

const ACCOUNTS = {"fresh models":{"legacy_key":"fresh","display_name":"Fresh Models","hash":"4d42ae4edabc7461e93f06f7b932c2b9c001a8f38732990012bd285a5bd2913b"},"golden city models":{"legacy_key":"golden","display_name":"Golden City Models","hash":"a84052c678a529fff25775053447e5bd488b39fdb61abea4cc1f36bb5faf3ad1"},"itoo models":{"legacy_key":"itoo","display_name":"Itoo Models","hash":"44cf3dfebd8f2c746642d92779b4f30bf505652350eb7fa9827b5b6799e31334"},"felix management":{"legacy_key":"felix","display_name":"Felix Management","hash":"9f6f19b6520e89d10000fff2880ea97387f423a46d0e1446bc3212e7c886f0d0"},"rm models":{"legacy_key":"rm","display_name":"RM Models","hash":"9001ce18992b618a9db312fa141ef69e4d9509edfd23a8c7c47031312ccc9924"},"tomorrow tokyo":{"legacy_key":"tmw","display_name":"Tomorrow Tokyo","hash":"f5767c154d4e78a4a9ed6341f3f0705421566ab5ec2d78fb0020df4c64b49b6d"}};

function normalize(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
function slug(value){return normalize(value).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'portal';}
function digest(value){return crypto.createHash('sha256').update(String(value||''),'utf8').digest('hex');}
function sameHex(a,b){try{const aa=Buffer.from(String(a),'hex'),bb=Buffer.from(String(b),'hex');return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb);}catch{return false;}}
function fail(message,statusCode=401){const e=new Error(message);e.statusCode=statusCode;throw e;}
async function one(query){const {data,error}=await query;if(error)throw error;return data||null;}

async function organization(admin,slugValue){
  const org=await one(admin.from('organizations').select('id,slug,name,status').eq('slug',slugValue).maybeSingle());
  if(!org)fail('Maison de Veux portal organization was not found.',404);
  if(org.status&&org.status!=='active')fail('This portal is currently unavailable.',403);
  return org;
}

async function ensureEmail(admin,userId,email){
  const got=await admin.auth.admin.getUserById(userId);
  if(got.error)throw got.error;
  const existing=got.data&&got.data.user;
  if(existing&&existing.email)return existing.email;
  const up=await admin.auth.admin.updateUserById(userId,{email});
  if(up.error)throw up.error;
  return up.data.user.email||email;
}

async function createPortalUser(admin,{org,portal,legacyKey,targetId,displayName}){
  const email=`portal-${portal}-${slug(legacyKey)}-${String(targetId).slice(0,8)}@maisondeveux.com`;
  const password=crypto.randomBytes(36).toString('base64url')+'Aa9!';
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName,portal,provisioned_by:'legacy_access_bridge'}});
  if(created.error)throw created.error;
  return {userId:created.data.user.id,email};
}

async function ensureMembership(admin,{org,userId,memberType,displayName,legacyKey}){
  const now=new Date().toISOString();
  const existing=await one(admin.from('organization_members').select('*').eq('organization_id',org.id).eq('user_id',userId).maybeSingle());
  if(existing){
    const {error}=await admin.from('organization_members').update({member_type:memberType,status:'active',joined_at:existing.joined_at||now,last_seen_at:now,metadata:{...(existing.metadata||{}),legacy_key:legacyKey,legacy_access_bridge:true,display_name:(existing.metadata&&existing.metadata.display_name)||displayName}}).eq('id',existing.id);
    if(error)throw error;
    return;
  }
  const {error}=await admin.from('organization_members').insert({organization_id:org.id,user_id:userId,member_type:memberType,status:'active',job_title:memberType==='model'?'Model':'Mother Agency',joined_at:now,last_seen_at:now,metadata:{legacy_key:legacyKey,legacy_access_bridge:true,display_name:displayName}});
  if(error)throw error;
}

async function magicToken(admin,email){
  const generated=await admin.auth.admin.generateLink({type:'magiclink',email});
  if(generated.error)throw generated.error;
  const props=generated.data&&generated.data.properties||{};
  if(!props.hashed_token)fail('Could not create a secure portal session.',500);
  return {token_hash:props.hashed_token,verification_type:props.verification_type||'magiclink'};
}

export async function legacyAccessHandler(event,portal){
  if(event.httpMethod==='GET'){
    if(portal!=='partner')return json(405,{error:'Method not allowed'});
    return json(200,{ok:true,agencies:Object.values(ACCOUNTS).map(({display_name})=>display_name).sort((a,b)=>a.localeCompare(b))});
  }
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const body=parseBody(event),identity=normalize(body.identity),accessCode=String(body.password||body.access_code||''),organizationSlug=String(body.organization_slug||'maison-de-veux');
    if(!identity||!accessCode)fail(portal==='model'?'Enter your name and access code.':'Enter your agency name and access code.',400);
    const account=ACCOUNTS[identity];
    if(!account||!sameHex(digest(accessCode),account.hash))fail(portal==='model'?'Incorrect name or access code.':'Incorrect agency or access code.',401);
    const admin=adminClient(),org=await organization(admin,organizationSlug);
    let targetId,userId,email;
    if(portal==='model'){
      let model=await one(admin.from('models').select('id,display_name,legacy_key,status,active').eq('organization_id',org.id).eq('legacy_key',account.legacy_key).maybeSingle());
      if(!model)model=await one(admin.from('models').select('id,display_name,legacy_key,status,active').eq('organization_id',org.id).ilike('display_name',account.display_name).maybeSingle());
      if(!model)fail('Your model profile has not been migrated into VEUX DESK yet. Contact the agency.',404);
      if(model.active===false||model.status==='archived')fail('This model portal access is inactive.',403);
      targetId=model.id;
      const link=await one(admin.from('model_user_links').select('user_id').eq('organization_id',org.id).eq('model_id',targetId).maybeSingle());
      if(link){userId=link.user_id;email=await ensureEmail(admin,userId,`portal-model-${slug(account.legacy_key)}-${String(targetId).slice(0,8)}@maisondeveux.com`);}
      else{
        const created=await createPortalUser(admin,{org,portal:'model',legacyKey:account.legacy_key,targetId,displayName:model.display_name||account.display_name});userId=created.userId;email=created.email;
        await ensureMembership(admin,{org,userId,memberType:'model',displayName:model.display_name||account.display_name,legacyKey:account.legacy_key});
        const {error}=await admin.from('model_user_links').insert({organization_id:org.id,user_id:userId,model_id:targetId});if(error)throw error;
      }
      await ensureMembership(admin,{org,userId,memberType:'model',displayName:model.display_name||account.display_name,legacyKey:account.legacy_key});
    }else{
      let company=await one(admin.from('companies').select('id,name,status').eq('organization_id',org.id).ilike('name',account.display_name).maybeSingle());
      if(!company){
        const createdCompany=await admin.from('companies').insert({organization_id:org.id,legacy_id:'partner-'+slug(account.legacy_key),name:account.display_name,company_type:'agency',status:'active',notes:'Mother Agency portal partner',metadata:{portal_seed:'legacy_access_bridge'}}).select('id,name,status').single();
        if(createdCompany.error)throw createdCompany.error;company=createdCompany.data;
      }
      let partner=await one(admin.from('partner_agencies').select('id,portal_enabled,partner_type').eq('organization_id',org.id).eq('company_id',company.id).maybeSingle());
      if(!partner){
        const createdPartner=await admin.from('partner_agencies').insert({organization_id:org.id,company_id:company.id,partner_type:'mother_agency',portal_enabled:true,notes:'Mother Agency portal access enabled',metadata:{portal_seed:'legacy_access_bridge'}}).select('id,portal_enabled,partner_type').single();
        if(createdPartner.error)throw createdPartner.error;partner=createdPartner.data;
      }
      if(partner.portal_enabled===false)fail('This Mother Agency portal access is disabled.',403);
      targetId=partner.id;
      const link=await one(admin.from('partner_user_links').select('user_id').eq('organization_id',org.id).eq('partner_agency_id',targetId).limit(1).maybeSingle());
      if(link){userId=link.user_id;email=await ensureEmail(admin,userId,`portal-partner-${slug(account.legacy_key)}-${String(targetId).slice(0,8)}@maisondeveux.com`);}
      else{
        const created=await createPortalUser(admin,{org,portal:'partner',legacyKey:account.legacy_key,targetId,displayName:company.name||account.display_name});userId=created.userId;email=created.email;
        await ensureMembership(admin,{org,userId,memberType:'partner',displayName:company.name||account.display_name,legacyKey:account.legacy_key});
        const {error}=await admin.from('partner_user_links').insert({organization_id:org.id,user_id:userId,partner_agency_id:targetId});if(error)throw error;
      }
      await ensureMembership(admin,{org,userId,memberType:'partner',displayName:company.name||account.display_name,legacyKey:account.legacy_key});
    }
    const token=await magicToken(admin,email);
    return json(200,{ok:true,portal,identity:account.display_name,...token});
  }catch(error){return errorResponse(error);}
}
