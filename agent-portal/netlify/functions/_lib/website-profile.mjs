export function websiteProfileStatus(model,publicProfile){
  const media=Array.isArray(model?.media)?model.media:[];
  const headshot=media.find(x=>x?.is_primary===true&&x?.is_public===true&&String(x?.media_type||'').toLowerCase()==='image'&&String(x?.category||'').toLowerCase()==='headshot')||null;
  const publicMedia=media.filter(x=>x?.is_public===true);
  const wm=publicProfile?.metadata?.website_profile||{};
  const routeKey=String(model?.legacy_key||wm.route_key||'').trim().toLowerCase();
  const siteName=routeKey?'maison-'+routeKey:null;
  const siteOrigin=String(wm.site_origin||((siteName&&('https://'+siteName+'.netlify.app'))||'')).trim()||null;
  const profileUrl=String(wm.profile_url||((routeKey&&('https://www.maisondeveux.com/'+routeKey))||'')).trim()||null;
  return {
    created:!!publicProfile,
    published:!!publicProfile?.published,
    route_key:routeKey||null,
    public_slug:model?.public_slug||null,
    profile_url:profileUrl,
    site_name:siteName,
    site_origin:siteOrigin,
    deployment_status:String(wm.deployment_status||(publicProfile?(publicProfile?.metadata?.publication_source?'existing_site_needs_sync':'build_required'):'not_created')),
    existing_site:!!(publicProfile?.metadata?.publication_source),
    headshot:headshot?{id:headshot.id,url:headshot.url,category:headshot.category}:null,
    has_headshot:!!headshot,
    public_media_count:publicMedia.length,
    ready_to_publish:!!(publicProfile&&routeKey&&model?.public_slug&&headshot),
    build_filename:siteName?siteName+'.zip':null
  };
}
