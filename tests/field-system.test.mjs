import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {fieldWorkflow} from '../apps/web/lib/field-workflow.ts';
import {workspaceSectionAllowed,readWorkspaceRoute} from '../apps/web/lib/workspace-navigation.ts';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;
const {renderToStaticMarkup}=require('react-dom/server'),{act}=React;
const {default:Workflow}=await import('../apps/web/app/service-workflow.tsx');
const {default:Desk}=await import('../apps/web/app/command-center.tsx');
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const org=id(1),request={id:id(2),status:'submitted',revision:1,created_at:'2030-10-20T12:00:00Z',original_submission:{name:'Synthetic field customer',email:'test@example.invalid',phone:'5550100999',street:'100 Synthetic Street',city:'DeKalb',services:[{service:'Home',task:'Agreed furniture assembly'}],description:'Use side entrance. Preserve this full instruction.'},appointments:[]};
const visit={id:id(3),request_id:request.id,job_id:id(5),status:'reserved',revision:1,start_at:'2030-10-21T14:00:00Z',arrival_at:'2030-10-21T14:00:00Z',end_at:'2030-10-21T16:00:00Z',expires_at:null,replaces_id:null,customer_response:'confirmed'};
const quote={id:id(4),request_id:request.id,status:'accepted',current_version:1,quote_versions:[{version:1,scope:'Agreed furniture assembly',labor_cents:12000,duration_minutes:120}]},job={id:id(5),quote_id:quote.id,status:'approved',revision:1};
const invoice={id:id(6),job_id:job.id,number:2030100001,total_cents:12000,payments:[]};
const scheduled={...request,status:'quoted',appointments:[visit]},quiet=()=>{};
const html=(r=request,qs=[],js=[],is=[])=>new JSDOM(renderToStaticMarkup(React.createElement(Workflow,{organization:org,request:r,quotes:qs,jobs:js,invoices:is,timezone:'America/Chicago',canManage:true,canQuote:true,canWork:true,busy:false,onBusy:quiet,onReview:quiet,act:async()=>{},fieldAction:async()=>{},onChanged:quiet}))).window.document;
const actions=doc=>[...doc.querySelectorAll('[aria-label="Current field action"] button')].map(b=>b.textContent);
for(const status of ['submitted','reviewing','quoted'])test(status+' without confirmed visit exposes only confirmation and decline',()=>{
 const d=html({...request,status},[quote],[job],[]);assert.deepEqual(actions(d),['Confirm appointment','Decline request']);assert.equal(d.querySelector('.invoice-payment-panel'),null);assert.equal(d.querySelector('.mobile-work-record'),null);assert.equal(d.querySelector('.workflow-customer-note').open,true);
});
for(const status of ['declined','canceled'])test(status+' cannot reopen confirmation, timer, invoicing or receipts',()=>{
 const d=html({...request,status},[quote],[job],[invoice]);assert.deepEqual(actions(d),[]);assert.equal(d.querySelector('.invoice-payment-panel'),null);assert.equal(fieldWorkflow({...request,status},[quote],[job],[invoice]).kind,'closed');
});
test('saved appointment and exact accepted job agreement gate Start work',()=>{
 assert.equal(fieldWorkflow(scheduled,[quote],[job],[]).kind,'ready');assert.deepEqual(actions(html(scheduled,[quote],[job],[])),['Start work']);
 assert.equal(fieldWorkflow(scheduled,[],[job],[]).kind,'agreement');assert.deepEqual(actions(html(scheduled,[],[job],[])),[]);
 const tooShort={...scheduled,appointments:[{...visit,end_at:'2030-10-21T15:00:00Z'}]};assert.equal(fieldWorkflow(tooShort,[quote],[job],[]).kind,'confirm');assert.deepEqual(actions(html(tooShort,[quote],[job],[])),['Confirm appointment']);
});
test('working and paused jobs have one timer control and a direct finish action',()=>{
 for(const [status,label] of [['working','Pause timer'],['paused','Resume timer']]){const d=html(scheduled,[quote],[{...job,status}],[]);assert.deepEqual(actions(d),[label,'Finish work']);assert.equal(d.querySelector('.field-work-record').hidden,true);assert.equal(d.querySelector('[aria-label="Available service steps"]'),null);assert.equal(d.querySelectorAll('.field-job-service').length,1);}
});
test('completed work opens invoice review; issued partial and settled invoices expose receipts without work editor',()=>{
 const completed={...job,status:'completed'};let d=html(scheduled,[quote],[completed],[]);assert.equal(d.querySelector('.mobile-work-record').open,true);assert.equal(d.querySelector('.field-work-record').hidden,false);
 d=html(scheduled,[quote],[completed],[{...invoice,payments:[{cents:5000}]}]);assert.equal(d.querySelector('.mobile-work-record'),null);assert.equal(d.querySelectorAll('.invoice-payment-panel').length,1);assert.equal(d.querySelector('.workflow-closeout'),null);assert.equal(fieldWorkflow(scheduled,[quote],[completed],[{...invoice,payments:[{cents:5000}]}]).kind,'payment');
 assert.equal(fieldWorkflow(scheduled,[quote],[completed],[{...invoice,payments:[{cents:12000}]}]).kind,'settled');
});
test('a requested replacement preserves current appointment context and exposes explicit review',()=>{
 const replacement={...visit,id:id(8),status:'proposal',start_at:'2030-10-22T14:00:00Z',arrival_at:'2030-10-22T14:00:00Z',end_at:'2030-10-22T16:00:00Z',replaces_id:visit.id};const d=html({...scheduled,appointments:[replacement,visit]},[quote],[job],[]);
 assert.match(d.querySelector('.field-job-time').textContent,/Confirmed appointment/);assert.match(d.querySelector('.field-job-time').textContent,/Oct 21/);assert.ok([...d.querySelectorAll('button')].some(b=>b.textContent==='Review requested time change'));assert.match(d.querySelector('.field-job-details').textContent,/Original visit stays booked/);
});
test('multiple jobs finish one saved task at a time without declaring early closeout',()=>{
 const second={...job,id:id(7),status:'working'};assert.equal(fieldWorkflow(scheduled,[quote],[{...job,status:'completed'},second],[]).job.id,job.id);
 assert.equal(fieldWorkflow(scheduled,[quote],[{...job,status:'completed'},second],[invoice]).job.id,second.id);
});
test('Marketing is a scoped owner destination and cannot be opened by staff roles',()=>{
 assert.equal(workspaceSectionAllowed('Marketing','owner'),true);assert.equal(workspaceSectionAllowed('Marketing','admin'),true);
 for(const role of ['dispatcher','technician','bookkeeper']){assert.equal(workspaceSectionAllowed('Marketing',role),false);assert.notEqual(readWorkspaceRoute(new URL('https://example.invalid/owner?section=Marketing'),[{organization_id:org,role}]).section,'Marketing');}
});
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});
for(const key of ['window','document','HTMLElement'])globalThis[key]=dom.window[key];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client'),tick=()=>new Promise(r=>setImmediate(r));
async function mount(fetcher){globalThis.fetch=fetcher;const root=createRoot(document.querySelector('#root'));let opened,navigated;const render=async(organization=org)=>act(async()=>{root.render(React.createElement(Desk,{organization,timezone:'America/Chicago',revision:1,onOpen:id=>{opened=id;},onNavigate:section=>{navigated=section;}}));await tick();await tick();});await render();return {render,opened:()=>opened,navigated:()=>navigated,close:()=>act(async()=>root.unmount())};}
const work={checkedAt:'2030-10-21T12:00:00Z',page:0,total:1,hasMore:false,items:[{job:job.id,request:request.id,name:request.original_submission.name,address:'100 Synthetic Street',tasks:['Agreed furniture assembly'],status:'working'}]};
const agent={checkedAt:'2030-10-21T12:00:00Z',tasks:[],hasMore:false};
const day={checkedAt:'2030-10-21T12:00:00Z',timezone:'America/Chicago',hasMore:false,calls:[{id:visit.id,requestId:request.id,startAt:visit.start_at,arrivalAt:visit.start_at,endAt:visit.end_at,name:request.original_submission.name,address:'100 Synthetic Street',phone:'5550100999',tasks:['Agreed furniture assembly']}]};
test('field desk deduplicates active work, scheduled visit and request; opens exactly that job without writes or business snapshot',async()=>{
 const reads=[];const h=await mount(async(path,init)=>{assert.equal(init.method,undefined);reads.push(path);return Response.json(path.startsWith('/api/owner-day')?day:path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?work:{total:1,hasMore:false,requests:[scheduled]});});
 try{const node=document.querySelector('#root');assert.equal(node.querySelectorAll('h2').length,2);assert.equal(node.textContent.split(request.original_submission.name).length-1,2);assert.equal(node.querySelectorAll('[aria-label="Requests awaiting a decision"] .field-queue-row').length,1);assert.doesNotMatch(node.textContent,/Marketing|Your next move|Business overview|Ready for your next stop/);assert.equal(reads.length,4);assert.ok(reads.every(p=>!p.includes('business-snapshot')));await act(async()=>[...node.querySelectorAll('button')].find(b=>b.textContent.startsWith('Continue job')).click());assert.equal(h.opened(),request.id);}finally{await h.close();}
});
test('two separate jobs for one request remain independently visible in Today',async()=>{
 const other={...work.items[0],job:id(33),status:'completed'};
 const both={...work,total:2,items:[...work.items,other]};
 const h=await mount(async path=>Response.json(path.startsWith('/api/owner-day')?{...day,calls:[]}:path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?both:{total:0,hasMore:false,requests:[]}));
 try{
  const node=document.querySelector('#root');
  assert.equal(node.querySelectorAll('[aria-label="Current job"]').length,1);
  assert.equal(node.querySelectorAll('[aria-label="Remaining work"] .field-queue-row').length,1);
  assert.match(node.querySelector('[aria-label="Remaining work"]').textContent,/Prepare invoice/);
  await act(async()=>node.querySelector('[aria-label="Remaining work"] .field-queue-row').click());
  assert.equal(h.opened(),request.id);
 }finally{await h.close();}
});
test('partial queue failure keeps independently verified work, identifies missing appointments and exposes retry',async()=>{
 const h=await mount(async path=>path.startsWith('/api/owner-day')?new Response('{}',{status:503}):Response.json(path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?work:{total:0,hasMore:false,requests:[]}));try{const node=document.querySelector('#root');assert.match(node.textContent,/Appointments could not refresh/);assert.match(node.textContent,/Synthetic field customer/);assert.ok([...node.querySelectorAll('button')].some(b=>b.textContent==='Retry queue'));}finally{await h.close();}
});

