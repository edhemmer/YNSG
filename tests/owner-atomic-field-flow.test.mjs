import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Today and Jobs use durable request-specific navigation',()=>{const d=read('apps/web/app/owner-day.tsx'),j=read('apps/web/app/owner-work.tsx');assert.match(d,/onClick=\{\(\)=>onOpen\(c\.requestId\)\}/);assert.match(j,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);assert.doesNotMatch(d,/href=\{'\/owner\?'/);});
test('Zelle is recorded manually through guarded confirmed payment command',()=>{const p=read('apps/web/app/invoice-payments.tsx'),i=read('apps/web/lib/payment-input.ts');assert.match(p,/command:'RecordPayment'/);assert.match(p,/confirmed:true/);assert.match(i,/method!=='cash'&&method!=='zelle'/);assert.match(p,/receiptUncertain/);});
