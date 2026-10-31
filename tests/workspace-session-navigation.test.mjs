import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {JSDOM} from 'jsdom';
import {ownerFixture,organization,requestId} from './fixtures/owner-mobile-data.mjs';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('tsx')]}));
const bundle=await build({entryPoints:['tests/fixtures/workspace-browser-harness.tsx'],bundle:true,write:false,nodePaths:[resolve('apps/web/node_modules')],platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
const other='20000000-0000-4000-8000-000000000002';
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){const end=Date.now()+5000;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,10));}assert.ok(check(),'UI did not reach expected saved state');}
async function mount(path='?section=Requests',role='owner',{state='issued',storage=null,otherRole='bookkeeper'}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'+path,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,fixture=ownerFixture(state);
 const control={memberships:[{organization_id:organization,role},{organization_id:other,role:otherRole}],workspace:null,sessionStatus:200,sessionCalls:0,post:null},reads=[],writes=[];
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.confirm=()=>true;w.crypto.randomUUID=()=>globalThis.crypto.randomUUID();
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 if(storage)for(const [key,value] of Object.entries(storage))w.sessionStorage.setItem(key,value);
 w.fetch=async(path,init={})=>{
  const url=new URL(path,w.location.href);if(init.method==='POST'){writes.push({path:url.pathname,body:init.body});if(control.post)return control.post(url,init);return Response.json({error:'Synthetic unknown result'},{status:503});}
  reads.push(url);if(url.pathname==='/api/session'){control.sessionCalls++;return Response.json(control.sessionStatus===200?{email:'owner@example.invalid',memberships:control.memberships}:{error:'Sign in'},{status:control.sessionStatus});}
  if(url.pathname==='/api/workspace'){
   if(control.workspace)return control.workspace(url);
   return Response.json({...fixture.data,brand:null,company:{id:url.searchParams.get('organization'),display_name:'Synthetic Field Company',timezone:'America/Chicago',status:'active'},customers:[],outbox:[],invoiceAdmin:{},appointments:fixture.data.requests[0].appointments,schedulingPreferences:[],pagination:{page:Number(url.searchParams.get('page')),hasMore:false,appointmentFrom:new Date().toISOString()},features:{productionWorkflows:true}});
  }
  if(url.pathname==='/api/request-inbox')return Response.json(fixture.data);
  return Response.json({error:'Synthetic optional data unavailable'},{status:503});
 };
 w.eval(bundle.outputFiles[0].text);await until(()=>w.document.querySelector('#main h1'));
 const heading=()=>w.document.querySelector('#main h1')?.textContent;
 const click=async name=>{const buttons=[...w.document.querySelectorAll('button')];const button=buttons.find(b=>b.getAttribute('aria-label')===name);assert.ok(button,name);button.click();await tick();await tick();};
 return {w,control,fixture,reads,writes,heading,click,close:()=>w.close()};
}
test('session focus keeps the current job instead of reopening an initial request link',async()=>{
 const h=await mount('?section=Requests&request='+requestId);
 try{
  // Entry opens a request. Close it, then navigate to Jobs through the actual menu.
  await until(()=>h.w.document.querySelector('dialog'));
  const close=h.w.document.querySelector('dialog button[aria-label="Close request"]')||[...h.w.document.querySelectorAll('dialog button')].find(b=>/close/i.test(b.textContent));if(close)close.click();
  await h.click('Jobs');await until(()=>h.heading()==='Jobs');
  const calls=h.control.sessionCalls;h.w.dispatchEvent(new h.w.Event('focus'));await until(()=>h.control.sessionCalls>calls);await tick();
  assert.equal(h.heading(),'Jobs');assert.equal(h.w.document.querySelector('dialog'),null);assert.equal(h.writes.length,0);
 }finally{h.close();}
});
test('company switch serializes context, clears record links and browser Back restores original company',async()=>{
 const h=await mount('?section=Money&request='+requestId+'&customer='+requestId);
 try{
  assert.equal(new URL(h.w.location.href).searchParams.has('request'),false);
  const select=h.w.document.querySelector('#company');select.value=other;select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await until(()=>new URL(h.w.location.href).searchParams.get('organization')===other);
  await until(()=>h.reads.some(u=>u.pathname==='/api/workspace'&&u.searchParams.get('organization')===other));
  h.w.history.back();await until(()=>new URL(h.w.location.href).searchParams.get('organization')===organization);assert.equal(h.heading(),'Invoices & money');assert.equal(h.writes.length,0);
 }finally{h.close();}
});
test('focus recheck removes a revoked company and routes to current permitted role',async()=>{
 const h=await mount('?section=Money');
 try{
  h.control.memberships=[{organization_id:other,role:'technician'}];h.w.dispatchEvent(new h.w.Event('focus'));await until(()=>h.heading()==='Day routes');
  assert.equal(h.w.document.querySelector('.money-invoice'),null);assert.equal(new URL(h.w.location.href).searchParams.get('organization'),other);
  assert.equal(h.w.document.querySelector('button[aria-label="Invoices & money"]'),null);
 }finally{h.close();}
});
test('transient session outage retains the current workflow without requesting sign-in mail',async()=>{
 const h=await mount('?section=Money');
 try{h.control.sessionStatus=503;h.w.dispatchEvent(new h.w.Event('focus'));await until(()=>h.w.document.body.textContent.includes('saved sign-in'));assert.equal(h.heading(),'Invoices & money');assert.equal(h.writes.length,0);}finally{h.close();}
});
test('invoice screen starts compact and keeps expense/mileage tools after invoice rows',async()=>{
 const h=await mount('?section=Money');
 try{
  const invoice=h.w.document.querySelector('.money-invoice'),tools=h.w.document.querySelectorAll('.money-tools');assert.ok(invoice);assert.equal(invoice.open,false);assert.equal(tools.length,2);assert.ok(invoice.compareDocumentPosition(tools[0])&h.w.Node.DOCUMENT_POSITION_FOLLOWING);assert.match(invoice.querySelector('summary').textContent,/\$70.00/);assert.equal(h.writes.length,0);
 }finally{h.close();}
});
test('outgoing record response cannot overwrite the newly selected company',async()=>{
 const h=await mount('?section=Money');
 try{
  let finish;h.control.workspace=url=>new Promise(r=>{finish=()=>r(Response.json({company:{id:url.searchParams.get('organization'),display_name:'Stale company response'}}));});
  const before=h.reads.length;const refresh=[...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Refresh');assert.ok(refresh);refresh.click();await until(()=>h.reads.length>before&&finish);
  h.control.workspace=null;const select=h.w.document.querySelector('#company');select.value=other;select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await until(()=>new URL(h.w.location.href).searchParams.get('organization')===other);finish();await tick();await tick();assert.doesNotMatch(h.w.document.body.textContent,/Stale company response/);
 }finally{h.close();}
});

test('same-screen role downgrade invalidates the previous owner data and reloads authorized records',async()=>{
 const h=await mount('?section=Work');
 try{
  const prior=h.reads.filter(u=>u.pathname==='/api/workspace').length;
  let finish;h.control.workspace=()=>new Promise(r=>{finish=r;});
  h.control.memberships=[{organization_id:organization,role:'technician'}];h.w.dispatchEvent(new h.w.Event('focus'));
  await until(()=>finish&&h.reads.filter(u=>u.pathname==='/api/workspace').length>prior);
  assert.equal(h.w.document.querySelector('#main h1'),null);assert.equal(h.w.document.querySelector('.money-invoice'),null);
  // No old owner data can remain mounted while current permission reads are pending.
  h.control.workspace=null;
 }finally{h.close();}
});

test('lost timer response retains one frozen action across refresh and explicit same-attempt recovery',async()=>{
 const h=await mount('?section=Work','technician',{state:'confirmed'});
 try{
  const start=[...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Start work');assert.ok(start);start.click();start.click();
  await until(()=>h.w.document.body.textContent.includes('timer result is unconfirmed'));assert.equal(h.writes.length,1);
  const first=h.writes[0].body,c=JSON.parse(first);assert.equal(c.action,'start');assert.equal(h.w.sessionStorage.length,1);
  h.fixture.data.jobs[0].status='working';h.fixture.data.jobs[0].revision=c.revision+1;
  [...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Refresh').click();await until(()=>[...h.w.document.querySelectorAll('button')].some(b=>b.textContent==='Pause work'));
  [...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Pause work').click();await tick();assert.equal(h.writes.length,1);
  h.control.post=()=>Response.json({ok:true,result:{id:c.id,revision:c.revision+1,status:'working'}});
  const retry=[...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Check saved timer action');assert.ok(retry);retry.click();retry.click();
  await until(()=>h.w.document.body.textContent.includes('Job and time record saved.'));assert.equal(h.writes.length,2);assert.equal(h.writes[1].body,first);assert.equal(h.w.sessionStorage.length,0);
 }finally{h.close();}
});
test('timer retry reload is explicit and permission rejection retains the earlier unknown attempt',async()=>{
 const first=await mount('?section=Work','technician',{state:'confirmed'});let storage,body;
 try{[...first.w.document.querySelectorAll('button')].find(b=>b.textContent==='Start work').click();await until(()=>first.writes.length===1&&first.w.document.body.textContent.includes('timer result is unconfirmed'));body=first.writes[0].body;storage=Object.fromEntries(Array.from({length:first.w.sessionStorage.length},(_,i)=>{const k=first.w.sessionStorage.key(i);return [k,first.w.sessionStorage.getItem(k)];}));}finally{first.close();}
 const h=await mount('?section=Work','technician',{state:'confirmed',storage});
 try{
  await until(()=>[...h.w.document.querySelectorAll('button')].some(b=>b.textContent==='Check saved timer action'));assert.equal(h.writes.length,0);
  h.control.post=()=>Response.json({error:'Access ended'},{status:403});[...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Check saved timer action').click();await until(()=>h.writes.length===1&&h.w.document.body.textContent.includes('timer result is unconfirmed'));
  assert.equal(h.writes[0].body,body);assert.equal(h.w.sessionStorage.length,1);
 }finally{h.close();}
});

test('failed timer recovery storage prevents sending and a malformed success never clears its frozen retry',async()=>{
 const h=await mount('?section=Work','technician',{state:'confirmed'});
 try{
  const prototype=Object.getPrototypeOf(h.w.sessionStorage),original=prototype.setItem;
  prototype.setItem=function(){throw Error('Synthetic device unavailable');};
  [...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Start work').click();await until(()=>h.w.document.body.textContent.includes('No new timer action was sent'));assert.equal(h.writes.length,0);
  prototype.setItem=original;
  h.control.post=()=>Response.json({ok:true,result:{id:requestId,revision:999,status:'working'}});
  [...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Start work').click();await until(()=>h.writes.length===1&&h.w.document.body.textContent.includes('timer result is unconfirmed'));assert.equal(h.w.sessionStorage.length,1);assert.doesNotMatch(h.w.document.body.textContent,/Job and time record saved/);
 }finally{h.close();}
});
test('confirmed timer save remains saved when local retry cleanup fails',async()=>{
 const h=await mount('?section=Work','technician',{state:'confirmed'});
 try{
  const prototype=Object.getPrototypeOf(h.w.sessionStorage);prototype.removeItem=function(){throw Error('Synthetic cleanup failure');};
  h.control.post=(_url,init)=>{const c=JSON.parse(init.body);return Response.json({ok:true,result:{id:c.id,revision:c.revision+1,status:'working'}});};
  [...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Start work').click();await until(()=>h.w.document.body.textContent.includes('Job and time record saved.'));
  assert.equal(h.w.sessionStorage.length,1);assert.doesNotMatch(h.w.document.body.textContent,/timer result is unconfirmed/);assert.match(h.w.document.body.textContent,/could not clear its protected retry/);
 }finally{h.close();}
});

test('workspace refresh preserves mounted invoice tools on transient failures and removes protected data on denied reads',async()=>{
 for(const status of [503,401,403]){
  const h=await mount('?section=Money');
  try{
   const invoice=h.w.document.querySelector('.money-invoice');assert.ok(invoice);
   h.control.workspace=()=>Response.json({error:'Synthetic workspace unavailable'},{status});
   const refresh=[...h.w.document.querySelectorAll('.heading-actions button')].find(button=>button.textContent==='Refresh');assert.ok(refresh);refresh.click();
   await until(()=>h.w.document.body.textContent.includes('Saved records could not be refreshed.'));
   assert.equal(h.w.document.querySelector('.money-invoice'),status===503?invoice:null);
   assert.equal(h.writes.length,0);
  }finally{h.close();}
 }
});

test('lost customer-agreement response retains exact key through denial and saved-state refresh until acknowledged',async()=>{
 const h=await mount('?section=Work&request='+requestId,'owner',{state:'confirmed'});
 try{
  const savedJob=h.fixture.data.jobs[0];h.fixture.data.quotes[0].status='sent';h.fixture.data.jobs=[];
  h.w.document.querySelector('#main .heading-actions button').click();await until(()=>h.w.document.querySelector('.field-job textarea[name=evidence]'));
  const evidence=h.w.document.querySelector('textarea[name=evidence]');Object.getOwnPropertyDescriptor(h.w.HTMLTextAreaElement.prototype,'value').set.call(evidence,'Synthetic actual customer agreement for this fixture.');evidence.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  const press=label=>{const b=[...h.w.document.querySelectorAll('.field-job button')].find(b=>b.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false,label);b.click();};
  h.control.post=()=>Response.json({error:'Lost response after save'},{status:503});press('Record customer agreement');await until(()=>h.w.document.querySelector('.field-job').textContent.includes('Check saved field decision'));assert.equal(h.writes.length,1);
  const original=h.writes[0].body;h.control.post=()=>Response.json({error:'Access changed'},{status:403});press('Check saved field decision');await until(()=>h.writes.length===2);await tick();await tick();assert.equal(h.writes[1].body,original);
  h.fixture.data.quotes[0].status='accepted';h.fixture.data.jobs=[savedJob];h.w.document.querySelector('#main .heading-actions button').click();await until(()=>[...h.w.document.querySelectorAll('.field-job button')].some(b=>b.textContent==='Start work'));
  assert.equal([...h.w.document.querySelectorAll('.field-job button')].find(b=>b.textContent==='Start work').disabled,true);await h.click('Jobs');assert.equal(new URL(h.w.location.href).searchParams.get('request'),requestId);
  h.control.post=()=>Response.json({ok:true,result:{id:savedJob.id,revision:4}});press('Check saved field decision');await until(()=>h.writes.length===3);await until(()=>![...h.w.document.querySelectorAll('.field-job button')].find(b=>b.textContent==='Start work')?.disabled);assert.equal(h.writes[2].body,original);assert.equal(h.w.document.querySelector('.field-job').textContent.includes('Check saved field decision'),false);
 }finally{h.close();}
});

test('job support customer context is discarded on company change, including owner-to-owner switching',async()=>{const h=await mount('?section=Work&request='+requestId,'owner',{state:'working',otherRole:'owner'});try{await until(()=>[...h.w.document.querySelectorAll('button')].some(b=>b.textContent==='Help with this job'));[...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Help with this job').click();await until(()=>h.w.document.querySelector('dialog[aria-labelledby=network-lookup-title]'));assert.match(h.w.document.querySelector('dialog[aria-labelledby=network-lookup-title]').textContent,/Help with this job/);const select=h.w.document.querySelector('#company');select.value=other;select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await until(()=>new URL(h.w.location.href).searchParams.get('organization')===other);assert.equal(h.w.document.querySelector('dialog[aria-labelledby=network-lookup-title]'),null);select.value=organization;select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await until(()=>new URL(h.w.location.href).searchParams.get('organization')===organization);assert.equal(h.w.document.querySelector('dialog[aria-labelledby=network-lookup-title]'),null);}finally{h.close();}});

test('referral support opens from a decline decision without discarding or sending its unsaved customer message',async()=>{const h=await mount('?section=Work&request='+requestId,'owner',{state:'new'});try{await until(()=>[...h.w.document.querySelectorAll('button')].some(b=>b.textContent==='Decline request'));[...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='Decline request').click();await until(()=>h.w.document.querySelector('dialog.request-dialog textarea[name=reason]'));const input=h.w.document.querySelector('dialog.request-dialog textarea[name=reason]');Object.getOwnPropertyDescriptor(h.w.HTMLTextAreaElement.prototype,'value').set.call(input,'Keep this careful decline explanation.');input.dispatchEvent(new h.w.Event('input',{bubbles:true}));await tick();h.w.confirm=()=>{throw Error('Read-only referral lookup must not discard the parent decline draft');};const referral=[...h.w.document.querySelectorAll('dialog.request-dialog button')].find(b=>b.textContent==='Find a referral');assert.ok(referral);referral.click();await until(()=>h.w.document.querySelector('dialog[aria-labelledby=network-lookup-title]'));h.w.document.querySelector('dialog[aria-labelledby=network-lookup-title] button[aria-label="Close referral lookup"]').click();await until(()=>!h.w.document.querySelector('dialog[aria-labelledby=network-lookup-title]'));assert.equal(h.w.document.querySelector('dialog.request-dialog textarea[name=reason]').value,'Keep this careful decline explanation.');assert.equal(h.writes.length,0);}finally{h.close();}});
