import test from 'node:test';
import assert from 'node:assert/strict';
import {requestRecovery} from '../site/request-recovery.js';
import {deliverRequest} from '../site/request-delivery.js';
const data={description:'Owner test',name:'Test Owner',phone:'7706302094',email:'owner@example.test',street:'100 Test Street',city:'DeKalb',communityRate:'No',services:[{service:'Lawn care',task:'Leaf management'}],requestKey:'11111111-1111-4111-8111-111111111111',appointmentSelection:{mode:'once',start:null},appointmentHold:null};
function memory(){const items=new Map();return {getItem:k=>items.get(k),setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)};}
test('a refresh after uncertain delivery reuses the exact request key and payload',async()=>{
 const storage=memory(),before=requestRecovery(storage);before.savePending(data);
 const bodies=[];
 await assert.rejects(deliverRequest(data,async(_,options)=>{bodies.push(options.body);throw Error('network lost');}));
 const restored=requestRecovery(storage).read();assert.equal(restored.kind,'pending');
 await deliverRequest(restored.data,async(_,options)=>{bodies.push(options.body);return {ok:true,json:async()=>({ok:true,saved:true,id:data.requestKey})};});
 assert.equal(bodies[0],bodies[1]);before.clear();assert.equal(before.read(),null);
});
test('draft expiration, clearing and tab-storage denial are safe',()=>{
 let now=100;const recovery=requestRecovery(memory(),()=>now);assert.equal(recovery.saveDraft(data),true);assert.equal(recovery.read().kind,'draft');
 now+=24*60*60*1000;assert.equal(recovery.read(),null);
 const denied=requestRecovery({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}});
 assert.equal(denied.read(),null);assert.equal(denied.savePending(data),false);assert.doesNotThrow(()=>denied.clear());
});
test('malformed, unsupported and oversized recovery records are discarded',()=>{
 const storage=memory(),recovery=requestRecovery(storage);
 for(const value of [null,{version:2},{version:1,kind:'pending',savedAt:Date.now(),data:{...data,requestKey:'bad'}},{version:1,kind:'draft',savedAt:Date.now(),data:{...data,services:[null]}},{version:1,kind:'draft',savedAt:Date.now(),data:{...data,name:123}}]){
 storage.setItem('ynsg-request-recovery-v1',JSON.stringify(value));assert.equal(recovery.read(),null);
 }
 storage.setItem('ynsg-request-recovery-v1','x'.repeat(20001));assert.equal(recovery.read(),null);
});
