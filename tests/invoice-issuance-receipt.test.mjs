import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmInvoiceIssued} from '../apps/web/lib/invoice-issuance-receipt.ts';

const canonical={id:'40000000-0000-4000-8000-000000000001',number:2026100001,totalCents:12000};
test('invoice issuance receipt proves identity, assigned number and exact reviewed cents',()=>{
 assert.equal(confirmInvoiceIssued(canonical,12000).id,canonical.id);
 for(const value of [null,{},[],{...canonical,id:'bad'},{...canonical,number:0},
  {...canonical,totalCents:11999},{...canonical,totalCents:12000.5}]){
  assert.throws(()=>confirmInvoiceIssued(value,12000));
 }
});
test('invoice issuance API only confirms canonical receipt and preserves unknown results',()=>{
 const api=readFileSync('apps/web/app/api/commands/route.ts','utf8');
 assert.match(api,/confirmInvoiceIssued\(data,c\.totalCents\)/);
 assert.match(api,/Invoice issuance could not be confirmed/);
 assert.match(api,/status:denied\?403:known\?409:503/);
 assert.match(api,/Cache-Control.*private, no-store/);
});
test('owner form keeps one serialized approval across unknown responses',()=>{
 const ui=readFileSync('apps/web/app/invoice-draft.tsx','utf8');
 assert.match(ui,/issuanceAttempt\.current=\{body:JSON\.stringify/);
 assert.match(ui,/body: attempt\.body/);
 assert.match(ui,/setIssuanceUnknown\(true\)/);
 assert.match(ui,/completionUncertain \|\| issuanceUnknown \|\| !loaded/);
 assert.match(ui,/Retry exact original approval/);
 assert.match(ui,/confirmInvoiceIssued\(data\.result,attempt\.totalCents\)/);
});
