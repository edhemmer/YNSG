import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/owner'});for(const k of ['window','document','HTMLElement','Event','MouseEvent'])globalThis[k]=dom.window[k];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;const {act}=React,{createRoot}=require('react-dom/client');const {default:Queue}=await import('../apps/web/app/command-center.tsx');const node=document.querySelector('#root'),tick=()=>new Promise(r=>setImmediate(r)),organization='20000000-0000-4000-8000-000000000001',request='41000000-0000-4000-8000-000000000001',other='41000000-0000-4000-8000-000000000002';
const pending=(id,name)=>({id,status:'submitted',original_submission:{name,service:'Home help'},appointments:[]});
test('featured request appears once while separate decisions for an active job stay visible',async()=>{for(const working of [false,true]){const root=createRoot(node);const requests=[pending(request,'Synthetic First'),pending(other,'Synthetic Second')];globalThis.fetch=async path=>Response.json(String(path).includes('owner-day')?{checkedAt:new Date().toISOString(),timezone:'America/Chicago',calls:[],hasMore:false}:String(path).includes('owner-work')?{checkedAt:new Date().toISOString(),page:0,hasMore:false,total:working?1:0,items:working?[{job:other,request,name:'Synthetic First',address:'100 Test Street',tasks:['Shelf'],status:'working'}]:[]}:{total:2,hasMore:false,requests});try{await act(async()=>{root.render(React.createElement(Queue,{organization,timezone:'America/Chicago',revision:1,onOpen:()=>{},onNavigate:()=>{}}));await tick();await tick();});const rows=[...node.querySelectorAll('.field-queue-row')];assert.equal(rows.length,working?2:1);assert.equal(rows.some(r=>r.textContent.includes('Synthetic Second')),true);assert.equal(rows.some(r=>r.textContent.includes('Synthetic First')),working);assert.match(node.textContent,/Why this is next/);assert.equal(node.querySelector('section[aria-label="Current job"]')!==null,working);}finally{await act(async()=>root.unmount());}}});

test('Today hides nonessential search and empty review blocks while preserving direct field actions',async()=>{
 const root=createRoot(node);let opened='';
 const requests=[{...pending(request,'Synthetic Customer'),original_submission:{name:'Synthetic Customer',phone:'770-630-2094',service:'Home help'}}];
 globalThis.fetch=async path=>Response.json(String(path).includes('owner-day')?
  {checkedAt:new Date().toISOString(),timezone:'America/Chicago',calls:[],hasMore:false}:
  String(path).includes('owner-work')?
  {checkedAt:new Date().toISOString(),page:0,hasMore:false,total:0,items:[]}:
  {total:1,hasMore:false,requests});
 try{
  await act(async()=>{root.render(React.createElement(Queue,{organization,timezone:'America/Chicago',revision:2,onOpen:id=>{opened=id;},onNavigate:()=>{}}));await tick();await tick();});
  const finder=node.querySelector('details.field-search-disclosure');
  assert.ok(finder,'Search remains available without taking initial screen space');
  assert.equal(finder.hasAttribute('open'),false,'Search should be closed on entering Today');
  const main=node.querySelector('section[aria-label="Next request decision"]');
  assert.ok(main,'Decision must remain immediately actionable');
  const call=main.querySelector('a[href^="tel:"]');
  assert.ok(call,'A validated phone is available with one tap');
  assert.match(call.getAttribute('href'),/7706302094/);
  assert.equal(node.querySelectorAll('section[aria-label="Requests awaiting a decision"] .field-queue-row').length,0,'The featured decision must not be repeated');
  await act(async()=>{main.querySelector('button').click();});
  assert.equal(opened,request);
 }finally{await act(async()=>root.unmount());}
});

test('Today skips the empty decision panel and keeps search available',async()=>{
 const root=createRoot(node);
 globalThis.fetch=async path=>Response.json(String(path).includes('owner-day')?
  {checkedAt:new Date().toISOString(),timezone:'America/Chicago',calls:[],hasMore:false}:
  String(path).includes('owner-work')?
  {checkedAt:new Date().toISOString(),page:0,hasMore:false,total:0,items:[]}:
  {total:0,hasMore:false,requests:[]});
 try{
  await act(async()=>{root.render(React.createElement(Queue,{organization,timezone:'America/Chicago',revision:3,onOpen:()=>{},onNavigate:()=>{}}));await tick();await tick();});
  assert.equal(node.querySelector('section[aria-label="Requests awaiting a decision"]'),null);
  assert.ok(node.querySelector('details.field-search-disclosure summary'));
  assert.match(node.textContent,/No unfinished work/);
 }finally{await act(async()=>root.unmount());}
});
