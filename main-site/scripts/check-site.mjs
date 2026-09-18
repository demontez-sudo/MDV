import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const toml=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(!['16.9.28','16.9.29','16.9.30'].includes(pkg.version)) throw new Error('Main site package version does not preserve 16.9.28+');
const required=['https://maison-agent.netlify.app/','https://maison-models.netlify.app/','https://maison-ma.netlify.app/'];
for(const x of required) if(!toml.includes(x)) throw new Error('Missing route '+x);
for(const route of ['from = "/admin/*"','from = "/admin"','from = "/team"','from = "/api/public/forms/get-scouted"','from = "/api/*"','from = "/health"']) if(!toml.includes(route)) throw new Error('Missing branded admin route '+route);
if(!/from = "\/admin\/\*"[\s\S]*?to = "https:\/\/maison-agent\.netlify\.app\/:splat"[\s\S]*?status = 200/.test(toml)) throw new Error('Admin wildcard is not a 200 reverse proxy');
if(!/from = "\/admin"[\s\S]*?to = "https:\/\/maison-agent\.netlify\.app\/"[\s\S]*?status = 200/.test(toml)) throw new Error('Admin root is not a 200 reverse proxy');
if(!/from = "\/team"[\s\S]*?to = "https:\/\/maison-agent\.netlify\.app\/"[\s\S]*?status = 302/.test(toml)) throw new Error('/team is not transition-safe to Agent origin');
const redirectBlocks=toml.split('[[redirects]]').slice(1);
for(const block of redirectBlocks){
  const badAdminHandoff=block.includes('from = \"/admin\"')&&block.includes('to = \"https://maison-agent.netlify.app/\"')&&block.includes('status = 302');
  if(badAdminHandoff) throw new Error('Canonical /admin still uses browser handoff instead of reverse proxy');
}
if(toml.includes('https://maison-model.netlify.app/')) throw new Error('Stale singular Model Portal origin remains');
for(const route of ['from = "/p/*"','from = "/api/public/package"','from = "/api/public/package/feedback"']) if(!toml.includes(route)) throw new Error('Missing branded package proxy '+route);

const redirectsPath=path.join(root,'_redirects');
if(!fs.existsSync(redirectsPath)) throw new Error('Missing _redirects package cutover safeguard');
const redirects=fs.readFileSync(redirectsPath,'utf8');
for(const rule of [
  '/api/public/forms/get-scouted https://maison-agent.netlify.app/api/public/forms/get-scouted 200!',
  '/admin/* https://maison-agent.netlify.app/:splat 200!',
  '/admin https://maison-agent.netlify.app/ 200!',
  '/team https://maison-agent.netlify.app/ 302!',
  '/api/* https://maison-agent.netlify.app/api/:splat 200!',
  '/health https://maison-agent.netlify.app/health 200!',
  '/p/* https://maison-agent.netlify.app/p/:splat 200!',
  '/api/public/package https://maison-agent.netlify.app/api/public/package 200!',
  '/api/public/package/feedback https://maison-agent.netlify.app/api/public/package/feedback 200!'
]) if(!redirects.includes(rule)) throw new Error('Missing forced package cutover rule '+rule);
if(toml.indexOf('from = "/p/*"') > toml.indexOf('from = "/:profile"')) throw new Error('Branded package proxy must precede dynamic model-profile fallback');
if(fs.existsSync(path.join(root,'p'))) throw new Error('Static /p directory could shadow package proxy');
if(toml.includes('/.netlify/functions/public-roster')) throw new Error('Old roster function dependency remains');
for(const p of ['women-nyc','development-nyc','men-newyork','creators','women-paris','development-paris','men-paris']){
  const h=fs.readFileSync(path.join(root,p,'index.html'),'utf8');
  if(!h.includes('id="mdv-public-roster"')) throw new Error('Missing dynamic roster mount '+p);
  if(!h.includes('/assets/mdv-public-roster.js')) throw new Error('Missing public roster loader '+p);
}
const creators=fs.readFileSync(path.join(root,'creators','index.html'),'utf8');
if(!creators.includes('data-market="New York"')||!creators.includes('data-view="creator"')) throw new Error('Creator board is not linked to New York creator RPC view');
if(/Coming Soon/.test(creators)) throw new Error('Creator page still contains static Coming Soon state');
const pub=fs.readFileSync(path.join(root,'assets','mdv-public-roster.js'),'utf8');
if(/SUPABASE_SERVICE_ROLE|service_role/i.test(pub)) throw new Error('Public JS contains service-role marker');
if(!pub.includes('mogyngdhmzbjmcdqeoxu.supabase.co')) throw new Error('Public roster does not target production Supabase');
if(!pub.includes('website_public_roster')) throw new Error('Public roster RPC missing');
if(!pub.includes('sb_publishable_')) throw new Error('Publishable key missing');
if(!pub.includes('static-fallback')) throw new Error('Static roster failover missing');

