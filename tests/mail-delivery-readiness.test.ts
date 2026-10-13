import test from 'node:test';
import assert from 'node:assert/strict';
import {mailDeliveryReady} from '../apps/web/lib/mail-delivery-readiness.ts';
test('verified managed mail can send invoices with legacy Gmail disabled',()=>{assert.equal(mailDeliveryReady(true,{ready:true},false),true);});
test('owner approval and managed transport readiness both remain required',()=>{
 assert.equal(mailDeliveryReady(false,{ready:true},true),false);
 assert.equal(mailDeliveryReady(true,{ready:false},true),false);
});
test('legacy Gmail is accepted only when approved and explicitly enabled',()=>{
 assert.equal(mailDeliveryReady(true,null,true),true);
 assert.equal(mailDeliveryReady(true,null,false),false);
 assert.equal(mailDeliveryReady(false,null,true),false);
});
