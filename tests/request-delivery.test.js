import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverRequest} from '../site/request-delivery.js';
const id='11111111-1111-4111-8111-111111111111',data={requestKey:id,name:'Test'};
test('success requires a durable receipt, not only a successful HTTP status',async()=>{
 for(const value of [{ok:true},{ok:true,saved:false,id},{ok:true,saved:true,id:'invalid'},null]){
  await assert.rejects(deliverRequest(data,async()=>({ok:true,json:async()=>value})),/DELIVERY_UNKNOWN/);
 }
 assert.equal((await deliverRequest(data,async()=>({ok:true,json:async()=>({ok:true,saved:true,id})}))).id,id);
});
test('uncertain delivery aborts and retries with identical payload and key',async()=>{
 const bodies=[];
 await assert.rejects(deliverRequest(data,async(url,options)=>{
  bodies.push(options.body);
  return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('TIMEOUT')),{once:true}));
 },10),/TIMEOUT/);
 await deliverRequest(data,async(url,options)=>{bodies.push(options.body);return {ok:true,json:async()=>({ok:true,saved:true,id})};});
 assert.equal(bodies[0],bodies[1]);assert.equal(data.requestKey,id);
});
test('server scheduling conflicts remain actionable and never return success',async()=>{
 await assert.rejects(deliverRequest(data,async()=>({ok:false,json:async()=>({error:'That time is no longer available. Please choose another time.'})})),/choose another time/);
});
