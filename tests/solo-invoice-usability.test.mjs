import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('owner editing keeps per-service fixed/hourly pricing separate from invoice labor and private history',async()=>{
 const draft=await readFile(new URL('../apps/web/app/invoice-draft.tsx',import.meta.url),'utf8');
 const editor=await readFile(new URL('../apps/web/app/owner-service-pricing.tsx',import.meta.url),'utf8');
 assert.match(draft,/requestedServices/);
 assert.match(draft,/parsePriceDraft/);
 assert.match(draft,/ownerPricing:privatePricing/);
 assert.match(draft,/billingBasis:'fixed'/);
 assert.match(editor,/Normal pricing method/);
 assert.match(editor,/Hourly calculation/);
 assert.match(editor,/Actual billed/);
 assert.match(editor,/Apply total across services/);
});
test('owner-only discretionary values are stored in protected database and never placed in customer HTML or PDF',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261109154000_owner_invoice_pricing.sql',import.meta.url),'utf8');
 const view=await readFile(new URL('../apps/web/app/invoice-view.tsx',import.meta.url),'utf8');
 const pdf=await readFile(new URL('../apps/web/lib/invoice-pdf.ts',import.meta.url),'utf8');
 assert.match(sql,/private\.invoice_owner_pricing/);
 assert.match(sql,/private\.staff\(p_org,array\['owner','admin'\]\)/);
 assert.match(sql,/private\.save_invoice_labor/);
 assert.doesNotMatch(view,/ownerPricing|standardCents|discretionary|billingLabel|recordedMinutes/);
 assert.doesNotMatch(pdf,/ownerPricing|standardCents|discretionary|billingLabel|recordedMinutes/);
});
test('invoice email is primary action and payment remains optional',async()=>{
 const source=await readFile(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
 assert.match(source,/<div className="invoice-send-actions">/);
 assert.match(source,/<InvoiceDelivery streamlined/);
 assert.match(source,/<summary>Record customer payment<\/summary>/);
 assert.match(source,/OwnerInvoicePricingSummary/);
});
