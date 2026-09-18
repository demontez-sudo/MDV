import crypto from 'node:crypto';
import { json } from './auth.mjs';

function canonical(value){
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}

export function requestHash(body={}){
  return crypto.createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
}

export function requestIdempotencyKey(event,body={}){
  const h=event.headers||{};
  return h['idempotency-key']||h['Idempotency-Key']||h['x-idempotency-key']||h['X-Idempotency-Key']||body.idempotency_key||null;
}

export async function enforceRateLimit(admin,{bucket,subject,maxRequests=60,windowSeconds=60}){
  const {data,error}=await admin.rpc('consume_rate_limit',{
    bucket_value:bucket,
    subject_value:String(subject||'anonymous'),
    max_requests:maxRequests,
    window_seconds:windowSeconds
  });
  if(error) throw error;
  if(!data?.allowed){
    const e=new Error(`Rate limit exceeded. Try again after ${data?.reset_at||'the current window'}.`);
    e.statusCode=429;e.rateLimit=data;throw e;
  }
  return data;
}

export async function withIdempotency(admin,{event,body,organizationId,userId,operation,ttlSeconds=86400,execute}){
  const key=requestIdempotencyKey(event,body);
  if(!key) return execute();
  if(String(key).length>200){const e=new Error('Idempotency key is too long');e.statusCode=400;throw e;}
  const hash=requestHash(body||{});
  const {data:begin,error}=await admin.rpc('begin_idempotent_request',{
    target_org:organizationId||null,
    target_user:userId||null,
    operation_value:operation,
    idempotency_value:String(key),
    request_hash_value:hash,
    ttl_seconds:ttlSeconds
  });
  if(error) throw error;
  if(begin?.replay) return json(Number(begin.response_status||200),begin.response_body||{ok:true},{'X-Idempotent-Replay':'true'});
  if(begin?.state==='started' && begin?.created===false){
    const e=new Error('An identical request with this idempotency key is already in progress');e.statusCode=409;throw e;
  }
  try{
    const response=await execute();
    let responseBody={ok:true};
    try{responseBody=response?.body?JSON.parse(response.body):responseBody;}catch{}
    const {error:finishError}=await admin.rpc('finish_idempotent_request',{
      request_id:begin.id,
      response_status_value:Number(response?.statusCode||200),
      response_body_value:responseBody
    });
    if(finishError) throw finishError;
    return response;
  }catch(error){
    if(begin?.id) await admin.rpc('fail_idempotent_request',{request_id:begin.id,error_code_value:error?.code||error?.message||'failed'}).catch(()=>{});
    throw error;
  }
}
