import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryDestination, authProviderFailure} from '../apps/web/lib/auth-flow.js';
import {publicError} from '../apps/web/lib/public-errors.js';
test('verified recovery always opens password change even without browser destination',()=>{
 for (const destination of [undefined,'owner','account','password']) assert.equal(recoveryDestination(destination,'recovery'),'password');
 assert.equal(recoveryDestination('owner','email'),'owner');
 assert.equal(recoveryDestination(undefined,null),undefined);
});
test('email limit failures remain truthful and safe through the product error filter',()=>{
 for(const error of [{status:429},{code:'over_email_send_rate_limit'},{code:'over_request_rate_limit'}]) {
  const failure=authProviderFailure(error,true);
  assert.equal(failure.status,429);assert.match(failure.message,/was not sent/);
  assert.equal(publicError(failure.message),failure.message);
 }
 const failed=authProviderFailure({status:500,code:'secret-provider-detail'},true);
 assert.equal(failed.status,503);assert.ok(!failed.message.includes('secret'));
});

test('password failure distinguishes invalid credentials, rate limit and provider outage without leaking details',async()=>{
 const {passwordSignInFailure}=await import('../apps/web/lib/auth-flow.ts');
 for(const [error,status] of [[{code:'invalid_credentials',status:400},400],[{code:'email_not_confirmed',status:400},400],[{status:429},429],[{status:401,code:'invalid_api_key'},503],[{status:500,code:'private-provider-detail'},503],[null,503]] as const){
  const failed=passwordSignInFailure(error);assert.equal(failed.status,status);assert.equal(publicError(failed.message),failed.message);assert.ok(!failed.message.includes('private-provider-detail'));assert.ok(!failed.message.includes('invalid_api_key'));
 }
});
