import crypto from 'node:crypto';
import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';

async function queryAll(q){const {data,error}=await q;if(error)throw error;return data||[];}

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);const admin=adminClient();const body=parseBody(event);const org=body.organization_id;const type=String(body.export_type||'full');
    if(!org)return json(400,{error:'organization_id is required'});if(!await assertPermission(admin,user.id,org,'data.export'))return json(403,{error:'Data export permission required'});
    if(!['full','models','crm','bookings','finance','audit'].includes(type))return json(400,{error:'Unsupported export_type'});
    if(type==='finance'&&!await assertPermission(admin,user.id,org,'finance.read'))return json(403,{error:'Finance permission required'});
    if(type==='audit'&&!await assertPermission(admin,user.id,org,'audit.read'))return json(403,{error:'Audit permission required'});
    const {data:job,error:jobError}=await admin.from('data_export_jobs').insert({organization_id:org,export_type:type,format:'json',status:'processing',filters:body.filters||{},requested_by:user.id}).select('*').single();if(jobError)throw jobError;
    const payload={export_version:'veux-v11',organization_id:org,generated_at:new Date().toISOString(),export_type:type,data:{}};
    if(['full','models'].includes(type)){
      payload.data.models=await queryAll(admin.from('models').select('*').eq('organization_id',org));
      payload.data.measurements=await queryAll(admin.from('model_measurements').select('*').eq('organization_id',org));
      payload.data.media=await queryAll(admin.from('model_media').select('*').eq('organization_id',org));
    }
    if(['full','crm'].includes(type)){
      payload.data.companies=await queryAll(admin.from('companies').select('*').eq('organization_id',org));
      payload.data.contacts=await queryAll(admin.from('contacts').select('*').eq('organization_id',org));
      payload.data.contact_company_links=await queryAll(admin.from('contact_company_links').select('*').eq('organization_id',org));
    }
    if(['full','bookings'].includes(type)){
      payload.data.bookings=await queryAll(admin.from('bookings').select('*').eq('organization_id',org));
      payload.data.booking_models=await queryAll(admin.from('booking_models').select('*').eq('organization_id',org));
      payload.data.booking_options=await queryAll(admin.from('booking_options').select('*').eq('organization_id',org));
      payload.data.castings=await queryAll(admin.from('castings').select('*').eq('organization_id',org));
    }
    const canFinance=await assertPermission(admin,user.id,org,'finance.read');
    if(type==='finance'||(type==='full'&&canFinance)){
      payload.data.invoices=await queryAll(admin.from('invoices').select('*').eq('organization_id',org));
      payload.data.payments=await queryAll(admin.from('payments').select('*').eq('organization_id',org));
      payload.data.expenses=await queryAll(admin.from('expenses').select('*').eq('organization_id',org));
      payload.data.commissions=await queryAll(admin.from('commissions').select('*').eq('organization_id',org));
    }
    if(type==='audit') payload.data.audit_logs=await queryAll(admin.from('audit_logs').select('*').eq('organization_id',org).order('created_at',{ascending:false}).limit(10000));
    const bytes=Buffer.from(JSON.stringify(payload,null,2),'utf8');const bucket=process.env.VEUX_PRIVATE_STORAGE_BUCKET||'veux-private';const path=`${org}/exports/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${type}.json`;
    const {error:uploadError}=await admin.storage.from(bucket).upload(path,bytes,{contentType:'application/json',upsert:false});if(uploadError)throw uploadError;
    const expiresAt=new Date(Date.now()+24*3600*1000).toISOString();const {data:completedJob,error:completeError}=await admin.from('data_export_jobs').update({status:'completed',storage_bucket:bucket,storage_path:path,size_bytes:bytes.length,record_count:Object.values(payload.data).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0),completed_at:new Date().toISOString(),expires_at:expiresAt}).eq('id',job.id).select('id,status,storage_path,completed_at').single();if(completeError)throw completeError;if(completedJob?.status!=='completed')throw new Error('Export completion could not be verified');
    const {data:signed,error:signError}=await admin.storage.from(bucket).createSignedUrl(path,900);if(signError)throw signError;
    return json(201,{export_job_id:job.id,download_url:signed.signedUrl,download_expires_in_seconds:900,archive_expires_at:expiresAt,size_bytes:bytes.length});
  }catch(error){return errorResponse(error)}
};
