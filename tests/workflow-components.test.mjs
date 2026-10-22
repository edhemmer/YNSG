import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://test.example.invalid/owner'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLFormElement','Event','MouseEvent','FormData'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const React=require('react');globalThis.React=React;
const {createRoot}=require('react-dom/client');
const {act}=React;
const {default:InvoiceDraft}=await import('../apps/web/app/invoice-draft.tsx');
const {default:InvoicePayments}=await import('../apps/web/app/invoice-payments.tsx');
const {EntrySafety,useEntrySafety,useUnsavedEntry,useBlockedEntry}=await import('../apps/web/app/entry-safety.tsx');
const node=document.querySelector('#root');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=data=>new Response(JSON.stringify(data),{status:200});
const button=text=>[...node.querySelectorAll('button')].find(b=>b.textContent===text);
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001';
const quiet=()=>{};
test('unsaved-entry guard warns before leaving, blocks browser unload and clears on unmount',async()=>{
 const root=createRoot(node);let leaving,confirmations=0;window.confirm=()=>{confirmations++;return false;};
 function Entry(){useUnsavedEntry('synthetic',true);leaving=useEntrySafety().canLeave;return React.createElement('p',null,'Draft');}
 try{await act(async()=>root.render(React.createElement(EntrySafety,null,React.createElement(Entry))));assert.equal(leaving(),false);assert.equal(confirmations,1);
  const event=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  await act(async()=>root.render(React.createElement(EntrySafety,null,React.createElement('p',null,'Saved'))));assert.equal(leaving(),true);assert.equal(confirmations,1);
 }finally{await act(async()=>root.unmount());}
});
test('remote job revision preserves dirty work and blocks overwrite until an explicitly confirmed reload',async()=>{
 const root=createRoot(node);let current=1,updateRevision,reads=0;
 globalThis.fetch=async(path,init)=>{assert.ok(String(path).startsWith('/api/invoice-draft'));assert.ok(!init.method);reads++;return response({draft:{jobRevision:current,lines:[{description:current===1?'Original saved work':'New saved work',recordedMinutes:120,chargedCents:12000,waiverReason:''}]},tax:{required:false,rules:[],valid:true,tax:null},readiness:{ready:true,reasons:[]}});};
 function Harness(){const [revision,setRevision]=React.useState(1);updateRevision=value=>{current=value;setRevision(value);};return React.createElement(EntrySafety,null,React.createElement(InvoiceDraft,{organization:org,job:id,revision,completed:true,blocked:false,onBusy:quiet,saved:quiet,initialExpanded:true}));}
 try{await act(async()=>{root.render(React.createElement(Harness));await tick();});
  await act(async()=>[...node.querySelectorAll('button')].find(b=>b.textContent.includes('Add work item')).click());
  assert.equal(node.querySelectorAll('textarea').length,2);assert.match(node.textContent,/Unsaved entries/);
  await act(async()=>{updateRevision(2);await tick();});assert.equal(reads,1);assert.match(node.textContent,/job changed elsewhere/);assert.equal(node.querySelector('textarea').value,'Original saved work');assert.equal(button('Save invoice draft').disabled,true);
  window.confirm=()=>false;await act(async()=>button('Reload saved work').click());assert.equal(reads,1);assert.equal(node.querySelectorAll('textarea').length,2);
  window.confirm=()=>true;await act(async()=>{button('Reload saved work').click();await tick();});assert.equal(reads,2);assert.equal(node.querySelector('textarea').value,'New saved work');assert.doesNotMatch(node.textContent,/Unsaved entries|job changed elsewhere/);
 }finally{await act(async()=>root.unmount());}
});
test('pending or unknown result lock cannot be bypassed by accepting an unsaved-draft warning',async()=>{
 const root=createRoot(node);let leaving,prompts=0;window.confirm=()=>{prompts++;return true;};
 function Pending(){useUnsavedEntry('synthetic',true);useBlockedEntry('command',true);leaving=useEntrySafety().canLeave;return React.createElement('p',null,'Check saved result');}
 try{await act(async()=>root.render(React.createElement(EntrySafety,null,React.createElement(Pending))));assert.equal(leaving(),false);assert.equal(prompts,0);
 }finally{await act(async()=>root.unmount());}
});
test('saving work preserves the unsaved tax review instead of claiming it was saved or clearing it',async()=>{
 const root=createRoot(node);let revision=1;
 const lines=[{description:'Synthetic completed work',recordedMinutes:120,chargedCents:12000,waiverReason:''}];
 globalThis.fetch=async(path,init)=>{
  if(!init?.method)return response({draft:{jobRevision:revision,lines},tax:{required:true,rules:[],valid:true,tax:null},readiness:{ready:true,reasons:[]}});
  assert.equal(path,'/api/invoice-draft');const body=JSON.parse(init.body);assert.ok(!('taxEvidence' in body));revision++;return response({result:{revision,totalCents:12000}});
 };
 function Harness(){const [current,setCurrent]=React.useState(1);return React.createElement(EntrySafety,null,React.createElement(InvoiceDraft,{organization:org,job:id,revision:current,completed:true,blocked:false,onBusy:quiet,saved:()=>setCurrent(revision),initialExpanded:true}));}
 try{await act(async()=>{root.render(React.createElement(Harness));await tick();});
  const evidence=node.querySelector('textarea[placeholder^="Record acceptance"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(evidence,'Synthetic pending jurisdiction review');evidence.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>node.querySelector('input[type=checkbox]').click());
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();await tick();});
  assert.equal(revision,2);assert.equal(node.querySelector('textarea[placeholder^="Record acceptance"]').value,'Synthetic pending jurisdiction review');assert.match(node.textContent,/Unsaved entries/);
 }finally{await act(async()=>root.unmount());}
});
test('owner can save reviewed draft and issue it at the saved revision without losing unchanged review',async()=>{
 let revision=1,draft=null,issued=null;
 globalThis.fetch=async(path,init)=>{
  if(String(path).startsWith('/api/invoice-draft')&&!init?.method)return response({draft,tax:{required:false,rules:[],valid:true,tax:null},readiness:{ready:true,reasons:[]}});
  const body=JSON.parse(init.body);
  if(path==='/api/invoice-draft'){assert.equal(body.revision,revision);revision++;draft={jobRevision:revision,lines:body.lines.map(l=>Object.fromEntries(Object.entries(l).reverse()))};return response({result:{revision,totalCents:12000}});}
  if(path==='/api/commands'){issued=body;assert.equal(body.revision,revision);return response({ok:true,result:{id,totalCents:12000}});}
  throw Error('Unexpected path '+path);
 };
 const root=createRoot(node);
 function Harness(){const [current,setCurrent]=React.useState(1);return React.createElement(InvoiceDraft,{organization:org,job:id,revision:current,completed:true,blocked:false,onBusy:quiet,saved:()=>setCurrent(revision),initialExpanded:true,suggestedWork:{description:'Synthetic agreed furniture assembly',chargedCents:12000}});}
 try{
  await act(async()=>{root.render(React.createElement(Harness));await tick();});
  assert.equal(button('Approve and issue invoice').disabled,true);
  await act(async()=>node.querySelector('input[type=checkbox]').click());
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();await tick();});
  assert.equal(draft.jobRevision,2);assert.equal(button('Approve and issue invoice').disabled,false);
  await act(async()=>{button('Approve and issue invoice').click();await tick();});
  assert.equal(issued.command,'ApproveInvoice');assert.equal(issued.totalCents,12000);assert.equal(issued.revision,2);
 }finally{await act(async()=>root.unmount());}
});
test('an ambiguous partial cash payment locks edits and checks the exact command instead of duplicating it',async()=>{
 const payments=[],bodies=[];let first=true;
 globalThis.fetch=async(path,init)=>{
  if(String(path).startsWith('/api/invoice-admin'))return response({organization:org,invoice:id,admin:{revision:0,dueDate:null,archived:false},orders:[],payments,canManage:true,creditContext:{invoiceId:id,totalCents:12000,subtotalCents:12000,taxComponents:[],paidCents:typeof paid!=='undefined'?paid:typeof payments!=='undefined'?payments.reduce((n,p)=>n+p.cents,0):0,revision:0,canIssue:true,credits:[]},cardConfigured:false,cardTransactions:[]});
  if(path==='/api/commands'){
   const body=JSON.parse(init.body);bodies.push(body);
   if(first){first=false;payments.push({id,cents:body.cents,method:body.method,receivedAt:body.receivedAt,reference:body.reference});return new Response(JSON.stringify({error:'Response unavailable after save'}),{status:503,headers:{'Content-Type':'application/json'}});}
   assert.deepEqual(body,bodies[0]);return response({ok:true,result:{id}});
  }
  throw Error('Unexpected path '+path);
 };
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(InvoicePayments,{organization:org,invoice:id,totalCents:12000,timezone:'America/Chicago'}));await tick();});
  const amount=node.querySelector('[name=amount]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(amount,'50.00');amount.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  node.querySelector('[name=reference]').value='Synthetic cash received';
  await act(async()=>node.querySelector('form input[type=checkbox]').click());
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();});
  assert.equal(button('Check saved payment result').disabled,false);assert.equal(node.querySelector('form fieldset').disabled,true);
  await act(async()=>{button('Check saved payment result').click();await tick();});
  assert.equal(payments.length,1);assert.equal(bodies.length,2);assert.equal(bodies[0].cents,5000);
  assert.match(node.querySelector('.payment-balance-summary').textContent,/Remaining balance\$70\.00/);assert.equal(node.querySelector('form fieldset').disabled,false);
 }finally{await act(async()=>root.unmount());}
});

