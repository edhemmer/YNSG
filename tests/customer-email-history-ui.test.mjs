import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/owner'});for(const name of ['window','document','HTMLElement','Event','MouseEvent'])globalThis[name]=dom.window[name];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;const {createRoot}=require('react-dom/client'),{act}=React;
const {default:Emails}=await import('../apps/web/app/customer-email-history.tsx');
const org='20000000-0000-4000-8000-000000000001',customer='30000000-0000-4000-8000-000000000001',node=document.querySelector('#root');
const tick=()=>new Promise(r=>setTimeout(r,0));
const items=Array.from({length:10},(_,i)=>({channel:i===1?'marketing':'service',kind:i===1?'welcome':i===0?'request.declined':'invoice.delivery',state:i===0?'not_delivered':'sent',at:new Date(Date.UTC(2026,10,17-i,15)).toISOString(),clickedAt:i===1?'2026-11-17T16:00:00.000Z':null}));
const ok=()=>Response.json({items,total:10,checkedAt:'2026-11-18T12:00:00.000Z'});
test('customer email history lists service and marketing emails with plain names, status and a retry',async()=>{
 let failed=true;const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,init});if(failed){failed=false;return new Response('{}',{status:503});}return ok();};const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(Emails,{organization:org,customer,timezone:'America/Chicago'}));await tick();});
  assert.match(node.textContent,/could not be loaded/);
  await act(async()=>{[...node.querySelectorAll('button')].find(b=>b.textContent==='Try again').click();await tick();await tick();});
  assert.match(node.textContent,/10 emails/);
  assert.match(node.textContent,/Request declined.*Not delivered/);
  assert.match(node.textContent,/Welcome.*Marketing series.*Clicked/);
  assert.match(node.textContent,/Invoice sent/);
  assert.equal(node.querySelectorAll('.marketing-recent li').length,8,'long histories start short');
  await act(async()=>{[...node.querySelectorAll('button')].find(b=>b.textContent==='Show all 10').click();await tick();});
  assert.equal(node.querySelectorAll('.marketing-recent li').length,10);
  assert.ok(calls.every(c=>String(c.url).startsWith('/api/customer-email-history?')&&!c.init?.method),'read-only GETs only');
  assert.ok(calls.every(c=>new URL(String(c.url),'https://x.invalid').searchParams.get('customer')===customer));
 }finally{act(()=>root.unmount());}
});
test('customer insights moved from Marketing into the Customers area, with email history on each customer',()=>{
 const workspace=readFileSync('apps/web/app/workspace.tsx','utf8'),records=readFileSync('apps/web/app/customer-records.tsx','utf8');
 assert.doesNotMatch(workspace,/CustomerServiceInsights/);
 assert.match(records,/\{!selected&&!editor&&!practice&&<CustomerServiceInsights[^>]*onCustomer=\{id=>choose\(id\)\}/);
 assert.match(records,/<CustomerEmailHistory key=\{'emails:'\+organization\+':'\+detail\.customer\.id\}/);
});
