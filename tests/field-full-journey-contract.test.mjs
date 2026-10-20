import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const day=readFileSync('apps/web/app/owner-day.tsx','utf8');
const payment=readFileSync('apps/web/app/invoice-payments.tsx','utf8');
const input=readFileSync('apps/web/lib/payment-input.ts','utf8');
test('field jobs navigate by real saved-request deep link',()=>{assert.match(day,/href=\{'\/owner\?'\+new URLSearchParams\(\{section:'Work',request:c\.requestId\}\)\}/);assert.doesNotMatch(day,/onClick=\{\(\)=>onOpen\(c\.requestId\)\}/);});
test('cash and Zelle remain manual verified receipts, not automatic bank settlement',()=>{assert.match(payment,/Zelle is not automatically verified or imported/);assert.match(payment,/RecordPayment/);assert.match(payment,/confirmed:true/);assert.match(payment,/receiptSyncNeeded/);assert.match(input,/method!=='cash'&&method!=='zelle'/);assert.match(input,/reference\.length>300/);});
