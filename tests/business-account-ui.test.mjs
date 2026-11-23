import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/owner'});for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent'])globalThis[name]=dom.window[name];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;const {createRoot}=require('react-dom/client'),{act}=React;
const {BusinessAccountCard,BusinessPipelinePanel}=await import('../apps/web/app/business-account.tsx');
const org='20000000-0000-4000-8000-000000000001',customer='30000000-0000-4000-8000-000000000001',node=document.querySelector('#root');
const tick=()=>new Promise(r=>setTimeout(r,0));
const account={customerId:customer,displayName:'Synthetic Fellowship',accountType:'church_nonprofit',companyName:'Synthetic Fellowship',billingName:'Pat Treasurer',billingEmail:'billing@example.invalid',paymentTermsDays:15,approvalLimitCents:30000,stage:'walkthrough',nextAction:'Walk the building',followUpOn:'2026-01-05',lostReason:null,revision:1,updatedAt:'2026-11-23T12:00:00.000Z'};
const setValue=(el,value)=>{const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};

test('a homeowner can be made a business account with one exact, owner-only save',async()=>{
 const calls=[];let saved=null;
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});if(init?.method==='POST'){saved=JSON.parse(init.body);return Response.json({saved:true,customerId:customer,revision:1});}return Response.json({account:saved?{...account,accountType:saved.value.accountType,companyName:saved.value.companyName,stage:saved.value.stage,paymentTermsDays:saved.value.paymentTermsDays,approvalLimitCents:saved.value.approvalLimitCents}:null});};
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(BusinessAccountCard,{organization:org,customer,disabled:false}));await tick();});
  assert.match(node.textContent,/Homeowner/);
  await act(async()=>{[...node.querySelectorAll('button')].find(b=>b.textContent==='Make this a business account').click();await tick();});
  const selects=node.querySelectorAll('select'),inputs=node.querySelectorAll('input');
  await act(async()=>{setValue(selects[0],'church_nonprofit');setValue(inputs[0],'Synthetic Fellowship');setValue(selects[1],'30');setValue(inputs[3],'300');await tick();});
  await act(async()=>{node.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();});
  assert.equal(saved.revision,null,'a new profile is created with no revision');
  assert.equal(saved.value.accountType,'church_nonprofit');
  assert.equal(saved.value.paymentTermsDays,30);
  assert.equal(saved.value.approvalLimitCents,30000);
  assert.equal(saved.value.lostReason,null);
  assert.match(node.textContent,/Business account saved/);
  assert.match(node.textContent,/Net 30/);
  assert.match(node.textContent,/Ask before anything over \$300/);
  assert.ok(calls.filter(c=>c.init?.method==='POST').every(c=>c.url==='/api/business-accounts'));
 }finally{act(()=>root.unmount());}
});

test('pipeline shows due follow-ups first and opens the customer',async()=>{
 const opened=[];globalThis.fetch=async url=>{assert.match(String(url),/stage=open/);return Response.json({items:[account],hasMore:false,page:0,counts:{open:1,due:1,won:0,total:1}});};
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(BusinessPipelinePanel,{organization:org,onCustomer:id=>opened.push(id)}));await tick();await tick();});
  assert.match(node.textContent,/1 open · 1 follow-up due · 0 won/);
  assert.ok(node.querySelector('.business-due'),'a past follow-up date is flagged');
  await act(async()=>{node.querySelector('.business-list button').click();await tick();});
  assert.deepEqual(opened,[customer]);
 }finally{act(()=>root.unmount());}
});
