import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {trustedVisitorIp} from '../apps/web/lib/owner-security.js';

test('owner audit uses the platform visitor IP and rejects malformed values',()=>{
 const previous=process.env.VERCEL;
 try{
  process.env.VERCEL='1';
  assert.equal(trustedVisitorIp(new Request('https://example.invalid',{headers:{'x-vercel-forwarded-for':'198.51.100.4'}})),'198.51.100.4');
  assert.throws(()=>trustedVisitorIp(new Request('https://example.invalid',{headers:{'x-forwarded-for':'198.51.100.4'}})),/SECURITY_LOG_UNAVAILABLE/);
  assert.throws(()=>trustedVisitorIp(new Request('https://example.invalid',{headers:{'x-vercel-forwarded-for':'invalid'}})),/SECURITY_LOG_UNAVAILABLE/);
 }finally{
  if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;
 }
});
