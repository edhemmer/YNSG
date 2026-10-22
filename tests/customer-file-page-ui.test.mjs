import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});
for(const key of ['window','document','HTMLElement'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');
globalThis.React=React;
const {act}=React,{createRoot}=require('react-dom/client');
const {useCustomerFilePage}=await import('../apps/web/app/use-customer-file-page.ts');
const organization='20000000-0000-4000-8000-000000000001',customer='30000000-0000-4000-8000-000000000001',otherCustomer='30000000-0000-4000-8000-000000000002',job='40000000-0000-4000-8000-000000000001';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function pageFor(path){
 const query=new URL(path,'https://example.invalid').searchParams;
 return {organization:query.get('organization'),customer:query.get('customer'),cursor:null,jobs:query.get('jobs')?.split(',')||[],invoices:[],files:[],hasMore:false,nextCursor:null};
}
async function mount(fetcher,props={}){
 globalThis.fetch=fetcher;let latest;
 function Probe(input){latest=useCustomerFilePage(input.organization,input.customer,{...(input.job?{jobs:input.job}:{})},input.autoLoad);return React.createElement('output',null,latest.page?.customer||'No verified page');}
 const root=createRoot(document.querySelector('#root'));
 const render=async(extra={})=>{await act(async()=>{root.render(React.createElement(Probe,{organization,customer,autoLoad:true,...props,...extra}));await tick();await tick();});};
 await render();
 return {render,current:()=>latest,close:()=>act(async()=>root.unmount())};
}

test('equivalent file filters and ordinary renders reuse one read; changed scope loads fresh data',async()=>{
 const reads=[];
 const h=await mount(async(path,init)=>{assert.equal(init?.method,undefined);reads.push(path);return Response.json(pageFor(path));},{job});
 try{
  assert.equal(h.current().page.customer,customer);assert.equal(reads.length,1);
  await h.render({job});await h.render({job});assert.equal(reads.length,1);
  await h.render({customer:otherCustomer,job});assert.equal(reads.length,2);assert.equal(h.current().page.customer,otherCustomer);
 }finally{await h.close();}
});

test('a late file read cannot restore the prior customer after scope changes or unmount',async()=>{
 const pending=[];
 const h=await mount(path=>new Promise(resolve=>pending.push({path,resolve})));
 try{
  assert.equal(pending.length,1);
  await h.render({customer:otherCustomer});assert.equal(pending.length,2);assert.equal(h.current().page,null);
  await act(async()=>{pending[1].resolve(Response.json(pageFor(pending[1].path)));await tick();});
  assert.equal(h.current().page.customer,otherCustomer);
  await act(async()=>{pending[0].resolve(Response.json(pageFor(pending[0].path)));await tick();});
  assert.equal(h.current().page.customer,otherCustomer);
  await h.render({customer});assert.equal(pending.length,3);
 }finally{await h.close();}
 await act(async()=>{pending[2].resolve(Response.json(pageFor(pending[2].path)));await tick();});
});

test('manual file tools stay idle on scope changes and refresh only the selected scope',async()=>{
 const reads=[];
 const h=await mount(async path=>{reads.push(path);return Response.json(pageFor(path));},{autoLoad:false});
 try{
  assert.equal(reads.length,0);assert.equal(h.current().loading,false);
  await act(async()=>{await h.current().refresh();});assert.equal(reads.length,1);assert.equal(h.current().page.customer,customer);
  await h.render({customer:otherCustomer});assert.equal(reads.length,1);assert.equal(h.current().page,null);assert.equal(h.current().loading,false);
  await act(async()=>{await h.current().refresh();});assert.equal(reads.length,2);assert.equal(h.current().page.customer,otherCustomer);
 }finally{await h.close();}
});
