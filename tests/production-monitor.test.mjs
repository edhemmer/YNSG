import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProduction} from '../scripts/check-production.mjs';
const healthy=async url=>url.endsWith('/api/health')?Response.json({status:'ok',checkedAt:new Date().toISOString()}):new Response(url.includes('.com/')?'Appointment month calendar id="appointment-days" id="appointment-times" id="request-form" '+'x'.repeat(1100):'Owner sign in action="/auth/access" '+'x'.repeat(1100));
test('independent monitor checks both domains and worker/mail health without credentials',async()=>{
 const seen=[];assert.match(await checkProduction(async(url,options)=>{seen.push(url);assert.equal(options.redirect,'error');assert.ok(!options.headers.Authorization);return healthy(url);}),/^PASS/);assert.equal(seen.length,3);
});
test('monitor fails on missing calendar, stale status, unhealthy worker or failed page',async()=>{
 for(const bad of [new Response('missing calendar'),Response.json({status:'ok',checkedAt:'2020-01-01T00:00:00Z'}),Response.json({status:'needs_attention'},{status:503}),new Response('',{status:500})]){
  const target=bad.headers.get('content-type')?.includes('json')?'health':'calendar';
  await assert.rejects(()=>checkProduction(url=>(target==='health'?url.endsWith('/api/health'):url.includes('.com/'))?bad.clone():healthy(url)));
 }
});
