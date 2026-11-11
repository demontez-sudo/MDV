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

/* A short fingerprint of the login email: if the email changes after a link was made, the link stops working. */
export function emailHash(email){return crypto.createHash('sha256').update(String(email||'').trim().toLowerCase()).digest().subarray(0,4);}
const uuidBytes=u=>{const h=String(u).replace(/-/g,'');if(!/^[0-9a-f]{32}$/i.test(h))throw new Error('Recovery links need valid ids.');return Buffer.from(h,'hex');};
const bytesUuid=b=>{const h=Buffer.from(b).toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};

/* The original long token (about 400 characters). Still accepted, so links already sent keep working. */
export function issueModelRecoveryToken({userId,modelId,organizationId,email,ttlMs=TTL_MS}){
  const now=Date.now();
  const body={v:1,uid:String(userId),mid:String(modelId),oid:String(organizationId),email:String(email||'').toLowerCase(),iat:now,exp:now+ttlMs,nonce:crypto.randomBytes(12).toString('base64url')};
  const payload=b64(JSON.stringify(body));
  return `${payload}.${sig(payload)}`;
}

/* The short token (about 72 characters) used in emails and messages: version byte, user id, model id, expiry (seconds, 5 bytes),
   a fingerprint of the login email, and a 12-byte signature. The agency is not stored in it; the sign-in step looks the agency up itself. */
export function issueCompactRecoveryToken({userId,modelId,email,ttlMs=TTL_MS}){
  const exp=Math.floor((Date.now()+ttlMs)/1000),e=Buffer.alloc(5);e.writeUIntBE(exp,0,5);
  const head=Buffer.concat([Buffer.from([2]),uuidBytes(userId),uuidBytes(modelId),e,emailHash(email)]);
  const mac=crypto.createHmac('sha256',secret()).update(head).digest().subarray(0,12);
  return Buffer.concat([head,mac]).toString('base64url');
}

export function verifyModelRecoveryToken(token){
  token=String(token||'').trim();
  if(!token.includes('.')){
    let raw;try{raw=Buffer.from(token,'base64url');}catch(_e){raw=null;}
    if(!raw||raw.length!==54||raw[0]!==2)throw new Error('Invalid recovery token.');
    const head=raw.subarray(0,42),mac=raw.subarray(42),want=crypto.createHmac('sha256',secret()).update(head).digest().subarray(0,12);
    if(!crypto.timingSafeEqual(mac,want))throw new Error('Invalid recovery token.');
    const exp=raw.readUIntBE(33,5)*1000;
    if(Date.now()>exp)throw new Error('This recovery link has expired.');
    return {v:2,uid:bytesUuid(raw.subarray(1,17)),mid:bytesUuid(raw.subarray(17,33)),oid:null,email:null,email_hash:raw.subarray(38,42),exp};
  }
  const [payload,signature]=token.split('.');
  if(!payload||!signature)throw new Error('Invalid recovery token.');
  const expected=sig(payload);
  const a=Buffer.from(signature),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error('Invalid recovery token.');
  const body=JSON.parse(unb64(payload));
  if(body.v!==1||!body.uid||!body.mid||!body.oid||!body.exp)throw new Error('Invalid recovery token.');
  if(Date.now()>Number(body.exp))throw new Error('This recovery link has expired.');
  return body;
}
