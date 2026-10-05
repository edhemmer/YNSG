import test from 'node:test';import assert from 'node:assert/strict';
import {applicationOrigin,ownerRequestUrl,ownerRequestContext,ownerReturnTarget} from '../apps/web/lib/email-links.ts';
import {customerLinkUrl} from '../apps/web/lib/customer-links.ts';
const request='80000000-0000-4000-8000-000000000001',organization='20000000-0000-4000-8000-000000000001';
test('email destinations use app paths and reject hosting dashboard or unsafe origins',()=>{
 const u=new URL(ownerRequestUrl('https://business.example.invalid',request,organization));assert.equal(u.pathname,'/owner');assert.equal(u.searchParams.get('request'),request);assert.equal(u.searchParams.get('organization'),organization);
 for(const origin of ['http://business.example.invalid','https://vercel.com','https://vercel.com/project','https://x.vercel.com','https://user:pass@business.example.invalid','https://business.example.invalid/?next=evil'])assert.throws(()=>applicationOrigin(origin));
 const customer=new URL(customerLinkUrl('https://business.example.invalid','a'.repeat(43),'reschedule'));assert.equal(customer.pathname,'/request/manage');assert.equal(customer.search,'');assert.ok(customer.hash.includes('action=reschedule'));
});
test('sign-in preserves only valid owner navigation hints, never an arbitrary redirect or account target',()=>{
 const context={request,organization};assert.deepEqual(ownerRequestContext(context),context);assert.equal(ownerRequestContext({...context,request:'bad'}),null);
 assert.equal(ownerReturnTarget('/owner',context),'/owner?request='+request+'&organization='+organization);
 assert.equal(ownerReturnTarget('/owner?setup=google',context),'/owner?setup=google&request='+request+'&organization='+organization);
 assert.equal(ownerReturnTarget('/account',context),'/account');assert.equal(ownerReturnTarget('/owner',{request:'https://evil.invalid',organization}),'/owner');
});