// PostgREST's unique jobs→invoices relation is an object or null, not an array.
// The workflow uses its separately loaded invoice list as the authoritative link.
const {default:ServiceWorkflow}=await import('../apps/web/app/service-workflow.tsx');
const {renderToStaticMarkup}=require('react-dom/server');
test('accepted quote opens for jobs without invoices and uses canonical invoice links after issuance',()=>{
 const request={id,status:'quoted',revision:3,created_at:'2026-10-13T12:00:00Z',original_submission:{name:'Synthetic workflow customer',street:'Test street',city:'Test city',phone:'5550100',email:'synthetic@example.invalid',services:[{service:'Home jobs',task:'Furniture assembly'}]},appointments:[{id:'appointment',request_id:id,status:'reserved',revision:1,start_at:'2026-10-16T14:00:00Z',arrival_at:'2026-10-16T14:00:00Z',end_at:'2026-10-16T16:00:00Z',expires_at:null,replaces_id:null,customer_response:'confirmed'}]};
 const quote={id:'quote',request_id:id,status:'accepted',current_version:1,quote_versions:[{version:1,scope:'Synthetic approved furniture assembly',labor_cents:12000,duration_minutes:120}]};
 const props={organization:org,request,quotes:[quote],timezone:'America/Chicago',canManage:true,canQuote:true,canWork:true,busy:false,onBusy:quiet,onReview:quiet,act:async()=>{},fieldAction:async()=>{},onChanged:quiet};
 for(const status of ['approved','working','paused','completed']){
  const html=renderToStaticMarkup(React.createElement(ServiceWorkflow,{...props,jobs:[{id:'job',quote_id:'quote',revision:1,status,invoices:null}],invoices:[]}));
  assert.ok(html.includes('Scope &amp; price: accepted'));
  if(status==='approved'){assert.match(html, /class="field-command-primary"[^>]*>Start work/);assert.equal((html.match(/>Start work</g)||[]).length,1);}
  else assert.ok(html.includes(status==='completed'?'Invoice draft':'Work record'));
  if(status==='completed')assert.ok(html.includes('No invoice has been issued yet'));
 }
 for(const relation of [null,{id:'invoice',number:2026100001},[]]){
  const html=renderToStaticMarkup(React.createElement(ServiceWorkflow,{...props,jobs:[{id:'job',quote_id:'quote',revision:1,status:'completed',invoices:relation}],invoices:[{id:'invoice',job_id:'job',number:2026100001,total_cents:12000,payments:[]}]}));
  assert.ok(html.includes('Open invoice / download PDF'));assert.ok(!html.includes('Invoice draft'));assert.ok(!html.includes('No invoice has been issued yet'));
 }
});
const {default:ScheduledInvoice}=await import('../apps/web/app/scheduled-invoice.tsx');
test('scheduled invoice holds the job-approved price without creating a bill or showing a later quote version',()=>{
 const request={id,status:'quoted',revision:3,created_at:'2026-10-13T12:00:00Z',original_submission:{name:'Synthetic customer'},appointments:[{id:'visit',job_id:'job',status:'reserved',start_at:'2026-10-16T14:00:00Z',arrival_at:'2026-10-16T14:00:00Z'}]};
 const quote={id:'quote',status:'accepted',current_version:2,quote_versions:[{version:1,scope:'Agreed assembly',labor_cents:12000,duration_minutes:120},{version:2,scope:'Later different work',labor_cents:24000,duration_minutes:240}]};
 const props={request,quotes:[quote],jobs:[{id:'job',quote_id:'quote',approved_version:1,status:'approved'}],timezone:'America/Chicago'};
 const html=renderToStaticMarkup(React.createElement(ScheduledInvoice,props));
 assert.match(renderToStaticMarkup(React.createElement(ScheduledInvoice,{...props,jobs:[{...props.jobs[0],status:'completed'}]})),/Ready for invoice review/);
 assert.match(html,/Awaiting work/);assert.match(html,/\$120\.00/);assert.ok(!html.includes('$240.00'));assert.match(html,/No payment is due/);assert.ok(!html.includes('<form'));
 assert.match(renderToStaticMarkup(React.createElement(ScheduledInvoice,{...props,jobs:[]})),/Awaiting agreed price/);
 assert.equal(renderToStaticMarkup(React.createElement(ScheduledInvoice,{...props,request:{...request,appointments:[{...request.appointments[0],status:'canceled'}]}})),'');
});
const {default:RecurringVisits}=await import('../apps/web/app/recurring-visits.tsx');
test('weekly check never books, and an uncertain booking replays exactly one saved command',async()=>{
 const bodies=[];let first=true;
 globalThis.fetch=async(path,init)=>{
  if(!init?.method)return response(String(path).includes('first=')?{context:{first:{id,arrivalAt:'2026-10-16T14:00:00Z',startAt:'2026-10-16T14:00:00Z',endAt:'2026-10-16T16:00:00Z',timezone:'America/Chicago',scope:'Synthetic agreed assembly',laborCents:12000}}}:{series:[],hasMore:false});
  const body=JSON.parse(init.body);bodies.push(body);
  if(body.action==='check')return response({review:id,validUntil:new Date(Date.now()+60000).toISOString(),conflicts:0,visits:[{date:'2026-10-16',start:'2026-10-16T14:00:00Z',end:'2026-10-16T16:00:00Z',available:true}]});
  if(first){first=false;return new Response(JSON.stringify({error:'Response unavailable'}),{status:503});}
  assert.deepEqual(body,bodies[1]);return response({result:{visits:53}});
 };
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(RecurringVisits,{organization:org,firstAppointment:id,onOpen:quiet,onChanged:quiet,onBusy:quiet}));await tick();});
  await act(async()=>{button('Set up weekly visits for 12 months').click();await tick();});
  node.querySelector('textarea').value='Synthetic customer agreed to the weekly scope, dates and price.';
  await act(async()=>node.querySelector('input[type=checkbox]').click());
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();});
  assert.equal(bodies.length,1);assert.equal(bodies[0].action,'check');
  await act(async()=>{button('Book the 1 agreed visits').click();await tick();});
  assert.equal(node.querySelector('fieldset').disabled,true);assert.ok(button('Check saved result'));
  await act(async()=>{button('Check saved result').click();await tick();});
  assert.equal(bodies.length,3);assert.match(node.textContent,/53 visits confirmed/);
 }finally{await act(async()=>root.unmount());}
});
const {default:AppointmentSummary}=await import('../apps/web/app/appointment-summary.tsx');
test('appointment cards separate local arrival from reserved pickup/work time and keep proposal meaning explicit',()=>{
 const visit={id,status:'reserved',arrival_at:'2026-10-19T14:30:00Z',start_at:'2026-10-19T14:00:00Z',end_at:'2026-10-19T18:30:00Z',replaces_id:'old'};
 const card=new JSDOM(renderToStaticMarkup(React.createElement(AppointmentSummary,{visit,timezone:'America/Chicago'}))).window.document;
 assert.match(card.querySelector('.visit-date-label').textContent,/Monday, October 19, 2026/);
 assert.equal(card.querySelector('time').textContent,'9:30 AM');assert.equal(card.querySelector('.visit-window dd').textContent,'9:00 AM – 1:30 PM');assert.match(card.querySelector('.visit-zone').textContent,/CDT/);assert.ok(!card.querySelector('.visit-retained'));
 const proposal=renderToStaticMarkup(React.createElement(AppointmentSummary,{visit:{...visit,status:'proposal'},timezone:'America/Chicago'}));assert.match(proposal,/Awaiting approval/);assert.match(proposal,/Original visit stays booked/);
 const winter=renderToStaticMarkup(React.createElement(AppointmentSummary,{visit:{...visit,arrival_at:'2026-11-09T15:30:00Z',start_at:'2026-11-09T15:00:00Z',end_at:'2026-11-09T19:30:00Z'},timezone:'America/Chicago'}));assert.match(winter,/CST/);assert.match(winter,/9:30 AM/);
});
test('one work save completes the visit using its fresh revision and never issues an invoice automatically',async()=>{
 let completionRevision=null,issued=false;
 globalThis.fetch=async(path,init)=>{
  if(!init?.method)return response({draft:null,tax:{required:false,rules:[],valid:true,tax:null},readiness:{ready:true,reasons:[]}});
  if(path==='/api/visit-completion'){const b=JSON.parse(init.body);assert.equal(b.revision,3);assert.equal(b.reviewed,true);completionRevision=5;return response({result:{revision:5,status:'completed'}});}
  issued=true;throw Error('Issuance must remain a separate review');
 };
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(InvoiceDraft,{organization:org,job:id,revision:3,completed:false,blocked:false,onBusy:quiet,saved:quiet,mobile:true,completeOnSave:true,initialExpanded:true,suggestedWork:{description:'Synthetic actual assembly',chargedCents:12000}}));await tick();});
  await act(async()=>node.querySelector('input[type=checkbox]').click());
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();});
  assert.equal(completionRevision,5);assert.equal(issued,false);
 }finally{await act(async()=>root.unmount());}
});
test('uncertain mobile completion freezes edits and replays the exact command without invoicing',async()=>{
 const attempts=[];let synced=0;
 globalThis.fetch=async(path,init)=>{
  if(!init?.method)return response({draft:null,tax:{required:false,rules:[],valid:true,tax:null},readiness:{ready:true,reasons:[]}});
  assert.equal(path,'/api/visit-completion');attempts.push(init.body);
  if(attempts.length===1)throw Error('Synthetic connection interrupted after commit');
  return response({result:{revision:5,status:'completed'}});
 };
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(InvoiceDraft,{organization:org,job:id,revision:3,completed:false,blocked:false,onBusy:quiet,saved:()=>synced++,mobile:true,completeOnSave:true,initialExpanded:true,suggestedWork:{description:'Synthetic actual assembly',chargedCents:12000}}));await tick();});
  await act(async()=>node.querySelector('input[type=checkbox]').click());
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();});
  assert.ok(node.querySelector('form > fieldset').disabled);assert.equal(synced,0);
  const check=[...node.querySelectorAll('button')].find(b=>b.textContent==='Check saved work');assert.ok(check);
  await act(async()=>{check.click();await tick();});
  assert.equal(attempts.length,2);assert.equal(attempts[0],attempts[1]);assert.equal(synced,1);
 }finally{await act(async()=>root.unmount());}
});
test('phone registration is opt-in and an uncertain save replays one exact reviewed preference body',async()=>{
 const {default:MobileNotifications}=await import('../apps/web/app/mobile-notifications.tsx');let bridgeMessage=null;const writes=[];
 window.ReactNativeWebView={postMessage:value=>{bridgeMessage=JSON.parse(value);}};
 globalThis.fetch=async(path,init)=>{
  if(!init?.method)return response({devices:[],delivery:{pending:0,accepted:0,needsAttention:0},configured:true,environment:'sandbox',identity:org});
  assert.equal(path,'/api/mobile-notifications');writes.push(init.body);
  if(writes.length===1)throw Error('Synthetic network failure after save');
  return response({result:{id,revision:1,enabled:true}});
 };
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(MobileNotifications,{organization:org,timezone:'America/Chicago',onBusy:quiet}));await tick();});
  assert.equal(bridgeMessage,null,'permission is never requested on load');
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();});
  assert.equal(bridgeMessage.type,'ynsg.push.register');assert.ok(bridgeMessage.nonce);
  await act(async()=>{window.dispatchEvent(new dom.window.CustomEvent('ynsg-native-reply',{detail:{type:'ynsg.push.reply',nonce:bridgeMessage.nonce,device:id,token:'a'.repeat(64),environment:'sandbox'}}));await tick();});
  assert.ok(node.querySelector('form > fieldset').disabled);assert.equal(writes.length,1);
  await act(async()=>{button('Check saved alert settings').click();await tick();});
  assert.equal(writes.length,2);assert.equal(writes[0],writes[1]);const value=JSON.parse(writes[0]);assert.equal(value.reviewed,true);assert.equal(value.quietStart,1260);assert.equal(value.quietEnd,420);assert.equal(value.sound,false);
 }finally{await act(async()=>root.unmount());delete window.ReactNativeWebView;}
});

