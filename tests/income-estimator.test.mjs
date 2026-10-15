import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://test.example.invalid/owner/taxes?organization=20000000-0000-4000-8000-000000000001'});
for(const key of ['window','document','location','HTMLElement','HTMLInputElement','HTMLFormElement','Event','MouseEvent','FormData'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const React=require('react');globalThis.React=React;
const {createRoot}=require('react-dom/client');const {act}=React;
const {default:Taxes}=await import('../apps/web/app/owner/taxes/page.tsx');
const {default:Estimator}=await import('../apps/web/app/owner/taxes/income-estimator.tsx');
const node=document.querySelector('#root'),tick=()=>new Promise(resolve=>setImmediate(resolve));
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
const button=text=>[...node.querySelectorAll('button')].find(b=>b.textContent===text);
const setValue=(element,value)=>{const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);element.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
test('owner calculates current-state tax, reviews the copied plan and explicitly publishes once',async()=>{
 let profile=null;const saves=[];
 globalThis.fetch=async(path,init)=>{
  if(String(path).startsWith('/api/configuration'))return Response.json({configuration:{settings:{region:'IL'}}});
  if(init?.method==='POST'){const body=JSON.parse(init.body);saves.push(body);profile={version:1,data:body.data};return Response.json({result:{version:1}});}
  return Response.json({profile,records:[],invoices:[],timezone:'America/Chicago',today:'2026-10-13',canEdit:true});
 };
 const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(Taxes));await tick();await tick();});
  const form=node.querySelector('[name=taxableIncomeCents]').closest('form');
  await act(async()=>setValue(form.querySelector('select'),'single'));
  for(const [key,value] of Object.entries({taxableIncomeCents:'65000',netProfitCents:'100000',stateBaseIncomeCents:'100000',stateExemptionsCents:'5000'}))form.querySelector(`[name=${key}]`).value=value;
  await act(async()=>form.querySelector('[type=checkbox]').click());
  await act(async()=>form.requestSubmit());assert.match(node.textContent,/\$23,141.55/);assert.match(node.textContent,/\$4,702.50/);assert.equal(saves.length,0);
  await act(async()=>button('Use estimate in setup for review').click());
  const setup=node.querySelector('[name=federal]').closest('form');assert.equal(setup.closest('details').open,true);
  assert.equal(setup.querySelector('[name=federal]').value,'23141.55');assert.equal(setup.querySelector('[name=statePayment]').value,'4702.50');assert.equal(setup.querySelector('[name=state]').value,'IL');
  assert.match(setup.querySelector('[name=reviewNote]').value,/ilExemptions=500000/);assert.ok(setup.querySelector('[name=reviewNote]').value.length<=500);
  await act(async()=>setup.querySelector('[type=checkbox]').click());await act(async()=>{setup.requestSubmit();await tick();await tick();});
  assert.equal(saves.length,1);assert.equal(saves[0].data.federalAnnualPaymentCents,2314155);assert.equal(profile.data.stateAnnualPaymentCents,470250);assert.match(node.textContent,/2026 installment 4/);
 }finally{await act(async()=>root.unmount());}
});
test('unsupported state/year cannot calculate or reuse Illinois rates',async()=>{
 const root=createRoot(node);try{
  for(const [state,year] of [['GA',2026],['IL',2027],['',2026]]){
   await act(async()=>root.render(React.createElement(Estimator,{key:state+year,state,year,canEdit:true,onUse:()=>assert.fail('Unsupported estimate')})));
   assert.equal(node.querySelector('form'),null);assert.match(node.textContent,/not verified|Not set/);
  }
 }finally{await act(async()=>root.unmount());}
});
test('changing an input removes the prior result and its copy action',async()=>{
 const root=createRoot(node);try{
  await act(async()=>root.render(React.createElement(Estimator,{state:'IL',year:2026,canEdit:true,onUse:()=>{}})));
  const form=node.querySelector('form');await act(async()=>setValue(form.querySelector('select'),'single'));
  for(const input of form.querySelectorAll('input:not([type=checkbox])'))input.value='0';await act(async()=>form.querySelector('[type=checkbox]').click());await act(async()=>form.requestSubmit());assert.ok(button('Use estimate in setup for review'));
  await act(async()=>setValue(form.querySelector('select'),'joint'));assert.equal(button('Use estimate in setup for review'),undefined);
 }finally{await act(async()=>root.unmount());}
});
