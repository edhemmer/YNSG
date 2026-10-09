import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionFetch} from '../apps/web/lib/session-fetch.js';
const result=(status=200)=>new Response('{}',{status});

test('expired sessions renew once for concurrent requests without sending email',async()=>{
 let renewed=false,refreshes=0;const actions:string[]=[];
 const request=createSessionFetch(async(path,init)=>{
  if(init?.method==='POST'&&path==='/api/session'){
   const action=JSON.parse(String(init.body)).action;actions.push(action);refreshes++;
   await new Promise(r=>setTimeout(r,5));renewed=true;return result();
  }
  return result(renewed?200:401);
 });
 const responses=await Promise.all([request('/api/session'),request('/api/workspace')]);
 assert.ok(responses.every(r=>r.ok));assert.equal(refreshes,1);assert.deepEqual(actions,['refresh']);
});

test('valid returning sessions do not refresh or send emails',async()=>{
 let calls=0;const request=createSessionFetch(async()=>{calls++;return result();});
 assert.ok((await request('/api/session')).ok);assert.equal(calls,1);
});

test('403 and ambiguous failures never replay a mutation',async()=>{
 for(const status of [403,409,500,503]){
  let calls=0;const request=createSessionFetch(async()=>{calls++;return result(status);});
  assert.equal((await request('/api/commands',{method:'POST',body:'{"key":"stable"}'})).status,status);assert.equal(calls,1);
 }
});

test('only authentication rejection retries a mutation, preserving its body',async()=>{
 let renewed=false;const bodies:(BodyInit|null|undefined)[]=[];
 const request=createSessionFetch(async(path,init)=>{
  if(path==='/api/session'&&init?.method==='POST'){renewed=true;return result();}
  if(path==='/api/session')return result(401);
  bodies.push(init?.body);return result(renewed?200:401);
 });
 await request('/api/commands',{method:'POST',body:'{"key":"unchanged"}'});
 assert.deepEqual(bodies,['{"key":"unchanged"}','{"key":"unchanged"}']);
});

test('temporary refresh failure is returned without replaying the operation',async()=>{
 let operations=0;const request=createSessionFetch(async(path,init)=>{
  if(path==='/api/session'&&init?.method==='POST')return result(503);
  if(path!=='/api/session')operations++;return result(401);
 });
 assert.equal((await request('/api/commands',{method:'POST',body:'{}'})).status,503);assert.equal(operations,1);
});

test('logout waits for pending renewal and prevents stale request revival',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});let started!:()=>void;
 const began=new Promise<void>(r=>{started=r;});const actions:string[]=[];
 const request=createSessionFetch(async(path,init)=>{
  if(path==='/api/session'&&init?.method==='POST'){
   const action=JSON.parse(String(init.body)).action;actions.push(action);
   if(action==='refresh'){started();await gate;}return result();
  }
  return result(401);
 });
 const old=request('/api/workspace');await began;
 const logout=request('/api/session',{method:'POST',body:'{"action":"logout"}'});
 release();assert.equal((await old).status,401);await logout;
 await request('/api/workspace');assert.deepEqual(actions,['refresh','logout']);
});

test('password login after logout re-enables renewal only when login succeeds',async()=>{
 for(const accepted of [true,false]) {
  let renewed=false;const actions:string[]=[];
  const request=createSessionFetch(async(path,init)=>{
   if(path==='/api/session'&&init?.method==='POST') {
    const action=JSON.parse(String(init.body)).action;actions.push(action);
    if(action==='password') return result(accepted?200:400);
    if(action==='refresh') renewed=true;
    return result();
   }
   return result(renewed?200:401);
  });
  await request('/api/session',{method:'POST',body:'{"action":"logout"}'});
  await request('/api/session',{method:'POST',body:'{"action":"password"}'});
  assert.equal((await request('/api/workspace')).status,accepted?200:401);
  assert.equal(actions.includes('refresh'),accepted);
 }
});

test('password update renews an expired session before its single authenticated retry',async()=>{
 let renewed=false,updates=0;
 const request=createSessionFetch(async(path,init)=>{
  if(init?.method==='POST') {
   const action=JSON.parse(String(init.body)).action;
   if(action==='refresh'){renewed=true;return result();}
   if(action==='set-password'){updates++;return result(renewed?200:401);}
  }
  return result(401);
 });
 assert.ok((await request('/api/session',{method:'POST',body:'{"action":"set-password","password":"synthetic-test-password"}'})).ok);
 assert.equal(updates,2);
});
