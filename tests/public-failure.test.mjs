import test from 'node:test';
import assert from 'node:assert/strict';
import {WebsiteGuardFailure} from '../lib/website-guard.js';
import {publicFailure,unavailableMessage} from '../lib/public-failure.js';
import {businessIdentity} from '../lib/business-identity.js';

test('known guard failures keep their customer-safe status and message',()=>{
 for(const status of [409,429,503]){
  const error=new WebsiteGuardFailure(status);
  assert.deepEqual(publicFailure(error),{status,message:error.message});
 }
});

test('a custom customer-safe message on a guard failure is preserved',()=>{
 const error=new WebsiteGuardFailure(409);
 error.message='That time is no longer available. Please choose another time.';
 assert.deepEqual(publicFailure(error),{status:409,message:error.message});
});

test('unknown errors never leak their message or status',()=>{
 const leaks=[
  new TypeError('Invalid URL: https://internal.example/secret-path'),
  Object.assign(new Error('relation "customers" does not exist'),{status:500}),
  Object.assign(new Error('teapot'),{status:418}),
  Object.assign(new Error('ok?'),{status:200}),
  {status:429,message:'looks like a guard failure but is not one'},
  'a thrown string',
  undefined,
  null
 ];
 for(const error of leaks){
  const out=publicFailure(error);
  assert.equal(out.status,503);
  assert.equal(out.message,unavailableMessage);
 }
});

test('a guard failure with an unexpected status is not passed to res.status()',()=>{
 const out=publicFailure(new WebsiteGuardFailure(500));
 assert.deepEqual(out,{status:503,message:unavailableMessage});
});

test('the fallback message gives the approved business phone number',()=>{
 assert.ok(unavailableMessage.includes(businessIdentity.phoneDisplay),'fallback must use the approved public number');
 assert.doesNotMatch(unavailableMessage,/770-630-2094/);
});
