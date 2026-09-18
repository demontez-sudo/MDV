import { createClient } from '@supabase/supabase-js';

const URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const PUB='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
const RESET_FLAG='cavyre_password_reset_required';
const TEMP_READY='cavyre_temporary_login_ready';
const TEMP_EXP='cavyre_temp_password_expires_at';

function env(name){
  try { const v=globalThis?.Netlify?.env?.get?.(name); if(v) return String(v).trim(); } catch {}
  try { return String(process?.env?.[name]||'').trim(); } catch { return ''; }
}
function serverKey(){
  return env('VEUX_SUPABASE_SERVICE_ROLE_KEY')||env('VEUX_SUPABASE_SECRET_KEY')||env('SUPABASE_SECRET_KEY')||env('SUPABASE_SERVICE_ROLE_KEY');
}
function out(status,body){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}

export default async (req)=>{
  if(req.method!=='POST') return out(405,{error:'Method not allowed'});
  const auth=req.headers.get('authorization')||'';
  const match=/^Bearer\s+(.+)$/i.exec(auth);
  if(!match) return out(401,{error:'Secure model session required.'});

  const body=await req.json().catch(()=>({}));
  const password=String(body.password||'');
  if(password.length<10) return out(400,{error:'Use at least 10 characters for your password.'});
  if(Buffer.byteLength(password,'utf8')>72) return out(400,{error:'Password is too long. Use 72 bytes or fewer.'});

  const userClient=createClient(URL,PUB,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${match[1]}`}}});
  const {data:userData,error:userError}=await userClient.auth.getUser(match[1]);
  if(userError||!userData?.user?.id) return out(401,{error:'Your temporary-password session is invalid or expired. Sign in again.'});

  const key=serverKey();
  if(!key) return out(503,{error:'Model Portal server configuration is incomplete.'});
  const admin=createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:links,error:linkError}=await admin.from('model_user_links')
    .select('id,model_id,organization_id').eq('user_id',userData.user.id).limit(1);
  if(linkError) return out(500,{error:'Server error'});
  if(!links?.length) return out(403,{error:'This login is not linked to an active Model Portal profile.'});

  const currentMeta=userData.user.app_metadata&&typeof userData.user.app_metadata==='object'?userData.user.app_metadata:{};
  const nextMeta={...currentMeta,[RESET_FLAG]:false,[TEMP_READY]:false,[TEMP_EXP]:null,cavyre_password_changed_at:new Date().toISOString(),cavyre_password_changed_via:'separated_model_portal_fix_1'};
  const {data,error}=await admin.auth.admin.updateUserById(userData.user.id,{password,email_confirm:true,app_metadata:nextMeta});
  if(error||!data?.user?.id) return out(500,{error:'Password update could not be verified.'});

  // Verify the new credential server-side before telling the portal it succeeded.
  const verifier=createClient(URL,PUB,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:verified,error:verifyError}=await verifier.auth.signInWithPassword({email:data.user.email,password});
  if(verifyError||verified?.user?.id!==userData.user.id) return out(409,{error:'Password changed but login verification failed. Contact your agency.'});

  return out(200,{ok:true,verified:true,requires_fresh_login:true});
};
