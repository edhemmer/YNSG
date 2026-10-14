import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
// CSS is tested through the production build; component behavior is rendered in JSDOM.
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://test.example.invalid/owner'});
for(const key of ['window','document','HTMLElement','Event','MouseEvent'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const React=require('react');globalThis.React=React;
const {createRoot}=require('react-dom/client');const {act}=React;
const {default:ScheduledInvoice}=await import('../apps/web/app/scheduled-invoice.tsx');
const {default:OwnerDay}=await import('../apps/web/app/owner-day.tsx');
const node=document.querySelector('#root');
const visit={id:'a',request_id:'r',job_id:'j',status:'reserved',revision:1,start_at:'2030-10-16T13:00:00Z',arrival_at:'2030-10-16T14:00:00Z',end_at:'2030-10-16T17:00:00Z',expires_at:null,replaces_id:null,customer_response:'accepted'};
const request={id:'r',status:'quoted',revision:1,created_at:'2030-10-15T12:00:00Z',original_submission:{name:'Synthetic owner test',phone:'5550100',email:'test@example.invalid',street:'Test',city:'DeKalb'},appointments:[visit]};
const quote={id:'q',request_id:'r',status:'accepted',current_version:2,quote_versions:[{version:1,scope:'Approved original work',labor_cents:12000,duration_minutes:120},{version:2,scope:'Later version',labor_cents:18000,duration_minutes:180}]};
const job={id:'j',quote_id:'q',approved_version:1,status:'scheduled',revision:1};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Today next stops retry safely and open the exact request without mutations',async()=>{
 const root=createRoot(node);const calls=[];let failed=true,opened='';
 const id='10000000-0000-4000-8000-000000000001',requestId='10000000-0000-4000-8000-000000000002';
 globalThis.fetch=async(url,init)=>{calls.push({url,init});if(failed){failed=false;return new Response(JSON.stringify({error:'Unavailable'}),{status:503});}return new Response(JSON.stringify({checkedAt:'2030-10-16T12:00:00Z',timezone:'America/Chicago',calls:[{id,requestId,startAt:visit.start_at,arrivalAt:visit.arrival_at,endAt:visit.end_at,name:'Synthetic stop',phone:'5550100',address:'Test address',tasks:['Assembly']}],hasMore:false}),{status:200});};
 try{await act(async()=>{root.render(React.createElement(OwnerDay,{organization:id,revision:1,onOpen:value=>{opened=value;},onNavigate:()=>{}}));await tick();});
  assert.match(node.textContent,/Appointments could not load/);
  await act(async()=>{[...node.querySelectorAll('button')].find(b=>b.textContent==='Try again').click();await tick();});
  assert.match(node.textContent,/Synthetic stop/);assert.match(node.textContent,/Work \/ pickup starts/);assert.doesNotMatch(node.textContent,/Appointments could not load/);
  await act(async()=>[...node.querySelectorAll('button')].find(b=>b.textContent.includes('Open job')).click());assert.equal(opened,requestId);
  assert.ok(calls.every(c=>!c.init.method));assert.equal(calls.length,2);
 }finally{await act(async()=>root.unmount());}
});
test('scheduled invoice holding card shows exact approved version, not newest estimate, and creates no bill',async()=>{
 const root=createRoot(node);let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Preview must not call an API');};
 try{await act(async()=>root.render(React.createElement(ScheduledInvoice,{request,quotes:[quote],jobs:[job],timezone:'America/Chicago'})));
  assert.match(node.textContent,/\$120\.00/);assert.doesNotMatch(node.textContent,/\$180\.00|Later version/);assert.match(node.textContent,/No payment is due/);assert.match(node.textContent,/Awaiting work/);assert.equal(calls,0);
 }finally{await act(async()=>root.unmount());}
});
test('appointment without agreement remains a holding preview; canceled requests do not show a pending invoice',async()=>{
 const root=createRoot(node);
 try{await act(async()=>root.render(React.createElement(ScheduledInvoice,{request,quotes:[],jobs:[],timezone:'America/Chicago',compact:true})));
  assert.match(node.textContent,/Awaiting agreed price/);assert.doesNotMatch(node.textContent,/\$120/);
  await act(async()=>root.render(React.createElement(ScheduledInvoice,{request:{...request,status:'canceled'},quotes:[quote],jobs:[job],timezone:'America/Chicago'})));
  assert.equal(node.textContent,'');
 }finally{await act(async()=>root.unmount());}
});
