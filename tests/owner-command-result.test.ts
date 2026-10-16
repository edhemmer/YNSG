import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerRpcFailure,ownerRpcResultConfirmed} from '../apps/web/lib/owner-command-result.ts';

test('known optimistic concurrency and approval decisions are definitive, not retryable new commands',()=>{
 for(const message of ['STALE_REVISION','IDEMPOTENCY_CONFLICT','SERVICE_REVIEW_REQUIRED','CHANGE_ORDER_REQUIRED','APPOINTMENT_DECISION_REQUIRED']){
  assert.deepEqual(ownerRpcFailure({message}),{status:409,uncertain:false});
 }
});
test('permission denials remain private forbidden responses',()=>{
 assert.deepEqual(ownerRpcFailure({code:'42501',message:'permission denied'}),{status:403,uncertain:false});
});
test('backend timeout, unknown SQL and missing errors cannot assert a rejected save',()=>{
 for(const value of [null,{}, {code:'57014',message:'canceling statement due to statement timeout'},{message:'Connection lost'}]){
  assert.deepEqual(ownerRpcFailure(value),{status:503,uncertain:true});
 }
});
test('null owner responses are unconfirmed, including a clean-looking RPC response',()=>{
 assert.equal(ownerRpcResultConfirmed(null),false);
 assert.equal(ownerRpcResultConfirmed(undefined),false);
 assert.equal(ownerRpcResultConfirmed({id:'saved'}),true);
 assert.equal(ownerRpcResultConfirmed(false),true);
});
