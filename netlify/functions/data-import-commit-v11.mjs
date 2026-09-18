import { requireUser, adminClient, assertPermission, parseBody, json, errorResponse } from './_lib/auth.mjs';
import { getOrganizationCapacity, assertCapacity } from './_lib/entitlements.mjs';

export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const {user}=await requireUser(event);const admin=adminClient();const body=parseBody(event);if(!body.import_job_id)return json(400,{error:'import_job_id is required'});
    const {data:job,error:jobError}=await admin.from('data_import_jobs').select('*').eq('id',body.import_job_id).single();if(jobError)throw jobError;if(!await assertPermission(admin,user.id,job.organization_id,'data.import'))return json(403,{error:'Data import permission required'});if(!['ready','validating','failed'].includes(job.status))return json(409,{error:`Import job cannot run from status ${job.status}`});
    const {data:rows,error:rowsError}=await admin.from('data_import_rows').select('*').eq('import_job_id',job.id).eq('status','valid').order('row_number').limit(Number(process.env.VEUX_IMPORT_COMMIT_BATCH||1000));if(rowsError)throw rowsError;if(!rows?.length)return json(409,{error:'No valid rows are ready to import'});
    if(job.entity_type==='models'){const capacity=await getOrganizationCapacity(admin,job.organization_id);assertCapacity(capacity,'models',rows.length);}
    const startedAt=new Date().toISOString();
    const {data:started,error:startError}=await admin.from('data_import_jobs').update({status:'importing',started_at:job.started_at||startedAt,last_error:null,updated_at:startedAt}).eq('id',job.id).select('id,status').single();
    if(startError)throw startError;if(started?.status!=='importing')throw new Error('Import job did not enter importing state');
    let imported=0,failed=0;const failures=[];
    for(const row of rows){
      try{
        const {data:result,error}=await admin.rpc('import_data_row_v1',{target_row:row.id});
        if(error)throw error;if(!result?.verified||!result?.record_id)throw new Error(`Import row ${row.row_number} was not verified after save`);
        imported++;
      }catch(error){
        failed++;const message=String(error?.message||error).slice(0,500);failures.push({row_number:row.row_number,error:message});
        const {data:failedRow,error:markError}=await admin.from('data_import_rows').update({status:'failed',errors:[message],updated_at:new Date().toISOString()}).eq('id',row.id).select('id,status').single();
        if(markError||failedRow?.status!=='failed')throw markError||new Error(`Could not persist failure state for import row ${row.row_number}`);
      }
    }
    const final=failed?'failed':'completed';const completedAt=new Date().toISOString();
    const {data:finalJob,error:finalError}=await admin.from('data_import_jobs').update({status:final,imported_rows:(job.imported_rows||0)+imported,completed_at:completedAt,last_error:failed?`${failed} row(s) failed`:null,updated_at:completedAt}).eq('id',job.id).select('id,status,imported_rows,completed_at,last_error').single();
    if(finalError)throw finalError;if(finalJob?.status!==final)throw new Error('Import job final state could not be verified');
    return json(failed?207:200,{ok:failed===0,verified:true,status:final,imported,failed,failures,persisted_at:completedAt});
  }catch(error){return errorResponse(error)}
};
