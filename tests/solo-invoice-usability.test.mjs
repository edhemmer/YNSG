import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('field invoice allows the owner to directly edit the charge without removing billing history',async()=>{
 const source=await readFile(new URL('../apps/web/app/invoice-draft.tsx',import.meta.url),'utf8');
 assert.match(source,/Invoice amount \(\$\) — edit directly/);
 assert.match(source,/billingBasis:"fixed",\s*chargedAmount: e\.target\.value/);
 assert.match(source,/Adjustment note \\(when the agreed rate changes or a charge is waived\\)/);
 assert.match(source,/Save invoice amount/);
 assert.match(source,/Issue invoice/);
 assert.match(source,/recordedMinutes/);
 assert.match(source,/readiness\?\.ready/);
});
test('invoice email is a primary action and payment is optional',async()=>{
 const source=await readFile(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
 assert.match(source,/<div className="invoice-send-actions">/);
 assert.match(source,/<InvoiceDelivery streamlined/);
 assert.match(source,/<summary>Record customer payment<\/summary>/);
 assert.doesNotMatch(source,/<summary>Email invoice & PDF<\/summary>/);
});
