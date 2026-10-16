import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/web/app/api/commands/route.ts','utf8');
test('invoice approval distinguishes unknown RPC outcome from definite rejection',()=>{
 assert.match(source,/if\(c\.command==='ApproveInvoice'\)/);
 assert.match(source,/invoice issuance result is unknown/);
 assert.match(source,/status:denied\?403:known\?409:503/);
 assert.match(source,/Invoice issuance could not be confirmed/);
});
test('invoice issuance requires canonical receipt and reviewed total before confirming',()=>{
 assert.match(source,/confirmInvoiceIssued\(data,c\.totalCents\)/);
 assert.match(source,/return NextResponse\.json\(\{ok:true,result:receipt\},\{headers\}\)/);
});
