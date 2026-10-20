import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid/owner'});for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Event','MouseEvent','FormData','sessionStorage','localStorage'])globalThis[key]=dom.window[key];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)),React=require('react');globalThis.React=React;const {act}=React,{createRoot}=require('react-dom/client');const {default:Workspace}=await import('../apps/web/app/workspace.tsx');const node=document.querySelector('#root');const tick=()=>new Promise(r=>setImmediate(r));
async function click(label){await act(async()=>{const b=[...node.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);b.click();await tick();});}
test('owner entry restores saved access first and exposes password/reset without sending email implicitly',async()=>{
 const calls=[];globalThis.fetch=async(path,init)=>{calls.push({path,body:init?.body});return Response.json({error:'Sign in to continue.'},{status:401});};
 const root=createRoot(node);try{
 await act(async()=>{root.render(React.createElement(Workspace,{configured:true,initialEmail:'test@example.invalid',ownerGoogle:{enabled:false}}));for(let n=0;n<5;n++)await tick();});
 assert.ok(node.textContent.includes('Owner sign in'));
 const password=node.querySelector('input[autocomplete="current-password"]');assert.equal(password.type,'password');
 await click('Show password');assert.equal(password.type,'text');assert.equal(node.querySelector('button[aria-controls="new-owner-password"]').getAttribute('aria-pressed'),'true');
 await click('Hide password');assert.equal(password.type,'password');
 await click('Forgot password');assert.ok(node.textContent.includes('Send password reset'));assert.equal(node.querySelector('input[autocomplete="current-password"]'),null);
 assert.equal(calls.some(x=>x.body&&['send','recover'].includes(JSON.parse(x.body).action)),false);
 await click('Back to sign in');assert.ok(node.querySelector('input[type=password]'));
 }finally{await act(async()=>root.unmount());}
});
test('password success loads authorized owner membership without requesting mail',async()=>{
 let signed=false;const actions=[];globalThis.fetch=async(path,init)=>{
  if(init?.body){const value=JSON.parse(init.body);actions.push(value);if(value.action==='password'){signed=true;return Response.json({ok:true});}}
  if(path==='/api/session')return signed?Response.json({email:'test@example.invalid',memberships:[{organization_id:'20000000-0000-4000-8000-000000000001',role:'owner'}]}):Response.json({error:'Sign in to continue.'},{status:401});
  return Response.json({error:'Synthetic workspace unavailable'},{status:503});
 };const root=createRoot(node);try{
 await act(async()=>{root.render(React.createElement(Workspace,{configured:true,initialEmail:'test@example.invalid'}));for(let n=0;n<5;n++)await tick();});
 await act(async()=>{const input=node.querySelector('input[autocomplete="current-password"]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'synthetic-password');input.dispatchEvent(new Event('input',{bubbles:true}));await tick();});
 await act(async()=>{node.querySelector('form[aria-label="Owner sign in"]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));for(let n=0;n<8;n++)await tick();});
 assert.ok(node.querySelector('button[aria-label="Sign out"]'));assert.ok(node.textContent.includes('Your sign-in is complete'));assert.deepEqual(actions.map(a=>a.action).filter(a=>a!=='refresh'),['password']);
 }finally{await act(async()=>root.unmount());}
});
test('reset submits the recovery action only once and rate limits stay actionable',async()=>{
 for(const limited of [true,false]){
  const actions=[];globalThis.fetch=async(path,init)=>{if(init?.body){const value=JSON.parse(init.body);actions.push(value.action);if(value.action==='recover')return limited?Response.json({error:'Password reset email was not sent because the email provider has reached its sending limit. You can still sign in with your existing password. Please wait before requesting another reset.'},{status:429}):Response.json({ok:true});}return Response.json({error:'Sign in to continue.'},{status:401});};
  const root=createRoot(node);try{
   await act(async()=>{root.render(React.createElement(Workspace,{configured:true,initialEmail:'test@example.invalid'}));for(let n=0;n<5;n++)await tick();});await click('Forgot password');
   await act(async()=>{node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));for(let n=0;n<3;n++)await tick();});
   assert.equal(actions.filter(a=>a==='recover').length,1);assert.equal(actions.includes('send'),false);
   if(limited)assert.match(node.querySelector('[role=alert]').textContent,/was not sent/);else{assert.match(node.querySelector('[role=status]').textContent,/reset requested/);assert.ok([...node.querySelectorAll('button')].find(b=>b.textContent==='Reset email requested').disabled);}
   await click('Back to sign in');assert.ok(node.querySelector('input[type=password]'));
  }finally{await act(async()=>root.unmount());}
 }
});
test('canceling sign-out preserves the session and explicit confirmation sends one logout',async()=>{
 let logout=0;globalThis.fetch=async(path,init)=>{if(init?.body&&JSON.parse(init.body).action==='logout'){logout++;return Response.json({ok:true});}return Response.json({email:'test@example.invalid',memberships:[]});};window.confirm=()=>false;const root=createRoot(node);try{
 await act(async()=>{root.render(React.createElement(Workspace,{configured:true}));for(let n=0;n<5;n++)await tick();});
 const out=node.querySelector('button[aria-label="Sign out"]');assert.ok(out);await act(async()=>{out.click();await tick();});assert.equal(logout,0);assert.ok(node.querySelector('button[aria-label="Sign out"]'));
 window.confirm=()=>true;await act(async()=>{out.click();for(let n=0;n<3;n++)await tick();});assert.equal(logout,1);assert.ok(node.textContent.includes('Owner sign in'));
 }finally{await act(async()=>root.unmount());}
});

test('authenticated owner reaches inbox, opens full request and reviews branded decline without sending',async()=>{
 const org='a933d657-14d3-46b6-85e6-21d973e4ed97',id='50000000-0000-4000-8000-000000000001';
 const request={id,customer_id:null,status:'submitted',revision:1,created_at:'2026-10-19T12:00:00Z',appointments:[],original_submission:{name:'Synthetic Neighbor',email:'synthetic@example.invalid',phone:'202-555-0148',street:'100 Example Street',city:'DeKalb',description:'Synthetic full note for incident recovery verification.',services:[{service:'Home tasks',task:'Furniture assembly'}]}};
 const data={brand:null,company:{id:org,display_name:'Your Neighborhood Service Guy',timezone:'America/Chicago',status:'active'},requests:[request],customers:[],quotes:[],jobs:[],invoices:[],invoiceAdmin:{},outbox:[],appointments:[],schedulingPreferences:[],pagination:{page:0,hasMore:false,appointmentFrom:'2026-10-19'}};
 const inbox={requests:[request],quotes:[],jobs:[],invoices:[],preferences:[],total:1,needsReview:1,page:0,hasMore:false,checkedAt:'2026-10-19T12:00:00Z'};
 let signed=false;const writes=[];globalThis.fetch=async(path,init)=>{
  if(init?.method==='POST'){const action=JSON.parse(init.body);writes.push({path,action});if(action.action==='password'){signed=true;return Response.json({ok:true});}return Response.json({error:'No business writes allowed in this test'},{status:403});}
  if(path==='/api/session')return signed?Response.json({email:'owner@example.invalid',memberships:[{organization_id:org,role:'owner'}]}):Response.json({error:'Sign in to continue.'},{status:401});
  if(path.startsWith('/api/workspace?'))return Response.json(data);
  if(path.startsWith('/api/request-inbox?'))return Response.json(inbox);
  return Response.json({error:'Synthetic optional provider unavailable'},{status:503});
 };
 window.history.replaceState(null,'','/owner?section=Requests');const root=createRoot(node);
 try{
  await act(async()=>{root.render(React.createElement(Workspace,{configured:true,initialEmail:'owner@example.invalid'}));for(let n=0;n<6;n++)await tick();});
  await act(async()=>{node.querySelector('form[aria-label="Owner sign in"]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));for(let n=0;n<10;n++)await tick();});
  assert.match(node.querySelector('.request-summary-card').textContent,/Synthetic Neighbor/);
  await click('Decline');const reason=node.querySelector('.quick-decision select');await act(async()=>{reason.value='service';reason.dispatchEvent(new Event('change',{bubbles:true}));await tick();});
  assert.match(node.querySelector('.quick-decision textarea').value,/outside the services/);assert.match(node.querySelector('.quick-decision').textContent,/future project/);assert.match(node.querySelector('.quick-decision').textContent,/Confirm decline/);
  await click('Cancel');await act(async()=>{node.querySelector('.request-summary-card .secondary').click();for(let n=0;n<6;n++)await tick();});
  assert.match(node.textContent,/Synthetic full note for incident recovery verification/);
  assert.ok(writes.every(w=>w.path==='/api/session'));assert.deepEqual(writes.map(w=>w.action.action).filter(a=>a!=='refresh'),['password']);
 }finally{await act(async()=>root.unmount());window.history.replaceState(null,'','/owner');}
});
