import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {schedulingFailure} from '../apps/web/lib/scheduling-errors.ts';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLFormElement','Event','MouseEvent','FormData'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const React=require('react');globalThis.React=React;
const {act}=React,{createRoot}=require('react-dom/client');
const {default:Scheduling}=await import('../apps/web/app/scheduling-review-panel.tsx');
const {EntrySafety,useEntrySafety}=await import('../apps/web/app/entry-safety.tsx');
const node=document.querySelector('#root'),tick=()=>new Promise(resolve=>setImmediate(resolve));
const id='30000000-0000-4000-8000-000000000001',org='20000000-0000-4000-8000-000000000001';
const context={requestRevision:1,configurationVersion:1,scheduleRevision:1,settings:{timezone:'America/Chicago',scheduling:{bufferMinutes:15,leadMinutes:60,horizonMinutes:43200,weekdays:[1,2,3,4,5],start:'08:00',end:'17:00',latestStart:'15:00'}},resources:[{id,name:'Synthetic operator',kind:'operator',status:'available'}],appointmentResources:[id],confirmedAppointments:[],appointment:{revision:1,start_at:'2030-10-16T15:00:00Z',end_at:'2030-10-16T17:00:00Z',arrival_at:'2030-10-16T15:00:00Z'}};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
const button=text=>[...node.querySelectorAll('button')].find(b=>b.textContent===text);
test('lost scheduling response locks navigation and edits, then replays the exact saved command once',async()=>{
 let canLeave,completed=0;const bodies=[];window.confirm=()=>true;
 globalThis.fetch=async(path,init)=>{if(!init?.method)return response(context);bodies.push(init.body);if(bodies.length===1)throw Error('synthetic lost response');return response({result:{id,status:'reserved'},delivery:null});};
 function Probe(){canLeave=useEntrySafety().canLeave;return null;}
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(EntrySafety,null,React.createElement(Probe),React.createElement(Scheduling,{organization:org,requestId:id,appointmentId:id,initialExpanded:true,completed:()=>completed++})));await tick();await tick();});
  await act(async()=>{const note=node.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(note,'Synthetic scheduling note');note.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>{node.querySelector('form').requestSubmit();node.querySelector('form').requestSubmit();await tick();});
  assert.equal(bodies.length,1);assert.equal(completed,0);assert.equal(canLeave(),false);assert.equal(node.querySelector('fieldset').disabled,true);assert.equal(button('Confirm appointment').disabled,true);assert.equal(button('Check saved result').disabled,false);
  await act(async()=>{button('Check saved result').click();button('Check saved result').click();await tick();});
  assert.equal(bodies.length,2);assert.equal(bodies[1],bodies[0]);assert.equal(completed,1);assert.equal(canLeave(),true);assert.equal(node.querySelector('fieldset').disabled,false);
 }finally{await act(async()=>root.unmount());}
});
test('a definite conflict refreshes scheduling context and retains the private note without claiming confirmation',async()=>{
 let completed=0,reads=0;globalThis.fetch=async(path,init)=>{if(!init?.method){reads++;return response(context);}return response({error:'The request, calendar or settings changed. Refresh and review again.'},409);};
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(Scheduling,{organization:org,requestId:id,appointmentId:id,initialExpanded:true,completed:()=>completed++}));await tick();await tick();});
  await act(async()=>{const note=node.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(note,'Synthetic note retained');note.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();await tick();await tick();});
  assert.equal(completed,0);assert.equal(reads,2);assert.equal(node.querySelector('textarea').value,'Synthetic note retained');assert.equal(node.querySelector('fieldset').disabled,false);assert.equal(button('Check saved result'),undefined);
 }finally{await act(async()=>root.unmount());}
});
test('unknown scheduling errors never claim a rollback; named domain and access rejections remain definitive',()=>{
 assert.equal(schedulingFailure('synthetic database connection lost').status,503);
 assert.match(schedulingFailure('synthetic database connection lost').error,/saved result/);
 assert.equal(schedulingFailure('CAPACITY_CONFLICT').status,409);
 assert.equal(schedulingFailure('SETUP_REQUIRED').status,409);
 assert.equal(schedulingFailure('FORBIDDEN').status,403);
 assert.equal(schedulingFailure('UNAUTHORIZED').status,401);
});
test('successful confirmation closes its panel and releases the parent navigation lock',async()=>{
 const busy=[];globalThis.fetch=async(path,init)=>response(init?.method?{result:{id,status:'reserved'},delivery:null}:context);
 const root=createRoot(node),onBusy=value=>busy.push(value);
 function Harness(){const [open,setOpen]=React.useState(true);return open?React.createElement(Scheduling,{organization:org,requestId:id,appointmentId:id,initialExpanded:true,onBusy,completed:()=>setOpen(false)}):React.createElement('p',null,'Confirmed');}
 try{
  await act(async()=>{root.render(React.createElement(Harness));await tick();await tick();});
  await act(async()=>{node.querySelector('form').requestSubmit();await tick();await tick();});
  assert.equal(node.textContent,'Confirmed');assert.ok(busy.includes(true));assert.equal(busy.at(-1),false);
 }finally{await act(async()=>root.unmount());}
});
