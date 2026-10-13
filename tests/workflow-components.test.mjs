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
const node=document.querySelector('#root');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=data=>new Response(JSON.stringify(data),{status:200});
const button=text=>[...node.querySelectorAll('button')].find(b=>b.textContent===text);
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001';
const quiet=()=>{};
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
  if(String(path).startsWith('/api/invoice-admin'))return response({admin:{revision:0,dueDate:null,archived:false},orders:[],payments,canManage:true,cardConfigured:false,cardTransactions:[]});
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
  assert.match(node.textContent,/remaining \$70\.00/);assert.equal(node.querySelector('form fieldset').disabled,false);
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
  assert.ok(html.includes('Customer approval recorded'));
  if(status==='approved')assert.ok(html.includes('Start work timer'));
  else assert.ok(html.includes('Invoice draft'));
  if(status==='completed')assert.ok(html.includes('No invoice has been issued yet'));
 }
 for(const relation of [null,{id:'invoice',number:2026100001},[]]){
  const html=renderToStaticMarkup(React.createElement(ServiceWorkflow,{...props,jobs:[{id:'job',quote_id:'quote',revision:1,status:'completed',invoices:relation}],invoices:[{id:'invoice',job_id:'job',number:2026100001,total_cents:12000,payments:[]}]}));
  assert.ok(html.includes('Open invoice / download PDF'));assert.ok(!html.includes('Invoice draft'));assert.ok(!html.includes('No invoice has been issued yet'));
 }
});
