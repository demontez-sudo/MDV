import crypto from 'node:crypto';
import { adminClient, json, errorResponse, parseBody } from './auth.mjs';

const ACCOUNTS = {"fresh models":{"legacy_key":"fresh","display_name":"Fresh Models","hash":"4d42ae4edabc7461e93f06f7b932c2b9c001a8f38732990012bd285a5bd2913b"},"golden city models":{"legacy_key":"golden","display_name":"Golden City Models","hash":"a84052c678a529fff25775053447e5bd488b39fdb61abea4cc1f36bb5faf3ad1"},"itoo models":{"legacy_key":"itoo","display_name":"Itoo Models","hash":"44cf3dfebd8f2c746642d92779b4f30bf505652350eb7fa9827b5b6799e31334"},"felix management":{"legacy_key":"felix","display_name":"Felix Management","hash":"9f6f19b6520e89d10000fff2880ea97387f423a46d0e1446bc3212e7c886f0d0"},"rm models":{"legacy_key":"rm","display_name":"RM Models","hash":"9001ce18992b618a9db312fa141ef69e4d9509edfd23a8c7c47031312ccc9924"},"tomorrow tokyo":{"legacy_key":"tmw","display_name":"Tomorrow Tokyo","hash":"f5767c154d4e78a4a9ed6341f3f0705421566ab5ec2d78fb0020df4c64b49b6d"},"ytm models":{"legacy_key":"ytm","display_name":"YTM Models","hash":"a894d8b7cf66f5f04ea6f126f0a66e3f034c5261272f9267a7fbd17651558e51","models":["Zhiyan Li","Li Zhiyan","Li Zhiayn","Zhiayn Li"]}};

function normalize(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
function slug(value){return normalize(value).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'portal';}
function digest(value){return crypto.createHash('sha256').update(String(value||''),'utf8').digest('hex');}
function sameHex(a,b){try{const aa=Buffer.from(String(a),'hex'),bb=Buffer.from(String(b),'hex');return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb);}catch{return false;}}
function fail(message,statusCode=401){const e=new Error(message);e.statusCode=statusCode;throw e;}
async function one(query){const {data,error}=await query;if(error)throw error;return data||null;}


/* Access made from the main portal (Mother Agencies page): the code is stored only as a salted scrypt hash on partner_agencies.metadata.access. */
function normCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
async function managedAgencies(admin,orgId){
  const partners=(await admin.from('partner_agencies').select('id,company_id,portal_enabled,metadata').eq('organization_id',orgId).eq('partner_type','mother_agency')).data||[];
  const withAccess=partners.filter(p=>p.metadata&&p.metadata.access&&p.metadata.access.hash);
  if(!withAccess.length)return [];
  const ids=[...new Set(withAccess.map(p=>p.company_id).filter(Boolean))];
  const companies=ids.length?((await admin.from('companies').select('id,name').eq('organization_id',orgId).in('id',ids)).data||[]):[];
  const byId=new Map(companies.map(c=>[String(c.id),c]));
  return withAccess.map(p=>({partner:p,company:byId.get(String(p.company_id))})).filter(x=>x.company&&x.company.name);
}
async function checkManagedAccess(admin,orgId,identity,accessCode){
  const match=(await managedAgencies(admin,orgId)).find(x=>normalize(x.company.name)===identity);
  if(!match)return null;
  const {partner,company}=match,a=partner.metadata.access;
  if(a.locked_until&&new Date(a.locked_until).getTime()>Date.now())fail('Too many incorrect attempts. Try again in 15 minutes.',429);
  let ok=false;
  try{ok=a.algo==='scrypt'&&sameHex(crypto.scryptSync(normCode(accessCode),String(a.salt||''),32).toString('hex'),a.hash);}catch{ok=false;}
  const meta={...(partner.metadata||{})};
  if(!ok){
    const fails=(Number(a.fail_count)||0)+1;
    meta.access={...a,fail_count:fails>=8?0:fails,locked_until:fails>=8?new Date(Date.now()+15*60*1000).toISOString():null};
    await admin.from('partner_agencies').update({metadata:meta}).eq('id',partner.id);
    return false;
  }
  meta.access={...a,fail_count:0,locked_until:null,last_login_at:new Date().toISOString()};
  await admin.from('partner_agencies').update({metadata:meta}).eq('id',partner.id);
  return {legacy_key:slug(company.name),display_name:company.name};
}

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
    let names=Object.values(ACCOUNTS).map(({display_name})=>display_name);
    try{const admin=adminClient(),org=await one(admin.from('organizations').select('id').eq('slug','maison-de-veux').maybeSingle());if(org){for(const x of await managedAgencies(admin,org.id)){if(x.partner.portal_enabled!==false)names.push(x.company.name);}}}catch(_e){}
    names=[...new Set(names)];
    return json(200,{ok:true,agencies:names.sort((a,b)=>a.localeCompare(b))});
  }
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const body=parseBody(event),identity=normalize(body.identity),accessCode=String(body.password||body.access_code||''),organizationSlug=String(body.organization_slug||'maison-de-veux');
    if(!identity||!accessCode)fail(portal==='model'?'Enter your name and access code.':'Enter your agency name and access code.',400);
    let account=ACCOUNTS[identity];
    if(account&&!sameHex(digest(accessCode),account.hash))account=null;
    const admin=adminClient(),org=await organization(admin,organizationSlug);
    if(!account&&portal==='partner'){
      const managed=await checkManagedAccess(admin,org.id,identity,accessCode);
      if(managed)account=managed;
    }
    if(!account)fail(portal==='model'?'Incorrect name or access code.':'Incorrect agency or access code.',401);
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
      if(Array.isArray(account.models)&&account.models.length){
        try{
          for(const name of account.models){
            const model=await one(admin.from('models').select('id,display_name').eq('organization_id',org.id).ilike('display_name',name).maybeSingle());
            if(!model)continue;
            const has=await one(admin.from('model_placements').select('id').eq('organization_id',org.id).eq('model_id',model.id).eq('partner_agency_id',partner.id).maybeSingle());
            if(!has){const ins=await admin.from('model_placements').insert({organization_id:org.id,model_id:model.id,partner_agency_id:partner.id,status:'active'});if(ins.error)console.warn('[MA] placement link skipped:',ins.error.message);}
            break;
          }
        }catch(linkError){console.warn('[MA] placement link skipped:',linkError&&linkError.message);}
      }
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