for(const p of ['newyork/index.html','paris/index.html','newyork/news/index.html','paris/news/index.html']){
  const h=fs.readFileSync(path.join(root,p),'utf8');
  if(!h.includes("-webkit-line-clamp: 3")) throw new Error('Missing three-line blog clamp '+p);
  if(!h.includes("font-family: 'Jost', sans-serif")) throw new Error('Missing editorial Jost typography '+p);
}
for(const p of ['newyork/news/index.html','paris/news/index.html']){
  const h=fs.readFileSync(path.join(root,p),'utf8');
  if(!h.includes("class=\"feature-caption clamped\"")) throw new Error('Editorial feature caption is not clamped '+p);
  if(!h.includes("class=\"feature-readmore\"")) throw new Error('Editorial Read More control missing '+p);
  if(h.includes(".feature-caption::first-letter")) throw new Error('Legacy drop cap can interfere with clamp '+p);
}

const scout=fs.readFileSync(path.join(root,'get-scouted','index.html'),'utf8');
if(/data-netlify=|netlify-honeypot/.test(scout)) throw new Error('Get Scouted still depends on legacy Netlify Forms');
if(!scout.includes('id="scoutGender"')||!scout.includes('Board Interest')||!scout.includes('updateScoutBoards()')) throw new Error('Get Scouted gender-aware board controls missing');
if(!scout.includes("/api/public/forms/get-scouted")||!scout.includes("action:'prepare'")||!scout.includes("action:'finalize'")) throw new Error('Get Scouted secure intake prepare/finalize flow missing');
if(!scout.includes('uploadToSignedUrl(u.path,u.token')) throw new Error('Get Scouted signed private upload flow missing');
if(toml.indexOf('from = "/api/public/forms/get-scouted"') > toml.indexOf('from = "/api/*"')) throw new Error('Specific Get Scouted proxy must precede generic Agent API proxy');

const routerPath=path.join(root,'netlify','functions','model-profile-router.mjs');
if(!fs.existsSync(routerPath))throw new Error('Dynamic Agency-created model profile router missing');
const router=fs.readFileSync(routerPath,'utf8');
if(!router.includes('website_public_model_profile'))throw new Error('Dynamic model router does not validate the public MOGY profile');
if(!router.includes("'https://maison-'+route+'.netlify.app/'"))throw new Error('Dynamic model router does not preserve individual model-site architecture');
if(/SUPABASE_SERVICE_ROLE|service_role/i.test(router))throw new Error('Dynamic model router contains service-role marker');
if(!toml.includes('from = "/:profile"')||!toml.includes('model-profile-router?profile=:profile'))throw new Error('Dynamic one-segment model profile fallback is not wired');
const fb=fs.readFileSync(path.join(root,'assets','mdv-roster-fallbacks.js'),'utf8');
for(const name of ['Clara Wahlqvist','Tosin Florence','Aidan Jake','Alex Nicola']) if(!fb.includes(name)) throw new Error('Canonical fallback missing dual-market model '+name);
if(!pub.includes('retryLiveRoster')) throw new Error('Public roster does not retry live canonical feed after fallback');
console.log('Maison de Veux 16.9.29 canonical multi-market roster + branded routing gate PASS');
