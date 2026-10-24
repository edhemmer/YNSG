import test from 'node:test';
import assert from 'node:assert/strict';
import {requestInput} from '../packages/contracts/index.ts';
import {ownerWorkResponse} from '../apps/web/lib/owner-work.ts';

test('oversized public service selections reject at the collection boundary',()=>{
 const result=requestInput.safeParse({
  name:'Synthetic Neighbor',phone:'5550100999',email:'test@example.invalid',
  street:'100 Synthetic Street',city:'DeKalb',communityRate:'No',
  services:Array(1000).fill(null),
 });
 assert.equal(result.success,false);
 if(result.success)throw Error('Oversized selection accepted');
 assert.deepEqual(result.error.issues.map(issue=>({code:issue.code,path:issue.path})),[
  {code:'too_big',path:['services']},
 ]);
});

test('oversized field queue responses reject without expanding per-record errors',()=>{
 const result=ownerWorkResponse.safeParse({
  checkedAt:'2026-10-24T12:00:00Z',page:0,hasMore:false,total:1000,items:Array(1000).fill(null),
 });
 assert.equal(result.success,false);
 if(result.success)throw Error('Oversized queue accepted');
 assert.deepEqual(result.error.issues.map(issue=>({code:issue.code,path:issue.path})),[
  {code:'too_big',path:['items']},
 ]);
 assert.equal(ownerWorkResponse.safeParse({checkedAt:'2026-10-24T12:00:00Z',page:0,hasMore:false,total:0,items:[]}).success,true);
});
