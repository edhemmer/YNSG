import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent','FormData','sessionStorage','localStorage'])globalThis[key]=dom.window[key];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;const {act}=React,{createRoot}=require('react-dom/client');const {default:Workspace}=await import('../apps/web/app/workspace.tsx');const node=document.querySelector('#root');const tick=()=>new Promise(r=>setImmediate(r));
async function click(label){await act(async()=>{const b=[...node.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);b.click();await tick();});}
test('owner signs in with email code or Google without a password',async()=>{
 const calls=[];globalThis.fetch=async(path,init)=>{calls.push({path,body:init?.body});return init?.body&&JSON.parse(init.body).action==='send'?Response.json({ok:true}):Response.json({error:'Sign in to continue.'},{status:401});};
 const root=createRoot(node);try{
 await act(async()=>{root.render(React.createElement(Workspace,{configured:true,initialEmail:'test@example.invalid',ownerGoogle:{enabled:true}}));for(let n=0;n<5;n++)await tick();});
 assert.ok(node.textContent.includes('Continue with Google'));
 assert.ok(node.textContent.includes('Email me a sign-in code'));
 assert.equal(node.querySelector('input[type=password]'),null);
 await act(async()=>{node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));for(let n=0;n<3;n++)await tick();});
 assert.ok(node.textContent.includes('One-time email code'));
 assert.equal(JSON.parse(calls.find(c=>c.body&&JSON.parse(c.body).action==='send').body).destination,'owner');
 }finally{await act(async()=>root.unmount());}
});
test('canceling sign-out preserves the session and explicit confirmation sends one logout',async()=>{
 let logout=0;globalThis.fetch=async(path,init)=>{if(init?.body&&JSON.parse(init.body).action==='logout'){logout++;return Response.json({ok:true});}return Response.json({email:'test@example.invalid',memberships:[]});};window.confirm=()=>false;const root=createRoot(node);try{
 await act(async()=>{root.render(React.createElement(Workspace,{configured:true}));for(let n=0;n<5;n++)await tick();});
 const out=node.querySelector('button[aria-label="Sign out"]');assert.ok(out);await act(async()=>{out.click();await tick();});assert.equal(logout,0);assert.ok(node.querySelector('button[aria-label="Sign out"]'));
 window.confirm=()=>true;await act(async()=>{out.click();for(let n=0;n<3;n++)await tick();});assert.equal(logout,1);assert.ok(node.textContent.includes('Email me a sign-in code'));
 }finally{await act(async()=>root.unmount());}
});