test('owner attention card explains the remaining action even when the appointment is confirmed',async()=>{
 const {default:RequestInbox}=await import('../apps/web/app/request-inbox.tsx');const root=createRoot(node);
 const request={id,revision:1,status:'quoted',created_at:'2026-10-14T12:00:00Z',original_submission:{name:'Synthetic owner review',street:'100 Synthetic Street',city:'DeKalb',phone:'5550100999',services:[{service:'Home jobs',task:'Furniture assembly'}]},appointments:[{id:'60000000-0000-4000-8000-000000000001',status:'reserved',start_at:'2026-10-20T14:00:00Z',end_at:'2026-10-20T16:00:00Z',arrival_at:'2026-10-20T14:00:00Z',expires_at:null}]};
 globalThis.fetch=async()=>response({requests:[request],total:1,needsReview:0,page:0,hasMore:false,checkedAt:'2026-10-14T12:00:00Z',quotes:[],jobs:[],invoices:[],preferences:[]});
 try{await act(async()=>{root.render(React.createElement(RequestInbox,{organization:org,timezone:'America/Chicago',revision:1,onOpen:quiet,compact:true}));await tick();await tick();});assert.match(node.textContent,/Next: Agree on the work and price/);assert.ok([...node.querySelectorAll('button')].some(b=>b.textContent.includes('Continue workflow')));
 }finally{await act(async()=>root.unmount());}
});

