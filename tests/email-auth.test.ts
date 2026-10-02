import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEmailClient,emailVerifierStorage,EMAIL_STORAGE_KEY} from '../apps/web/lib/email-auth-core.js';

test('email PKCE verifier survives the request boundary and matches the sent challenge',async()=>{
 let challenge='';let exchangeCount=0;
 const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
 const mock:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));const body=JSON.parse(String(init?.body||'{}'));
  if(url.pathname==='/auth/v1/otp'){
   assert.equal(url.searchParams.get('redirect_to'),'https://crm.example.invalid/auth/confirm');
   assert.equal(body.code_challenge_method,'s256');challenge=body.code_challenge;
   return new Response('{}',{status:200});
  }
  assert.equal(url.pathname,'/auth/v1/token');assert.equal(url.searchParams.get('grant_type'),'pkce');
  assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),challenge);
  assert.equal(body.auth_code,'synthetic-code');exchangeCount++;
  return new Response(JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:{id:'00000000-0000-4000-8000-000000000001'}}),{status:200});
 };
 const start=createEmailClient('https://synthetic.example.invalid','synthetic-key',null,mock);
 const sent=await start.client.auth.signInWithOtp({email:'synthetic@example.invalid',options:{emailRedirectTo:'https://crm.example.invalid/auth/confirm'}});
 assert.equal(sent.error,null);assert.ok(start.currentVerifier());
 const callback=createEmailClient('https://synthetic.example.invalid','synthetic-key',start.currentVerifier(),mock);
 const result=await callback.client.auth.exchangeCodeForSession('synthetic-code');
 assert.equal(result.error,null);assert.ok(result.data.session);assert.equal(exchangeCount,1);
 assert.equal(callback.currentVerifier(),null,'verifier cleared after exchange; tokens not persisted in verifier storage');
});

test('missing browser verifier prevents an exchange request',async()=>{
 let calls=0;
 const client=createEmailClient('https://synthetic.example.invalid','synthetic-key',null,async()=>{calls++;throw new Error('must not call provider');});
 const result=await client.client.auth.exchangeCodeForSession('synthetic-code');
 assert.ok(result.error);assert.equal(calls,0);
});

test('verifier storage rejects session and unrelated keys',()=>{
 const storage=emailVerifierStorage(null);
 storage.storage.setItem(EMAIL_STORAGE_KEY,'session-secret');
 storage.storage.setItem('unrelated','other-secret');
 assert.equal(storage.current(),null);
 assert.equal(storage.storage.getItem(EMAIL_STORAGE_KEY),null);
});
