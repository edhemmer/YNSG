import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRepeatContext,contactForProperty} from '../apps/web/lib/repeat-request-context.ts';
const a='20000000-0000-4000-8000-000000000001',b='30000000-0000-4000-8000-000000000001';
const c='40000000-0000-4000-8000-000000000001',d='50000000-0000-4000-8000-000000000001';
const source={contacts:[{id:c,customer_id:a,name:'Synthetic first',email:'first@example.invalid',phone:'5550100001'},{id:d,customer_id:b,name:'Synthetic second',email:'second@example.invalid',phone:'5550100002'}],properties:[{id:a,customer_id:a,street:'First testing street',city:'Testville',region:'IL'},{id:b,customer_id:b,street:'Second testing street',city:'Testville',region:'IL'}],services:[{name:'Lawn care',scope:'Synthetic lawn task'}]};
test('private saved contact follows the selected property and never another customer',()=>{
 const v=parseRepeatContext(source);
 assert.equal(contactForProperty(v,a,'' )?.id,c);
 assert.equal(contactForProperty(v,b,c),undefined);
 assert.equal(contactForProperty(v,b,'' )?.id,d);
 assert.equal(contactForProperty(v,'70000000-0000-4000-8000-000000000001',c),undefined);
});
test('invalid and duplicated private account context fails closed',()=>{
 assert.throws(()=>parseRepeatContext({...source,contacts:[...source.contacts,source.contacts[0]]}),/inconsistent/i);
 assert.throws(()=>parseRepeatContext({...source,properties:[...source.properties,source.properties[0]]}),/inconsistent/i);
 assert.throws(()=>parseRepeatContext({...source,services:[...source.services,source.services[0]]}),/inconsistent/i);
 assert.throws(()=>parseRepeatContext({...source,contacts:[{id:c,name:'Missing customer identifier'}]}),/incomplete/i);
 assert.throws(()=>parseRepeatContext({contacts:[],properties:[],services:null}),/incomplete/i);
});
test('multiple contacts at one property require an explicit authorized selection',()=>{
 const v=parseRepeatContext({...source,contacts:[...source.contacts,{id:'60000000-0000-4000-8000-000000000001',customer_id:a,name:'Second family member',email:'family@example.invalid',phone:'5550100003'}]});
 assert.equal(contactForProperty(v,a,''),undefined);
 assert.equal(contactForProperty(v,a,c)?.id,c);
});
