import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner/practice'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLFormElement','Event','MouseEvent','FormData','sessionStorage','localStorage'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.confirm=()=>true;
window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;
const {act}=React,{createRoot}=require('react-dom/client');
const {default:Practice}=await import('../apps/web/app/practice-workspace.tsx');
const {resetBrowserPractice,getBrowserPractice,PRACTICE_ORG}=await import('../apps/web/lib/practice-store.ts');
const {sessionFetch}=await import('../apps/web/lib/session-fetch.ts');
const node=document.querySelector('#root'),tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let n=0;n<5;n++)await tick();}
async function click(text){await act(async()=>{const b=[...node.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,'button '+text+'\n'+node.textContent);assert.equal(b.disabled,false,text);b.click();await settle();});}
async function input(name,value){const el=node.querySelector(`[name="${name}"]`);assert.ok(el,name);await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,value);el.dispatchEvent(new window.Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await tick();});}
async function until(predicate,label){const deadline=Date.now()+5000;while(!predicate()&&Date.now()<deadline)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});assert.ok(predicate(),label);}
async function mount(){resetBrowserPractice();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('PRACTICE REACHED NETWORK');};const root=createRoot(node);await act(async()=>{root.render(React.createElement(Practice));await settle();});await until(()=>node.querySelectorAll('.request-summary-card').length===6,'All sample cards loaded');return {close:()=>act(async()=>root.unmount()),calls:()=>calls};}
async function openSample(name){const card=[...node.querySelectorAll('article')].find(a=>a.textContent.includes(name));assert.ok(card,name);await act(async()=>{card.querySelector('button').click();await settle();});}
test('real request and job screens work with sample data and never reach production',async()=>{
 const h=await mount();try{
  assert.equal(node.querySelectorAll('.request-summary-card').length,6);assert.match(node.textContent,/simulated responses/);
  await openSample('Sample — Scheduled visit');assert.match(node.textContent,/Customer’s note/);assert.match(node.textContent,/Pending invoice/);
  await click('Start work');assert.match(node.textContent,/Work in progress/);
  await click('Pause timer');assert.match(node.textContent,/Work paused/);await click('Resume timer');assert.match(node.textContent,/Work in progress/);
  await click('All sample visits');assert.equal(node.querySelectorAll('.request-summary-card').length,6);assert.equal(h.calls(),0);
 }finally{await h.close();}
});
test('partial payment screen accepts a sample receipt and shows exact paid closeout without network',async()=>{
 const h=await mount();try{
  await openSample('Sample — Partial payment');assert.match(node.textContent,/Remaining balance\$60.00/);
  await input('reference','Practice Zelle receipt');
  await act(async()=>{const checkbox=[...node.querySelectorAll('input[type="checkbox"]')].find(c=>c.parentElement.textContent.includes('confirmed the money'));checkbox.click();await tick();});
  await click('Record received payment');assert.match(node.textContent,/No payment remains due/);assert.match(node.textContent,/Closed out/);
  assert.equal(getBrowserPractice().document(getBrowserPractice().snapshot().invoices[0].id).balanceCents,0);
  const anchor=[...node.querySelectorAll('a')].find(a=>a.textContent.includes('Open invoice'));await act(async()=>{anchor.click();await settle();});assert.match(node.textContent,/SAMPLE/);assert.ok([...node.querySelectorAll('button')].some(b=>b.textContent==='Back to sample visit'));assert.equal(h.calls(),0);
 }finally{await h.close();}
});
test('practice prevents real calls and unknown operations and reset restores samples',async()=>{
 const h=await mount();try{
  await openSample('Sample — New request');const anchor=[...node.querySelectorAll('a')].find(a=>a.textContent==='Call');await act(async()=>{anchor.click();await settle();});assert.match(node.textContent,/Calls, maps/);
  const r=await sessionFetch('/api/invoice-delivery',{method:'POST',body:JSON.stringify({organization:PRACTICE_ORG,key:crypto.randomUUID()})});assert.equal(r.status,409);
  await click('Reset sample data');assert.equal(node.querySelectorAll('.request-summary-card').length,6);assert.equal(h.calls(),0);
 }finally{await h.close();}
});
test('work recording through invoice issue and document uses the real connected components',async()=>{
 const h=await mount();try{
  await openSample('Sample — Work in progress');await click('Finish work');
  const minutes=[...node.querySelectorAll('label')].find(l=>l.textContent.trim()==='Actual minutes recorded')?.querySelector('input');assert.ok(minutes);
  await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(minutes),'value').set.call(minutes,'120');minutes.dispatchEvent(new Event('input',{bubbles:true}));await tick();});
  await act(async()=>{const review=[...node.querySelectorAll('input[type="checkbox"]')].find(c=>c.parentElement.textContent.includes('The work is finished'));assert.ok(review);review.click();await tick();});
  await click('Save work & complete visit');assert.match(node.textContent,/Review & issue invoice/);
  await click('Approve and issue invoice');assert.match(node.textContent,/Invoice /);assert.ok([...node.querySelectorAll('a')].some(a=>a.textContent.includes('Open invoice')));assert.equal(h.calls(),0);
 }finally{await h.close();}
});
test('scheduling and estimate agreement are operable with sample data',async()=>{
 const h=await mount();try{
  await openSample('Sample — New request');await click('Confirm appointment');
  await until(()=>[...document.querySelectorAll('select[name="visitTime"] option')].some(option=>option.value),'Appointment time choices load');
  const start=node.querySelector('select[name="visitTime"]');assert.ok(start);const option=[...start.options].find(o=>o.value);assert.ok(option);
  await input('visitTime',option.value);await click('Schedule appointment');assert.match(node.textContent,/Work, price & customer approval/);
  assert.doesNotMatch(node.textContent,/Google Calendar update queued/);
  await click('Save labor estimate');await until(()=>node.textContent.includes('How did the customer agree'),'Agreement form becomes available after estimate save');await input('evidence','Practice only: fictional agreement for this sample.');await click('Record customer agreement');assert.ok(getBrowserPractice().snapshot().jobs.some(j=>j.status==='approved'||j.status==='scheduled'));assert.equal(h.calls(),0);
 }finally{await h.close();}
});
test('customer screen shows editable sample contacts and hides unavailable external actions',async()=>{
 const h=await mount();try{
  await click('Customers');assert.match(node.textContent,/Sample — New request/);
  const card=[...node.querySelectorAll('button')].find(b=>b.querySelector('strong')?.textContent==='Sample — New request');assert.ok(card);await act(async()=>{card.click();await settle();});
  await until(()=>node.textContent.includes('sample1@example.invalid'),'Sample contact details loaded');assert.match(node.textContent,/sample1@example.invalid/);assert.match(node.textContent,/Account invitations, delegates, attachments and file transfers are disabled/);assert.equal(node.querySelector('input[type="file"]'),null);assert.equal(h.calls(),0);
 }finally{await h.close();}
});
