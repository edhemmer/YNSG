import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {invoiceDocument} from '../apps/web/lib/invoice-document.ts';import {invoiceMessage} from '../apps/web/lib/invoice-message.ts';
const base={number:12,issued_at:'2026-10-03T14:00:00Z',total_cents:4500,payments:[{cents:1500}],snapshot:{configuration:{sellerLegalName:'Test Company',invoiceTerms:'Pay by check or Zelle',timezone:'America/Chicago'},recipient:{name:'Pat',email:'customer@example.invalid',phone:'5550000000',street:'100 Test St',city:'Test City',region:'IL',postalCode:''},recordedWork:[{description:'Lawn',chargedCents:4500,recordedMinutes:60,waiverReason:''}]}};
test('invoice email carries a Pay button only for an unpaid balance with a secure link',()=>{
 const url='https://app.example.invalid/invoice?organization=a&invoice=b';
 const unpaid=invoiceMessage(invoiceDocument(base),undefined,{payUrl:url});
 assert.match(unpaid.html,/Pay \$30\.00 now/);assert.ok(unpaid.html.includes(url));assert.ok(unpaid.body.includes('Pay online: '+url));
 assert.doesNotMatch(invoiceMessage(invoiceDocument(base),undefined,{payUrl:'http://insecure.example.invalid'}).html,/Pay \$/);
 assert.doesNotMatch(invoiceMessage(invoiceDocument(base)).html,/Pay \$/);
 assert.doesNotMatch(invoiceMessage(invoiceDocument({...base,payments:[{cents:4500}]}),undefined,{payUrl:url}).html,/Pay \$/);
});
test('owner can type any amount and send in one step without private pricing leaking to the customer',()=>{
 const quick=readFileSync('apps/web/app/invoice-quick.tsx','utf8');
 for(const call of ['/api/visit-completion','/api/invoice-draft',"command:'ApproveInvoice'",'/api/invoice-delivery'])assert.ok(quick.includes(call),call);
 assert.doesNotMatch(quick,/type="checkbox"/);
 assert.match(quick,/Only you see this/);
 assert.doesNotMatch(readFileSync('apps/web/app/invoice-view.tsx','utf8'),/standardCents|ownerPricing/);
});
test('migration lifts the cap only for owner/admin and keeps the crew and field cap',()=>{
 const sql=readFileSync('supabase/migrations/20261110140000_owner_free_amount.sql','utf8');
 assert.match(sql,/not private\.staff\(p_org,array\[''owner'',''admin''\]\)/);
 assert.match(sql,/private\.complete_and_invoice/);
});