test('queue finder opens the matched job, clears back to next action and never makes search requests',async()=>{
 const reads=[];const h=await mount(async path=>{reads.push(path);return Response.json(path.startsWith('/api/owner-day')?day:path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?work:{total:0,hasMore:false,requests:[]});});
 const enter=async value=>act(async()=>{const input=document.querySelector('#field-search');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 try{
  await enter('synthetic');
  assert.match(document.querySelector('[aria-label="Matching work"]').textContent,/1 match/);
  await act(async()=>document.querySelector('[aria-label="Matching work"] .field-queue-row').click());
  assert.equal(h.opened(),request.id);
  await enter('missing customer');
  assert.match(document.querySelector('[aria-label="Matching work"]').textContent,/0 matches/);
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Clear').click());
  assert.ok(document.querySelector('[aria-label="Current job"]'));
  await enter('synthetic');
  assert.equal(reads.length,4);
  await h.render(id(9));
  assert.equal(document.querySelector('#field-search')?.value||'','');
 }finally{await h.close();}
});
test('organization changes and late queue replies never restore the previous company',async()=>{
 const pending=[];const h=await mount((path)=>new Promise(resolve=>pending.push({path,resolve})));try{await h.render(id(9));await act(async()=>{for(const p of pending.filter(p=>new URL(p.path,'https://example.invalid').searchParams.get('organization')===id(9)))p.resolve(Response.json(p.path.startsWith('/api/owner-day')?{...day,calls:[]}:p.path.startsWith('/api/field-agent')?agent:p.path.startsWith('/api/owner-work')?{...work,items:[],total:0}:{requests:[],total:0,hasMore:false}));await tick();});await act(async()=>{for(const p of pending.filter(p=>new URL(p.path,'https://example.invalid').searchParams.get('organization')===org))p.resolve(Response.json(p.path.startsWith('/api/owner-day')?day:p.path.startsWith('/api/field-agent')?agent:p.path.startsWith('/api/owner-work')?work:{requests:[request],total:1,hasMore:false}));await tick();});assert.doesNotMatch(document.querySelector('#root').textContent,/Synthetic field customer/);}finally{await h.close();}
});

test('a denied queue read clears all private sources rather than retaining an earlier successful response',async()=>{
 const h=await mount(async path=>path.startsWith('/api/owner-day')?new Response('{}',{status:403}):Response.json(path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?work:{total:1,hasMore:false,requests:[request]}));try{const node=document.querySelector('#root');assert.match(node.textContent,/Company access could not be verified/);assert.doesNotMatch(node.textContent,/Synthetic field customer|Agreed furniture assembly|100 Synthetic Street/);assert.equal(node.querySelectorAll('.field-current,.field-queue-row').length,0);}finally{await h.close();}
});
test('permission loss hides an already visible queue before slower sibling reads finish',async()=>{
 let denied=false;const pending=[];
 const h=await mount(async path=>{if(denied){if(path.startsWith('/api/owner-day'))return new Response('{}',{status:403});return new Promise(resolve=>pending.push({path,resolve}));}return Response.json(path.startsWith('/api/owner-day')?day:path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?work:{requests:[],total:0,hasMore:false});});
 try{assert.match(document.querySelector('#root').textContent,/Synthetic field customer/);denied=true;Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});await act(async()=>{document.dispatchEvent(new dom.window.Event('visibilitychange'));await tick();await tick();});assert.equal(pending.length,3);assert.match(document.querySelector('#root').textContent,/Company access could not be verified/);assert.doesNotMatch(document.querySelector('#root').textContent,/Synthetic field customer/);}finally{await h.close();for(const p of pending)p.resolve(Response.json(p.path.startsWith('/api/field-agent')?agent:p.path.startsWith('/api/owner-work')?work:{requests:[],total:0,hasMore:false}));}
});

 test('pending request finder retains address and status and opens the matching request without new reads',async()=>{
 const reads=[];const pending={...request,status:'reviewing',appointments:[],original_submission:{...request.original_submission,street:'204 Maple Avenue',city:'Sycamore'}};
 const h=await mount(async path=>{reads.push(path);return Response.json(path.startsWith('/api/owner-day')?{...day,calls:[]}:path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?{...work,items:[],total:0}:{total:1,hasMore:false,requests:[pending]});});
 try{await act(async()=>{const input=document.querySelector('#field-search');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'maple sycamore reviewing');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 const row=document.querySelector('[aria-label="Matching work"] .field-queue-row');assert.ok(row);assert.match(row.textContent,/204 Maple Avenue · Sycamore/);await act(async()=>row.click());assert.equal(h.opened(),pending.id);assert.equal(reads.length,4);
 }finally{await h.close();}
 });

test('field brief uses the job approved version rather than original intake or a newer estimate',()=>{
 const changed={...quote,current_version:2,quote_versions:[{...quote.quote_versions[0],scope:'Assemble only the bookcase',labor_cents:13500,duration_minutes:120},{version:2,scope:'Unapproved additional work',labor_cents:30000,duration_minutes:240}]};
 for(const status of ['approved','working','paused']){
  const d=html(scheduled,[changed],[{...job,approved_version:1,status}],[]),brief=d.querySelector('[aria-label="Agreed work brief"]');
  assert.ok(brief);assert.match(brief.textContent,/Assemble only the bookcase/);assert.ok(brief.textContent.includes('$135.00'));assert.match(brief.textContent,/2 hours/);assert.match(brief.textContent,/version 1/);assert.doesNotMatch(brief.textContent,/Unapproved additional|300.00|Agreed furniture assembly/);
 }
});
test('field brief never labels missing or unaccepted scope as agreed and retains full long scope on demand',()=>{
 for(const qs of [[],[{...quote,status:'sent'}],[{...quote,quote_versions:[]}]])assert.equal(html(scheduled,qs,[{...job,status:'working',approved_version:1}],[]).querySelector('[aria-label="Agreed work brief"]'),null);
 const scope='Preserve approved instructions. '.repeat(30)+'Final condition stays intact.';
 const d=html(scheduled,[{...quote,quote_versions:[{...quote.quote_versions[0],scope}]}],[{...job,approved_version:1}],[]);
 assert.equal(d.querySelector('.field-agreed-scope').textContent,scope);assert.equal(d.querySelector('.field-work-brief details').open,false);assert.equal(Array.from(d.querySelector('.field-job-service').textContent).length,121);assert.equal(d.querySelector('.field-agreed-scope').textContent,scope,'Full approved scope remains accessible without truncation');assert.deepEqual(actions(d),['Start work']);
 assert.match(d.querySelector('.workflow-customer-note').textContent,/Use side entrance/);
});

test('mobile field preparation reveals every saved-state reminder behind one compact summary',()=>{
 const source=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
 assert.match(source,/prepared\.notes\.slice\(1\)\.map/);
 assert.match(source,/aria-label="Prepared job checks"/);
});

test('AI admin guidance attaches to current job without executing an owner command',async()=>{
 const events=[];
 const proposal={checkedAt:'2030-10-21T12:00:00Z',hasMore:false,tasks:[{id:id(71),request_id:request.id,title:'Check job details',detail:'Verify agreed scope before starting.',task_kind:'work'}]};
 const h=await mount(async(path,init)=>{
  events.push({path,method:init?.method});
  return Response.json(path.startsWith('/api/field-agent')?proposal:path.startsWith('/api/owner-day')?day:path.startsWith('/api/owner-work')?work:{total:0,hasMore:false,requests:[]});
 });
 try{
  const current=document.querySelector('[aria-label="Current job"]');
  assert.ok(current);
  assert.match(current.textContent,/Prepared check · review only/);
  assert.match(current.textContent,/Verify agreed scope before starting/);
  assert.equal(current.querySelectorAll('button').length,1,'Only the existing owner job action remains');
  assert.ok(events.every(e=>!e.method),'AI administration reads only');
  await act(async()=>current.querySelector('button').click());
  assert.equal(h.opened(),request.id);
 }finally{await h.close();}
});

test('optional AI admin outage does not hide a verified empty field queue',async()=>{
 const h=await mount(async path=>path.startsWith('/api/field-agent')?new Response('{}',{status:503}):Response.json(path.startsWith('/api/owner-day')?{...day,calls:[]}:path.startsWith('/api/owner-work')?{...work,items:[],total:0}:{total:0,hasMore:false,requests:[]}));
 try{
  const view=document.querySelector('#root').textContent;
  assert.match(view,/Prepared admin checks could not refresh/);
  assert.match(view,/No unfinished work, upcoming appointments, or requests requiring a decision/);
  assert.ok([...document.querySelectorAll('button')].some(x=>x.textContent==='Retry queue'));
 }finally{await h.close();}
});


test('Today keeps a next visit beside an active job without duplicating it in later work',async()=>{
 const nextVisit={...day,calls:[{...day.calls[0],id:id(82),requestId:id(83),name:'Next synthetic visit',arrivalAt:'2030-10-21T19:00:00Z',startAt:'2030-10-21T19:00:00Z'}]};
 const h=await mount(async path=>Response.json(path.startsWith('/api/owner-day')?nextVisit:path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?work:{total:0,hasMore:false,requests:[]}));
 try{
  const root=document.querySelector('#root');
  assert.ok(root.querySelector('[aria-label="Current job"]'));
  const next=root.querySelector('[aria-label="Next visit while working"]');
  assert.ok(next);
  assert.match(next.textContent,/Next synthetic visit/);
  assert.match(next.textContent,/Agreed furniture assembly/);
  assert.match(next.textContent,/100 Synthetic Street/);
  assert.match(next.querySelector('a[aria-label="Directions to Next synthetic visit"]').getAttribute('href'),/^https:\/\/www\.google\.com\/maps\/search\//);
  assert.match(next.querySelector('a[aria-label="Call Next synthetic visit"]').getAttribute('href'),/^tel:5550100999$/);
  assert.equal(root.querySelectorAll('[aria-label="Remaining work"] .field-queue-row').length,0);
  await act(async()=>next.querySelector('button').click());
  assert.equal(h.opened(),id(83));
 }finally{await h.close();}
});
test('Today keeps prepared admin detail available but collapsed until requested',async()=>{
 const proposal={checkedAt:'2030-10-21T12:00:00Z',hasMore:false,tasks:[{id:id(88),request_id:request.id,title:'Prepare next steps',detail:'Verify the exact customer agreement before work.',task_kind:'work'}]};
 const h=await mount(async path=>Response.json(path.startsWith('/api/field-agent')?proposal:path.startsWith('/api/owner-day')?day:path.startsWith('/api/owner-work')?work:{total:0,hasMore:false,requests:[]}));
 try{
  const details=document.querySelector('[aria-label="Current job"] details.field-admin-prep');
  assert.ok(details);
  assert.equal(details.open,false);
  assert.match(details.querySelector('summary').textContent,/Prepared check · review only/);
  assert.match(details.textContent,/Verify the exact customer agreement/);
  assert.equal(document.querySelectorAll('.field-admin-prep button').length,0);
 }finally{await h.close();}
});
test('Today does not repeat the featured request under an empty secondary request header',async()=>{
 const pendingRequest={...request,status:'reviewing'};
 const h=await mount(async path=>Response.json(path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-day')?{...day,calls:[]}:path.startsWith('/api/owner-work')?{...work,total:0,items:[]}:{total:1,hasMore:false,requests:[pendingRequest]}));
 try{
  const root=document.querySelector('#root');
  assert.ok(root.querySelector('[aria-label="Next request decision"]'));
  assert.equal(root.querySelector('[aria-label="Requests awaiting a decision"]'),null);
  assert.equal(root.querySelectorAll('[aria-label="Next request decision"]').length,1);
 }finally{await h.close();}
});

test('Next visit still opens safely when phone and address cannot produce contact links',async()=>{
 const sparse={...day,calls:[{...day.calls[0],id:id(91),requestId:id(92),name:'Visit with missing contact',address:'',phone:'invalid',arrivalAt:'2030-10-21T20:00:00Z',startAt:'2030-10-21T20:00:00Z'}]};
 const h=await mount(async path=>Response.json(path.startsWith('/api/owner-day')?sparse:path.startsWith('/api/field-agent')?agent:path.startsWith('/api/owner-work')?work:{total:0,hasMore:false,requests:[]}));
 try{
  const next=document.querySelector('[aria-label="Next visit while working"]');
  assert.ok(next);
  assert.equal(next.querySelectorAll('a').length,0);
  await act(async()=>next.querySelector('button').click());
  assert.equal(h.opened(),id(92));
 }finally{await h.close();}
});


test('Today warns when AI admin review is incomplete but preserves canonical job access',async()=>{
 const partial={...agent,scanIncomplete:true};
 const h=await mount(async path=>Response.json(path.startsWith('/api/field-agent')?partial:path.startsWith('/api/owner-day')?day:path.startsWith('/api/owner-work')?work:{total:0,hasMore:false,requests:[]}));
 try{
  const screen=document.querySelector('#root');
  assert.match(screen.textContent,/Prepared admin checks cover only part of the saved queue/);
  assert.ok(screen.querySelector('[aria-label="Current job"]'));
  await act(async()=>screen.querySelector('[aria-label="Current job"] button').click());
  assert.equal(h.opened(),request.id);
 }finally{await h.close();}
});