test('visit brief separates services and appointment from the complete customer note',async()=>{
 const {renderToStaticMarkup}=require('react-dom/server');
 const request={id,status:'reviewing',revision:1,created_at:'2026-10-15T12:00:00Z',original_submission:{name:'Synthetic visit brief',street:'100 Synthetic Street',city:'DeKalb',phone:'5550100999',services:[{service:'Home jobs',task:'Furniture assembly'}],description:'Synthetic access instruction that must remain readable.'},appointments:[{id:'60000000-0000-4000-8000-000000000001',status:'reserved',revision:1,start_at:'2026-10-20T14:00:00Z',arrival_at:'2026-10-20T14:00:00Z',end_at:'2026-10-20T16:00:00Z',expires_at:null}]};
 const html=renderToStaticMarkup(React.createElement(ServiceWorkflow,{organization:org,request,quotes:[],jobs:[],invoices:[],timezone:'America/Chicago',canManage:true,canQuote:true,canWork:true,busy:false,onBusy:quiet,onReview:quiet,act:async()=>({ok:true}),fieldAction:async()=>{},onChanged:quiet}));const doc=new JSDOM(html).window.document;
 assert.match(doc.querySelector('.workflow-service-summary').textContent,/Furniture assembly/);assert.equal(doc.querySelector('.workflow-header .customer-note'),null);assert.match(doc.querySelector('.workflow-visit-overview').textContent,/9:00 AM/);assert.ok(doc.querySelector('.workflow-customer-note').open,'Owner starts with customer instructions expanded during confirmation');assert.match(doc.querySelector('.workflow-customer-note p').textContent,/must remain readable/);assert.ok(html.indexOf('workflow-visit-overview')<html.indexOf('workflow-customer-note'));assert.equal(doc.querySelectorAll('.workflow-section>.visit-summary').length,0,'No duplicate primary appointment card');
});
