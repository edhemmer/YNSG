import test from 'node:test';import assert from 'node:assert/strict';
import {centralReady,sendCentralEmail} from '../apps/web/lib/central-mail.ts';
const env={RESEND_API_KEY:'synthetic-platform-key',TRANSACTIONAL_EMAIL_FROM:'Your Neighborhood Service Guy <notifications@notify.example.invalid>'};
test('two franchise businesses share one sender while each customer reply goes to the correct owner',async()=>{
 const sent:{headers:Record<string,string>;body:any}[]=[];
 const transport=(async(_url:unknown,input:any)=>{sent.push({headers:input.headers,body:JSON.parse(input.body)});return Response.json({id:'synthetic-'+sent.length})}) as typeof fetch;
 for(const [org,recipient,replyTo] of [['20000000-0000-4000-8000-000000000001','customer-one@example.invalid','owner-one@example.invalid'],['20000000-0000-4000-8000-000000000002','customer-two@example.invalid','owner-two@example.invalid']]){
  await sendCentralEmail(org!,'70000000-0000-4000-8000-000000000001',{to:recipient!,replyTo:replyTo!,subject:'Recorded appointment',body:'Your appointment details',html:'<p>Recorded appointment</p>'},transport,env);
 }
 assert.equal(sent[0]!.body.from,sent[1]!.body.from);assert.deepEqual(sent.map(v=>v.body.reply_to),['owner-one@example.invalid','owner-two@example.invalid']);assert.deepEqual(sent.map(v=>v.body.to[0]),['customer-one@example.invalid','customer-two@example.invalid']);assert.notEqual(sent[0]!.headers['Idempotency-Key'],sent[1]!.headers['Idempotency-Key']);
});
test('central approval becomes unusable when the platform sender changes or credentials disappear',()=>{
 assert.equal(centralReady(env.TRANSACTIONAL_EMAIL_FROM,env),true);assert.equal(centralReady(env.TRANSACTIONAL_EMAIL_FROM,{...env,RESEND_API_KEY:''}),false);assert.equal(centralReady(env.TRANSACTIONAL_EMAIL_FROM,{...env,TRANSACTIONAL_EMAIL_FROM:'Other <other@notify.example.invalid>'}),false);
});
