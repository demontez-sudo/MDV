export async function logModelActivity(admin,entry){
  try{
    if(!admin||!entry?.organization_id||!entry?.model_id||!entry?.title)return;
    const {error}=await admin.from('model_activity').insert({
      organization_id:entry.organization_id,
      model_id:entry.model_id,
      kind:String(entry.kind||'profile'),
      title:String(entry.title).slice(0,200),
      detail:entry.detail?String(entry.detail).slice(0,600):null,
      actor_id:entry.actor_id||null,
      actor_name:entry.actor_name||null,
      link_page:entry.link_page||null,
      link_id:entry.link_id?String(entry.link_id):null,
      metadata:entry.metadata&&typeof entry.metadata==='object'?entry.metadata:{}
    });
    if(error)console.warn('[model-activity] not logged:',error.message);
  }catch(e){console.warn('[model-activity] not logged:',e?.message);}
}

export async function actorFor(admin,user){
  try{
    const {data}=await admin.from('profiles').select('display_name').eq('user_id',user.id).maybeSingle();
    return {actor_id:user.id,actor_name:data?.display_name||user.email||null};
  }catch(_e){return {actor_id:user?.id||null,actor_name:user?.email||null};}
}
