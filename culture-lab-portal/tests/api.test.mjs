// Culture Lab Casting API tests: permissions, workflow rules, Lab Assistant, DaySilk, tasks, timed rules, file policy and edit conflicts.
// Runs the real server handler against an in-memory Postgres (PGlite) loaded with supabase/sql/01_culture_lab_schema.sql.
// Run: npm install, then npm test
import fs from 'fs';import vm from 'vm';import {PGlite} from '@electric-sql/pglite';
const R=new URL('..',import.meta.url).pathname;globalThis.window=globalThis;globalThis.CL_DEFER=true;
for(const f of ['assets/culture-store.js'])vm.runInThisContext(fs.readFileSync(R+f,'utf8'));
delete globalThis.window;
const createHandler=vm.runInThisContext('(function(){'+fs.readFileSync(R+'server/handler.js','utf8')+';return createHandler;})()');
const pg=new PGlite();await pg.exec("create role anon; create role authenticated;");await pg.exec(fs.readFileSync(R+'supabase/sql/01_culture_lab_schema.sql','utf8'));
const T={};const invited=[];let pay=[];
const h=createHandler({factory:globalThis.CLStore,env:{ownerEmail:'owner@test.dev',ownerName:'Test Owner',portalUrl:'https://x.test',anonKey:'anon',cronSecret:'test-cron-secret-0123456789abcdef'},db:{tx:(fn)=>pg.transaction((tx)=>fn((t,p)=>tx.query(t,p).then(r=>r.rows)))},auth:{getUser:async(t)=>T[t]||null,invite:async(e)=>invited.push(e)},storage:{signUpload:async(b,p)=>'https://s/'+b+'/'+p,signRead:async(b,p)=>'https://r/'+b+'/'+p,publicUrl:(b,p)=>'https://p/'+b+'/'+p},stripe:{checkout:async(o)=>{pay.push(o);return 'https://stripe.test/c'},verify:async(raw,sig)=>{if(sig!=='good')throw new Error('bad');return JSON.parse(raw)}}});
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:(fail++,console.log('FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,300)))};
let ip=0;const call=async(token,body,hdr={})=>h({rawBody:JSON.stringify(body),headers:{authorization:token?'Bearer '+token:'', 'x-forwarded-for':hdr.ip||'9.9.9.'+(++ip)}});
const cmd=(t,c,...args)=>call(t,{action:'cmd',cmd:c,args,ids:[]});
const must=async(n,p)=>{const r=await p;ok(n,r.status===200,r.body);return r.body};const deny=async(n,p,st)=>{const r=await p;ok(n,r.status===(st||422)||(!st&&r.status>=400&&r.status<500),r);return r};
T.owner={email:'owner@test.dev',aal:'aal2'};T.owner1={email:'owner@test.dev',aal:'aal1'};T.stranger={email:'x@evil.dev',aal:'aal2'};
for(const [k,e] of [['prod1','p1@t.dev'],['prod2','p2@t.dev'],['ed1','e1@t.dev'],['ed2','e2@t.dev'],['net','n@t.dev'],['coord','c@t.dev'],['web','w@t.dev'],['content','ce@t.dev']])T[k]={email:e,aal:'aal2'};
// access
await deny('no token',call('',{action:'session'}),401);await deny('stranger',call('stranger',{action:'session'}),403);const m=await call('owner1',{action:'session'});ok('mfa enforced',m.status===403&&m.body.code==='mfa_required');
let s=await must('owner session',call('owner',{action:'session'}));ok('owner is super admin',s.snapshot.users[0].role==='super_admin');
const cnt=async(t)=>Number((await pg.query('select count(*)::int n from culture_lab.'+t)).rows[0].n);
ok('fresh: only the owner exists',await cnt('staff')===1&&(await pg.query('select name,role,mfa from culture_lab.staff')).rows[0].name==='Test Owner');
ok('fresh: no sample records',(await Promise.all(['productions','teams','people','leads','stories','events','tasks','notes','deliveries'].map(cnt))).every(n=>n===0));
ok('fresh: settings saved',(await pg.query("select key from culture_lab.settings order by key")).rows.map(r=>r.key).join()==='automations,availability,integrations,roles,schedule,seededAt,seq,version');
const anonSchema=await pg.query("set role anon").then(()=>pg.query('select * from culture_lab.settings')).then(()=>'allowed',()=>'denied');await pg.query('reset role');ok('anon cannot read settings',anonSchema==='denied');
const authSchema=await pg.query("set role authenticated").then(()=>pg.query('select * from culture_lab.staff')).then(()=>'allowed',()=>'denied');await pg.query('reset role');ok('signed-in browser role cannot read staff',authSchema==='denied');
const anonRead=await pg.query("set role anon").then(()=>pg.query('select * from culture_lab.stories')).then(()=>'allowed',()=>'denied');await pg.query('reset role');ok('anon cannot read tables',anonRead==='denied');
// setup
const p=(await must('production',cmd('owner','saveProduction',null,{title:'Test Show',format:'Reality Series',code:'TEST',status:'current',logline:'L',synopsis:'S',image:'',minAge:18,publicApply:true,eligibility:[],questions:[]},{teams:2,deliveries:2,slots:2,target:4}))).snapshot.productions[0];
const teams=(await must('s',call('owner',{action:'session'}))).snapshot.teams;ok('teams created',teams.length===2);
const inv=async(n,e,role,teamId)=>must('invite '+n,cmd('owner','inviteStaff',{name:n,email:e,role,teamId,mfa:false}));
await inv('P One','p1@t.dev','producer',teams[0].id);await inv('P Two','p2@t.dev','producer',teams[1].id);await inv('E One','e1@t.dev','editor');await inv('E Two','e2@t.dev','editor');await inv('Net','n@t.dev','network_reviewer');await inv('Coord','c@t.dev','coordinator');ok('invites sent',invited.length===6);
await deny('producer cannot invite',cmd('prod1','inviteStaff',{name:'Z',email:'z@t.dev',role:'super_admin'}));await deny('unknown command',cmd('owner','recordPayment','x',1,'y'),400);await deny('internal fn blocked',cmd('owner','snapshot'),400);
// lead intake
await deny('coordinator or stranger cannot add lead',cmd('stranger','addLeads',[{name:'X'}]),403);await must('add lead',cmd('owner','addLeads',[{prodId:p.id,name:'Ada Real',email:'ada@t.dev',phone:'5550101234',dob:'1990-01-01',story:'Mine'}],'Referral'));
let snap=(await must('s',call('owner',{action:'session'}))).snapshot;ok('lead saved',snap.leads.length===1);const L=snap.leads[0];
const U=Object.fromEntries(snap.users.map(u=>[u.email,u.id]));
await deny('convert before age check',cmd('prod1','convertLead',L.id,{title:'Story',seasonId:'s1',teamId:teams[0].id,delivery:1}));await must('verify',cmd('prod1','verifyAge',L.id));
const sid=(await must('convert',cmd('prod1','convertLead',L.id,{title:'Real Story',seasonId:'s1',teamId:teams[0].id,delivery:1}))).snapshot.stories[0].id;
const A=(t,n,pl)=>cmd(t,'act',sid,n,pl||{});
// isolation
const p2=(await must('p2',call('prod2',{action:'session'}))).snapshot;ok('other team cannot see story',!p2.stories.some(x=>x.id===sid));await deny('other team cannot act',A('prod2','outreach',{channel:'Phone',note:'x'}));await deny('unassigned editor',A('ed1','outreach',{channel:'Phone',note:'x'}));
// workflow
await deny('bg before screening',A('prod1','saveBackground',{fields:{legalName:'A',phone:'1',email:'a',address:'b',work:'c',priorTv:'d'},complete:true}));await must('consent',A('prod1','requestScreening',{consent:true}));await deny('producer no screening review',A('prod1','recordScreening',{status:'clear'}));await must('clear',A('owner','recordScreening',{status:'clear'}));await must('bg',A('prod1','saveBackground',{fields:{legalName:'A',phone:'1',email:'a',address:'b',work:'c',priorTv:'d'},complete:true}));await must('pitch',A('prod1','savePitch',{fields:{synopsis:'Great'},submit:true}));
// concurrency on one slot
snap=(await must('s',call('owner',{action:'session'}))).snapshot;const engine=globalThis.CLStore({mode:'server',state:JSON.parse(JSON.stringify(snap)),userId:snap._me,blob:{}});const slot=engine.pitchSlots(21)[0];ok('slot exists',!!slot);
const both=await Promise.all([cmd('prod1','bookPitch',sid,slot),cmd('prod1','bookPitch',sid,slot)]);ok('double booking race: exactly one wins',both.filter(r=>r.status===200).length===1,both.map(r=>r.status));
await deny('producer cannot decide',A('prod1','decidePitch',{decision:'approved'}));await must('approve',A('owner','decidePitch',{decision:'approved'}));
snap=(await must('s',call('prod1',{action:'session'}))).snapshot;const person=snap.stories[0].participants[0].personId;const st=new Date(Date.now()+6*864e5).toISOString(),en=new Date(Date.now()+6*864e5+36e5).toISOString();await must('iv',A('prod1','scheduleInterview',{personId:person,start:st,end:en}));snap=(await must('s',call('prod1',{action:'session'}))).snapshot;await must('confirm',A('prod1','confirmInterview',{id:snap.stories[0].interviews[0].id}));await must('media',A('prod1','addMedia',{name:'clip.mov',cat:'Raw Footage',blob:'sb:staff/x/clip.mov'}));await must('handoff',A('prod1','handoff',{editorId:U['e1@t.dev']}));
await deny('other editor blocked',A('ed2','uploadCut',{file:'x.mp4'}));await must('cut',A('ed1','uploadCut',{file:'v1.mp4',duration:300}));
const ed=(await must('e',call('ed1',{action:'session'}))).snapshot,es=ed.stories[0];ok('editor gets no screening or background',!es.screening.provider&&es.background.legalName===undefined&&ed.leads.length===0&&!ed.people.some(x=>x.email));ok('editor no staff emails',!ed.users.some(u=>u.email&&u.id!==ed._me));
await must('prod ok',A('prod1','producerDecision',{approve:true}));await deny('producer no final',A('prod1','directorDecision',{approve:true}));await must('director',A('owner','directorDecision',{approve:true}));await must('onesheet',A('owner','approveOneSheet',{}));
const d=(await must('nd',cmd('coord','createDelivery',{prodId:p.id,seasonId:'s1'}))).snapshot.deliveries[0];await must('pick',cmd('coord','deliveryToggle',d.id,sid));await deny('send unapproved',cmd('coord','deliverySend',d.id));await deny('coord no approve',cmd('coord','deliveryApprove',d.id));await must('approve',cmd('owner','deliveryApprove',d.id));
const pre=(await must('n',call('net',{action:'session'}))).snapshot;ok('network sees nothing before send',pre.stories.length===0&&pre.deliveries.length===0);await deny('network note before send',cmd('net','networkNote',sid,'x'));await must('send',cmd('coord','deliverySend',d.id));
const n=(await must('n',call('net',{action:'session'}))).snapshot,ns=n.stories[0];ok('network package only',n.stories.length===1&&ns.oneSheet&&ns.interviews.length===0&&ns.media.length===0&&ns.cuts.length===0&&n.people.length===0&&n.leads.length===0&&!ns.screening.provider&&n.teams.length===0&&n.registrations===undefined&&n.site===undefined,ns);
await must('decide',cmd('net','networkDecide',sid,'yes'));await deny('network cannot edit',A('net','outreach',{channel:'Phone',note:'x'}));ok('decision persisted',(await must('o',call('owner',{action:'session'}))).snapshot.stories[0].network.decision==='yes');
// database tables
const row=(await pg.query('select stage,production_id,producer_id,network_decision from culture_lab.stories where id=$1',[sid])).rows[0];ok('story columns filled',row&&row.production_id===p.id&&row.network_decision==='yes'&&row.stage,row);
const board=(await pg.query('select title,production,producer from culture_lab.story_board where id=$1',[sid])).rows[0];ok('story board report',board&&board.title==='Real Story'&&board.production==='Test Show'&&board.producer==='P One',board);
const lp=(await pg.query('select name,production,status from culture_lab.lead_pipeline')).rows;ok('lead pipeline report',lp.length===1&&lp[0].name==='Ada Real'&&lp[0].production==='Test Show',lp);
const badFk=await pg.transaction(async(tx)=>{await tx.query('insert into culture_lab.leads (id,data) values ($1,$2::jsonb)',['bad',JSON.stringify({prodId:'nope',personId:'nope'})]);}).then(()=>'saved',()=>'refused');ok('database refuses a lead with no production',badFk==='refused');
ok('change log records saves',Number((await pg.query('select count(*)::int n from culture_lab.change_log')).rows[0].n)>10);
ok('tasks have due dates',Number((await pg.query('select count(*)::int n from culture_lab.tasks where due_at is not null')).rows[0].n)>=0);
const tl=(await pg.query("select count(*)::int n from culture_lab.events where starts_at is not null and ends_at>starts_at")).rows[0].n;ok('calendar times stored',tl>=1,tl);
// files
await must('owner file',call('owner',{action:'fileUrl',key:'sb:staff/x/clip.mov'}));await deny('other team file',call('prod2',{action:'fileUrl',key:'sb:staff/x/clip.mov'}),403);await deny('anon private file',call('',{action:'fileUrl',key:'sb:staff/x/clip.mov'}),401);
// no public surface
for(const [n,b] of [['public view',{action:'public'}],['public command',{action:'publicCmd',cmd:'submitApplication',args:{}}],['public upload',{action:'publicUpload',kind:'headshot',type:'image/png',name:'a.png',size:10}],['payment link',{action:'balanceLink',regId:'x'}]]){const r=await call('',b);ok(n+' removed',r.status===400&&r.body.code==='bad_request',r);const o=await call('owner',b);ok(n+' removed for staff',o.status===400,o);}
const wh=await h({webhook:'stripe',rawBody:'{}',headers:{'stripe-signature':'good'}});ok('payment webhook removed',wh.status===400,wh);
for(const c of ['saveDraft','publish','rollback','schedulePublish','requestApproval','addMediaItems','saveWorkshop','setSubmissionStatus','setRegistrationStatus'])await deny('website command off: '+c,cmd('owner',c,{}),400);
await deny('website roles gone',cmd('owner','inviteStaff',{name:'W',email:'w2@t.dev',role:'website_admin'}));const upS=await must('staff upload stays private',call('owner',{action:'upload',scope:'site',name:'../../a.png',size:2048}));ok('site scope ignored, safe private path',/^sb:staff\/[^/]+\/[a-f0-9]{24}\/[a-z0-9.-]+$/.test(upS.key)&&upS.url.includes('culture-lab-files'),upS);await deny('anon upload',call('',{action:'upload',name:'a.png',size:2048}),401);await deny('anon cannot read public key',call('',{action:'fileUrl',key:'sb:site/a.png'}),401);
// lab assistant
{const base={factory:globalThis.CLStore,env:{ownerEmail:'owner@test.dev',ownerName:'Test Owner',portalUrl:'https://x.test',anonKey:'anon',cronSecret:'test-cron-secret-0123456789abcdef'},db:{tx:(fn)=>pg.transaction((tx)=>fn((t,p)=>tx.query(t,p).then(r=>r.rows)))},auth:{getUser:async(t)=>T[t]||null,invite:async()=>{}},storage:{}};
let next=null,seen=null;const hAI=createHandler(Object.assign({},base,{ai:async(a)=>{seen=a;if(next instanceof Error)throw next;return next;}}));
const ask=(hh,tok,body)=>hh({rawBody:JSON.stringify(Object.assign({action:'assist'},body)),headers:{authorization:'Bearer '+tok,'x-forwarded-for':'7.7.7.'+Math.random()}});
let r=await ask(h,'owner',{mode:'capture',text:'Met with the team. Sam will send the release form tomorrow. Interview call on Friday at 3pm.'});
ok('basic assist works without Claude',r.status===200&&r.body.engine==='basic'&&/Basic mode/.test(r.body.notice),r.body);
ok('basic finds a task and an event',r.body.proposal.tasks.length>=1&&r.body.proposal.events.length===1&&/T\d\d:00:00.000Z$/.test(r.body.proposal.events[0].start),r.body.proposal);
r=await ask(h,'owner',{mode:'ask',text:'What is on my day?'});ok('basic ask answers',r.status===200&&/Today you have/.test(r.body.proposal.answer),r.body);
r=await ask(h,'owner',{mode:'capture',text:'  '});ok('empty text refused',r.status===400);
r=await ask(h,'net',{mode:'capture',text:'hello'});ok('network reviewer has no assistant',r.status===403,r);
r=await ask(h,'',{mode:'capture',text:'hello'});ok('assistant needs sign-in',r.status===401);
next={summary:'S',answer:'',note:{title:'T',body:'B',tags:['Pitch Prep','x y']},tasks:[{title:'Call Maya',due:'2026-12-01',assigneeId:'nobody',storyId:'nope',why:'w'},{title:'',due:'',assigneeId:'',storyId:'',why:''}],events:[{title:'Prep',type:'pitch',start:'2026-12-01T15:00',end:'',attendeeIds:['ghost',U['p1@t.dev']],storyId:sid,notes:'n'}]};
r=await ask(hAI,'owner',{mode:'capture',text:'transcript'});const P=r.body.proposal;
ok('claude path used',r.status===200&&r.body.engine==='claude'&&!r.body.notice,r.body);
ok('context passed to assistant',seen&&seen.mode==='capture'&&seen.context.me.id==='u_owner'&&seen.context.tz&&Array.isArray(seen.context.staff)&&seen.context.stories.some(x=>x.id===sid));
ok('unknown people and stories dropped',P.tasks.length===1&&P.tasks[0].assignee==='u_owner'&&P.tasks[0].storyId===null,P.tasks);
ok('date-only due read at 5 PM local',P.tasks[0].due==='2026-12-02T01:00:00.000Z',P.tasks[0]);
ok('pitch type downgraded, local time converted, 30 min default',P.events[0].type==='team'&&P.events[0].start==='2026-12-01T23:00:00.000Z'&&P.events[0].end==='2026-12-01T23:30:00.000Z'&&P.events[0].attendees.length===1&&P.events[0].storyId===sid,P.events);
ok('tags cleaned',P.note.tags.join()==='pitch-prep,x-y',P.note);
next={summary:'',answer:'',note:{title:'',body:'',tags:[]},tasks:[{title:'X',due:'',assigneeId:'u_owner',storyId:'',why:''}],events:[]};
r=await ask(hAI,'prod1',{mode:'capture',text:'t'});ok('producer cannot assign to others via assistant',r.body.proposal.tasks[0].assignee===U['p1@t.dev'],r.body);
next={summary:'',answer:'',note:{title:'',body:'',tags:[]},tasks:[],events:[{title:'E',type:'team',start:'2026-12-01T10:00',end:'',attendeeIds:[],storyId:'',notes:''}]};
r=await ask(hAI,'ed1',{mode:'capture',text:'t'});ok('editor gets no calendar items',r.status===200&&r.body.proposal.events.length===0,r.body);
next=new Error('network down');r=await ask(hAI,'owner',{mode:'capture',text:'Sam will call the network tomorrow.'});ok('falls back to basic if Claude fails',r.status===200&&r.body.engine==='basic'&&/could not reach/.test(r.body.notice),r.body);
next=Object.assign(new Error('Lab Assistant cannot help with that text.'),{friendly:true});r=await ask(hAI,'owner',{mode:'capture',text:'x'});ok('refusal shown to person',r.status===422&&/cannot help/.test(r.body.error),r.body);
// progress
next={summary:'',answer:'Briefing',note:{title:'',body:'',tags:[]},tasks:[],events:[]};
r=await ask(hAI,'owner',{mode:'ask',text:'How are we doing?'});const PG=seen.context.progress;
ok('owner progress covers whole team',PG&&PG.scope==='Whole team'&&PG.stories.active>=1&&Array.isArray(PG.workload)&&PG.leads&&typeof PG.tasks.overdue==='number'&&PG.productions.some(x=>x.title==='Test Show'),PG);
ok('progress answer returned',r.body.proposal.answer==='Briefing',r.body);
r=await ask(hAI,'prod1',{mode:'ask',text:'How are we doing?'});const PP=seen.context.progress;
ok('producer progress limited to own work',PP.scope==='Your stories and tasks'&&!PP.workload,PP);
r=await ask(hAI,'ed1',{mode:'ask',text:'progress'});ok('editor progress has no leads or deliveries',!seen.context.progress.leads&&!seen.context.progress.deliveries&&!seen.context.progress.workload,seen.context.progress);
await pg.query("update culture_lab.stories set data=jsonb_set(jsonb_set(data,'{updated}',to_jsonb('2026-01-01T00:00:00.000Z'::text)),'{network,decision}','null'::jsonb) where id=$1",[sid]);
r=await ask(h,'owner',{mode:'ask',text:'Give me a progress report'});
ok('basic progress report',r.status===200&&/^Whole team: \d+ active stor/.test(r.body.proposal.answer)&&/Tasks: \d+ open/.test(r.body.proposal.answer)&&/Scouting:/.test(r.body.proposal.answer),r.body.proposal);
ok('stalled story flagged',/Needs attention: 1 story/.test(r.body.proposal.answer),r.body.proposal.answer);
r=await ask(h,'owner',{mode:'ask',text:"What's on my plate today?"});ok('day questions still answered about the day',/Today you have/.test(r.body.proposal.answer),r.body.proposal);
// saving approved items
const evStart=new Date(Date.now()+20*864e5);evStart.setUTCHours(18,0,0,0);const evEnd=new Date(evStart.getTime()+18e5);
const nt0=await cnt('tasks'),ne0=await cnt('events'),nn0=await cnt('notes');
await must('save capture',cmd('owner','saveCapture',{note:{text:'Meeting notes',tags:['casting'],storyId:sid},tasks:[{title:'Send release',due:evStart.toISOString(),assignee:U['p1@t.dev'],storyId:sid}],events:[{title:'Follow-up',type:'followup',start:evStart.toISOString(),end:evEnd.toISOString(),attendees:[U['p1@t.dev']]}]}));
ok('capture saved one of each',await cnt('tasks')===nt0+1&&await cnt('events')===ne0+1&&await cnt('notes')===nn0+1);
const tk=(await pg.query("select data from culture_lab.tasks where data->>'source'='Assistant'")).rows;ok('task marked from assistant and linked',tk.length===1&&tk[0].data.storyId===sid&&tk[0].data.assignee===U['p1@t.dev'],tk);
const nr=(await pg.query("select data from culture_lab.notes where data->>'text'='Meeting notes'")).rows[0];ok('note tagged and linked',nr&&nr.data.tags.includes('assistant')&&nr.data.links[0].id===sid,nr);
const ev=(await pg.query("select data from culture_lab.events where data->>'title'='Follow-up'")).rows[0];ok('owner added to own event',ev&&ev.data.attendees.includes('u_owner')&&ev.data.attendees.includes(U['p1@t.dev']),ev);
await deny('producer cannot assign others',cmd('prod1','saveCapture',{tasks:[{title:'x',assignee:'u_owner'}]}));
await deny('editor cannot add events',cmd('ed1','saveCapture',{events:[{title:'x',type:'team',start:evStart.toISOString(),end:evEnd.toISOString()}]}));
await deny('no pitch from assistant',cmd('owner','saveCapture',{events:[{title:'x',type:'pitch',start:evStart.toISOString(),end:evEnd.toISOString()}]}));
await deny('empty capture refused',cmd('owner','saveCapture',{}));
await deny('network reviewer cannot save',cmd('net','saveCapture',{note:{text:'x'}}));
const ntA=await cnt('tasks');await deny('clash rolls back whole capture',cmd('owner','saveCapture',{tasks:[{title:'should not stay'}],events:[{title:'Clash',type:'team',start:evStart.toISOString(),end:evEnd.toISOString()}]}));ok('nothing saved when one item fails',await cnt('tasks')===ntA);
// daysilk
const F1=new Date(evStart.getTime()+2*36e5).toISOString(),F2=new Date(evStart.getTime()+3*36e5).toISOString();
await must('owner blocks focus time',cmd('owner','saveFocus',{title:'Deep work',start:F1,end:F2}));
const fq=async()=>(await pg.query("select data from culture_lab.events where data->>'type'='focus' order by data->>'start'")).rows.map(r=>r.data);
let fb=await fq();ok('focus block saved for owner only',fb.length===1&&fb[0].attendees.join()==='u_owner'&&fb[0].by==='u_owner',fb);
await deny('focus cannot overlap a meeting',cmd('owner','saveFocus',{title:'x',start:evStart.toISOString(),end:evEnd.toISOString()}));
await must('editor can block own focus time',cmd('ed1','saveFocus',{title:'Cut notes',start:F1,end:F2}));
await deny('editor still cannot add meetings',cmd('ed1','saveEvent',{type:'team',title:'x',start:F1,end:F2,attendees:[]}));
fb=await fq();const ownerBlock=fb.find(x=>x.by==='u_owner');
await deny('cannot move someone else\'s block',cmd('prod1','saveFocus',{id:ownerBlock.id,start:F1,end:F2}));
await deny('cannot remove someone else\'s block',cmd('prod1','deleteFocus',ownerBlock.id));
await must('owner moves own block',cmd('owner','saveFocus',{id:ownerBlock.id,title:'Deep work',start:new Date(evStart.getTime()+4*36e5).toISOString(),end:new Date(evStart.getTime()+5*36e5).toISOString()}));
ok('block moved, not copied',(await fq()).filter(x=>x.by==='u_owner').length===1);
await must('owner removes own block',cmd('owner','deleteFocus',ownerBlock.id));ok('block removed',(await fq()).filter(x=>x.by==='u_owner').length===0);
await must('editor saves a focus block from the assistant',cmd('ed1','saveCapture',{events:[{title:'Edit block',type:'focus',start:new Date(evStart.getTime()+6*36e5).toISOString(),end:new Date(evStart.getTime()+7*36e5).toISOString()}]}));
const p1task=(await pg.query("select data from culture_lab.tasks where data->>'source'='Assistant'")).rows[0].data;
await deny('cannot block time for someone else\'s task',cmd('ed1','saveFocus',{taskId:p1task.id,start:F1,end:F2}));
await deny('cannot move someone else\'s task to tomorrow',cmd('ed1','dayWrap',{day:'2026-12-01',carry:[p1task.id]}));
await deny('empty wrap refused',cmd('prod1','dayWrap',{day:'2026-12-01',carry:[]}));
await must('producer wraps up the day',cmd('prod1','dayWrap',{day:'2026-12-01',carry:[p1task.id],text:'Day wrap-up'}));
const moved=(await pg.query("select data from culture_lab.tasks where data->>'id'=$1",[p1task.id])).rows[0].data;ok('task moved to tomorrow 5 PM local',moved.due==='2026-12-03T01:00:00.000Z',moved);
const wn=(await pg.query("select data from culture_lab.notes where data->>'text'='Day wrap-up'")).rows[0];ok('wrap note tagged',wn&&wn.data.tags.includes('daysilk'),wn);
r=await ask(h,'owner',{mode:'plan',text:'Plan my day'});ok('basic plan answers with focus blocks only',r.status===200&&r.body.proposal.answer&&r.body.proposal.events.every(e=>e.type==='focus'),r.body);
next={summary:'',answer:'- 10:00 Cut notes',note:{title:'',body:'',tags:[]},tasks:[],events:[{title:'Cut notes',type:'focus',start:'2026-12-01T10:00',end:'2026-12-01T11:00',attendeeIds:['u_owner'],storyId:'',taskId:'bogus',notes:''},{title:'Sync',type:'team',start:'2026-12-01T12:00',end:'',attendeeIds:[],storyId:'',taskId:'',notes:''}]};
r=await ask(hAI,'ed1',{mode:'plan',text:'Plan my day'});const PE=r.body.proposal.events;
ok('plan mode reaches Claude',seen.mode==='plan');
// smart notes
r=await ask(h,'owner',{mode:'note',text:'Spoke with Maya today about the release. #release-forms'});ok('basic smart note picks type and keeps tags',r.body.proposal.note.kind==='call'&&r.body.proposal.note.tags.includes('release-forms'),r.body.proposal.note);
next={summary:'',answer:'',note:{title:'T',body:'B',kind:'weird',tags:[]},tasks:[],events:[]};r=await ask(hAI,'owner',{mode:'note',text:'x'});ok('unknown note type becomes note',r.body.proposal.note.kind==='note',r.body.proposal.note);
await must('smart note saved with type and mention',cmd('owner','saveCapture',{note:{text:'Smart one',kind:'decision',mentions:[U['p1@t.dev'],'ghost'],tags:['x']}}));
const sn=(await pg.query("select data from culture_lab.notes where data->>'text'='Smart one'")).rows[0].data;ok('smart note keeps type and real mentions only',sn.kind==='decision'&&sn.mentions.join()===U['p1@t.dev'],sn);
const nf=(await pg.query("select data from culture_lab.notifications where data->>'to'=$1 and data->>'text' like '%mentioned you%'",[U['p1@t.dev']])).rows;ok('mentioned teammate notified',nf.length>=1,nf.length);
// rules engine
{const tick=async(who='owner')=>{await pg.query("update culture_lab.settings set value='{\"at\":\"2020-01-01T00:00:00Z\"}'::jsonb where key='schedule'");return must('session '+who,call(who,{action:'session'}));};
const notes=async(uid,like)=>(await pg.query("select data from culture_lab.notifications where data->>'to'=$1 and data->>'text' like $2",[uid,like])).rows.length;
const tget=async(id)=>(await pg.query("select data from culture_lab.tasks where id=$1",[id])).rows[0].data;
const mk=async(who,d)=>(await must('create task '+d.title,cmd(who,'createTask',d))).result.id;
const soon=await mk('owner',{title:'Send call sheet',priority:'high',due:new Date(Date.now()+2*36e5).toISOString()});
ok('task keeps priority',(await tget(soon)).priority==='high');
await tick();ok('due-soon reminder sent',await notes('u_owner','Due in 2 hours: Send call sheet')===1);
await tick();ok('reminder not repeated',await notes('u_owner','Due in 2 hours: Send call sheet')===1);
const late=await mk('prod1',{title:'Late release form',due:new Date(Date.now()-2*864e5).toISOString()});
await tick();ok('owner of overdue task told',await notes(U['p1@t.dev'],'Overdue 2 days: Late release form')===1);ok('overdue escalated to leads',await notes('u_owner','Overdue 2 days: Late release form (P One)')===1);
await tick();ok('escalation not repeated',await notes('u_owner','Overdue 2 days: Late release form%')===1);
ok('stalled story flagged to producer',(await pg.query("select 1 from culture_lab.notifications where data->>'text' like 'Stalled %'")).rows.length>=1);
await must('turn off due-soon rule',cmd('owner','setAutomation','Task due soon',false));const quiet=await mk('owner',{title:'Quiet task',due:new Date(Date.now()+36e5).toISOString()});await tick();ok('rule off means no reminder',await notes('u_owner','Due in % Quiet task')===0);await must('rule back on',cmd('owner','setAutomation','Task due soon',true));
await deny('timing must be 1 or more',cmd('owner','setRuleTiming','Task overdue',{hours:0}));await deny('producer cannot change timing',cmd('prod1','setRuleTiming','Task overdue',{hours:48}));await must('owner sets timing',cmd('owner','setRuleTiming','Task overdue',{hours:48}));
const rs=(await pg.query("select value from culture_lab.settings where key='automations'")).rows[0].value;ok('new rules added with timing',rs.find(r=>r.k==='Task overdue').cfg.hours===48&&rs.some(r=>r.k==='Repeating meetings'),rs.map(r=>r.k));
// dependencies
const A=await mk('owner',{title:'Lock location'}),B=await mk('owner',{title:'Send call times',blockedBy:[A]});
await deny('cannot finish a task that is waiting',cmd('owner','completeTask',B));
await must('finish the blocker',cmd('owner','completeTask',A));ok('owner told the next task can start',await notes('u_owner','Ready to start: Send call times')===1);
await must('now it can be finished',cmd('owner','completeTask',B));
const C=await mk('owner',{title:'C'}),D=await mk('owner',{title:'D',blockedBy:[C]});await deny('no circular waiting',cmd('owner','editTask',C,{blockedBy:[D]}));
await deny('producer cannot assign to others',cmd('prod1','createTask',{title:'x',assignee:'u_owner'}));await deny('producer cannot edit others\' tasks',cmd('prod1','editTask',C,{title:'y'}));
await must('lead reassigns',cmd('owner','editTask',C,{assignee:U['p1@t.dev'],priority:'low'}));const cc=await tget(C);ok('reassigned with priority',cc.assignee===U['p1@t.dev']&&cc.priority==='low');
// prep tasks follow the meeting
const iv=new Date(Date.now()+5*864e5);iv.setUTCHours(15,0,0,0);const ivE=new Date(iv.getTime()+36e5);
await must('schedule interview',cmd('owner','saveEvent',{type:'interview',title:'Interview prep test',start:iv.toISOString(),end:ivE.toISOString(),attendees:['u_owner'],storyId:sid}));
const ev1=(await pg.query("select data from culture_lab.events where data->>'title'='Interview prep test'")).rows[0].data;
let prep=(await pg.query("select data from culture_lab.tasks where data->>'eventId'=$1",[ev1.id])).rows.map(r=>r.data);
ok('two prep tasks created, high priority',prep.length===2&&prep.every(t=>t.priority==='high'&&t.status==='open'),prep);
const before=prep.map(t=>new Date(t.due).getTime()).sort();
await must('move interview a day',cmd('owner','saveEvent',Object.assign({},ev1,{start:new Date(iv.getTime()+864e5).toISOString(),end:new Date(ivE.getTime()+864e5).toISOString()})));
const after=(await pg.query("select data from culture_lab.tasks where data->>'eventId'=$1",[ev1.id])).rows.map(r=>new Date(r.data.due).getTime()).sort();
ok('prep tasks moved with the meeting',after.every((t,i)=>t-before[i]===864e5),{before,after});
await must('cancel interview',cmd('owner','deleteEvent',ev1.id));ok('prep tasks cancelled with it',(await pg.query("select data from culture_lab.tasks where data->>'eventId'=$1",[ev1.id])).rows.every(r=>r.data.status==='cancelled'));
// repeating meetings
const wk=new Date(Date.now()+3*864e5);wk.setUTCHours(17,0,0,0);
await must('weekly meeting',cmd('owner','saveEvent',{type:'team',title:'Weekly casting sync',start:wk.toISOString(),end:new Date(wk.getTime()+18e5).toISOString(),attendees:['u_owner'],repeat:{freq:'weekly'}}));
const ser=(await pg.query("select data from culture_lab.events where data->>'title'='Weekly casting sync' order by data->>'start'")).rows.map(r=>r.data);
ok('next weekly dates added',ser.length>=4&&ser.slice(1).every((e,i)=>new Date(e.start)-new Date(ser[i].start)===7*864e5&&e.seriesId===ser[0].id),ser.map(e=>e.start));
await must('stop repeating',cmd('owner','stopRepeat',ser[2].id));ok('future dates removed',(await pg.query("select 1 from culture_lab.events where data->>'title'='Weekly casting sync'")).rows.length===1);
// approvals reach the assistant
next={summary:'',answer:'ok',note:{title:'',body:'',kind:'note',tags:[]},tasks:[],events:[]};await ask(hAI,'owner',{mode:'ask',text:'What needs my approval?'});ok('approvals and task priority in assistant context',Array.isArray(seen.context.approvals)&&typeof seen.context.progress.approvals==='number'&&seen.context.tasks.every(t=>t.priority),seen.context.approvals);
}
ok('editor plan keeps focus only, unknown task dropped',PE.length===1&&PE[0].type==='focus'&&PE[0].taskId===null&&PE[0].attendees.length===0,PE);
}
// scheduled rules and file policy
{const tk=(sec)=>h({rawBody:JSON.stringify({action:'tick'}),headers:sec?{'x-cron-secret':sec}:{}});
let r=await tk();ok('scheduled run needs the secret',r.status===401,r);r=await tk('wrong-secret-0123456789abcdefgh');ok('wrong secret refused',r.status===401,r);
const lateT=(await must('overdue for cron',cmd('owner','createTask',{title:'Cron overdue check',due:new Date(Date.now()-3*864e5).toISOString()}))).result.id;
r=await tk('test-cron-secret-0123456789abcdef');ok('scheduled run works with the secret',r.status===200&&r.body.ok===true&&r.body.ran>=1,r.body);
ok('cron escalated without anyone signed in',(await pg.query("select 1 from culture_lab.notifications where data->>'text' like 'Overdue 3 days: Cron overdue check%'")).rows.length>=1);
const nBefore=(await pg.query("select 1 from culture_lab.notifications where data->>'text' like 'Overdue 3 days: Cron overdue check%'")).rows.length;r=await tk('test-cron-secret-0123456789abcdef');ok('second run sends nothing new',r.status===200&&(await pg.query("select 1 from culture_lab.notifications where data->>'text' like 'Overdue 3 days: Cron overdue check%'")).rows.length===nBefore);
ok('scheduled run logged as system',(await pg.query("select 1 from culture_lab.change_log where actor='system' and command='Scheduled rules'")).rows.length>=1);
const up=(name,size)=>call('owner',{action:'upload',name,size});
r=await up('evil.exe',1000);ok('program files refused',r.status===422&&/not allowed/.test(r.body.error),r.body);
r=await up('page.html',1000);ok('web pages refused',r.status===422,r.body);
r=await up('photo.png',60*1048576);ok('oversized image refused',r.status===422&&/Image files can be up to 50 MB/.test(r.body.error),r.body);
r=await up('cut-v2.MOV',900*1048576);ok('large video allowed with its type',r.status===200&&r.body.mime==='video/quicktime',r.body);
r=await up('release.pdf',0);ok('empty file refused',r.status===422,r.body);
}
// edit conflicts
{const rev=async()=>Number((await pg.query("select data->>'rev' r from culture_lab.stories where id=$1",[sid])).rows[0].r||0);
const r0=await rev();await must('save with current revision',cmd('owner','act',sid,'saveBackground',{fields:{work:'First edit'},_seen:r0}));
const r1=await rev();ok('revision goes up on change',r1===r0+1,{r0,r1});
const stale=await cmd('prod1','act',sid,'saveBackground',{fields:{work:'Stale edit'},_seen:r0});ok('stale save refused, nothing overwritten',stale.status===422&&/Someone else updated this story/.test(stale.body.error),stale.body);
const bg=(await pg.query("select data->'background'->>'work' w from culture_lab.stories where id=$1",[sid])).rows[0].w;ok('first edit kept',bg==='First edit',bg);
await must('save after reload works',cmd('owner','act',sid,'saveBackground',{fields:{work:'Second edit'},_seen:r1}));
await must('saves without a revision still work',cmd('owner','act',sid,'saveBackground',{fields:{work:'Third'}}));}
// revoke
await must('revoke',cmd('owner','setUserActive',U['p2@t.dev'],false));await deny('revoked user blocked',call('prod2',{action:'session'}),403);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
