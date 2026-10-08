import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentInput} from '../apps/web/lib/payment-input.ts';
function form(amount='60.01',receivedAt='2026-10-08T09:30'){
 const f=new FormData();for(const [k,v] of Object.entries({amount,receivedAt,method:'cash',reference:'synthetic receipt'}))f.set(k,v);return f;
}
test('payment cents are exact and receipt time uses company timezone',()=>{
 assert.deepEqual(paymentInput(form(),'America/Chicago'),{cents:6001,receivedAt:'2026-10-08T14:30:00.000Z',method:'cash',reference:'synthetic receipt'});
 assert.equal(paymentInput(form(),'America/Los_Angeles').receivedAt,'2026-10-08T16:30:00.000Z');
 assert.equal(paymentInput(form('0.01'),'America/Chicago').cents,1);
});
test('payment form rejects zero, exponent, negative, excessive precision and overflow',()=>{
 for(const amount of ['0','0.00','-1','1e3','12.345','10000000','NaN',''])assert.throws(()=>paymentInput(form(amount),'America/Chicago'));
});
test('payment receipt time rejects invalid dates and ambiguous or missing DST times',()=>{
 for(const date of ['2026-02-30T09:30','2026-11-01T01:30','2026-03-08T02:30',''])assert.throws(()=>paymentInput(form('60',date),'America/Chicago'));
});
