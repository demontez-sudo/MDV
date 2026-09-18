import { createClient } from '@supabase/supabase-js';

const PROD_SUPABASE_URL='https://mogyngdhmzbjmcdqeoxu.supabase.co';
const PROD_SUPABASE_PUBLISHABLE_KEY='sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';

export async function verifyModelPassword({email,password}){
  const client=createClient(PROD_SUPABASE_URL,PROD_SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const {data,error}=await client.auth.signInWithPassword({
    email:String(email||'').trim().toLowerCase(),
    password:String(password||'')
  });
  if(error||!data?.user?.id){
    const e=new Error(error?.message||'Supabase rejected the new password.');
    e.statusCode=502;
    e.code='MODEL_CREDENTIAL_VERIFICATION_FAILED';
    e.publicMessage='The password was saved but Supabase did not accept it for login. Please generate a new password and try again.';
    throw e;
  }
  return {
    ok:true,
    user_id:data.user.id,
    email:data.user.email||String(email||'').trim().toLowerCase(),
    project:'mogyngdhmzbjmcdqeoxu',
    session:data.session?{
      access_token:data.session.access_token,
      refresh_token:data.session.refresh_token,
      expires_in:data.session.expires_in,
      expires_at:data.session.expires_at,
      token_type:data.session.token_type||'bearer',
      user:data.session.user||data.user
    }:null
  };
}
