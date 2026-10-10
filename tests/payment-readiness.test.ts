import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentReadiness} from '../apps/web/lib/payment-readiness.ts';

test('payment verification never confuses configuration with provider evidence', async () => {
  let calls = 0;
  const verify = async () => {calls++; return {id: 'private_merchant'};};
  assert.deepEqual(await paymentReadiness(false, verify), {status:'connection_required',merchantVerified:false,webhookDeliveryVerified:false});
  assert.equal(calls, 0);
  assert.deepEqual(await paymentReadiness(true, verify), {status:'merchant_verified',merchantVerified:true,webhookDeliveryVerified:false});
  assert.equal(calls, 1);
  const failed = await paymentReadiness(true, async () => {throw Error('private provider response');});
  assert.deepEqual(failed, {status:'verification_failed',merchantVerified:false,webhookDeliveryVerified:false});
  assert.equal(JSON.stringify(failed).includes('private'), false);
});
