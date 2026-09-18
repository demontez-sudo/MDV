import crypto from 'node:crypto';

const TTL_MS=24*60*60*1000;
function secret(){
  const s=
    process.env.MODEL_RECOVERY_SECRET||
    process.env.VEUX_SUPABASE_SERVICE_ROLE_KEY||
    process.env.VEUX_SUPABASE_SECRET_KEY||
    process.env.SUPABASE_SECRET_KEY||
    process.env.SUPABASE_SERVICE_ROLE_KEY||
    '';
  if(!s)throw new Error('Model recovery signing secret is not configured.');
  return String(s).trim().replace(/^['"]|['"]$/g,'');
}
function b64(v){return Buffer.from(v).toString('base64url');}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8');}
function sig(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('base64url');}

export function issueModelRecoveryToken({userId,modelId,organizationId,email,ttlMs=TTL_MS}){
  const now=Date.now();
  const body={v:1,uid:String(userId),mid:String(modelId),oid:String(organizationId),email:String(email||'').toLowerCase(),iat:now,exp:now+ttlMs,nonce:crypto.randomBytes(12).toString('base64url')};
  const payload=b64(JSON.stringify(body));
  return `${payload}.${sig(payload)}`;
}
export function verifyModelRecoveryToken(token){
  const [payload,signature]=String(token||'').split('.');
  if(!payload||!signature)throw new Error('Invalid recovery token.');
  const expected=sig(payload);
  const a=Buffer.from(signature),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error('Invalid recovery token.');
  const body=JSON.parse(unb64(payload));
  if(body.v!==1||!body.uid||!body.mid||!body.oid||!body.exp)throw new Error('Invalid recovery token.');
  if(Date.now()>Number(body.exp))throw new Error('This recovery link has expired.');
  return body;
}
