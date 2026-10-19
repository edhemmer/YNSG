import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.invalid/platform'});
for(const key of ['window','document','HTMLElement','Event','MouseEvent'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const React=require('react');globalThis.React=React;
const {act}=React,{createRoot}=require('react-dom/client');
const {default:Platform}=await import('../apps/web/app/platform/panel.tsx');
const {default:RouteCalendar}=await import('../apps/web/app/route-calendar.tsx');
const tick=()=>new Promise(r=>setImmediate(r));
const host=document.querySelector('#root');
test('platform failed read offers retry and successful empty read is explicit with locked paging',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(calls===1?{error:'Unavailable'}:{owners:[],hasMore:false},{status:calls===1?503:200});};
 const root=createRoot(host);
 try{await act(async()=>{root.render(React.createElement(Platform));await tick();});
 assert.ok(host.querySelector('[role=alert]'));assert.equal([...host.querySelectorAll('button')].find(b=>b.textContent==='Next').disabled,true);
 const retry=[...host.querySelectorAll('button')].find(b=>b.textContent==='Try owner accounts again');assert.ok(retry);
 await act(async()=>{retry.click();await tick();});assert.equal(calls,2);assert.match(host.textContent,/No owner accounts on this page/);assert.equal(host.querySelector('[role=alert]'),null);
 }finally{await act(async()=>root.unmount());}
});
test('route calendar failure describes unavailable counts rather than permanent loading and preserves day selection',async()=>{
 globalThis.fetch=async()=>Response.json({error:'Unavailable'},{status:503});let selected='';const root=createRoot(host);
 try{await act(async()=>{root.render(React.createElement(RouteCalendar,{organization:'synthetic',date:'2026-10-18',timezone:'America/Chicago',onSelect:d=>selected=d,revision:0}));await tick();});
 assert.ok(host.querySelector('[role=alert]'));assert.equal(host.querySelector('[role=status]'),null);
 const day=host.querySelector('button[aria-label="2026-10-19, visit counts unavailable"]');assert.ok(day);await act(async()=>day.click());assert.equal(selected,'2026-10-19');
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
