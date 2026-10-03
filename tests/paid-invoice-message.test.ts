import test from 'node:test';
import assert from 'node:assert/strict';
import {paidInvoiceMessage} from '../apps/web/lib/paid-invoice-message.ts';
import type {InvoiceDocument} from '../apps/web/lib/invoice-document.ts';
const invoice:InvoiceDocument={number:14,issuedAt:'2026-10-03T15:00:00Z',businessName:'Synthetic & Company',businessEmail:'owner@example.invalid',terms:'Synthetic terms',timezone:'America/Chicago',recipient:{name:'<Customer>',email:'customer@example.invalid',phone:'5550000000',street:'100 Test St',city:'Test',region:'IL',postalCode:''},lines:[{description:'Work',chargedCents:9000}],totalCents:9000,paidCents:9000,balanceCents:0};
test('paid thank-you uses exact balance and safe recipient; review disabled means no request',()=>{
 const m=paidInvoiceMessage(invoice,{enabled:false,url:'https://example.invalid/review'});
 assert.equal(m.to,'customer@example.invalid');assert.ok(m.body.includes('Invoice 14 for $90.00 is paid in full'));
 assert.ok(m.html.includes('&lt;Customer&gt;'));assert.ok(!m.html.includes('<Customer>'));assert.ok(!m.body.includes('review'));assert.ok(!m.html.includes('100 Test St'));
});
test('review request is optional and safe HTTPS only',()=>{
 const m=paidInvoiceMessage(invoice,{enabled:true,url:'https://example.invalid/review?a=1&b=2'});
 assert.ok(m.html.includes('a=1&amp;b=2'));assert.ok(m.body.includes('review of your experience'));
 for(const url of ['javascript:alert(1)','http://example.invalid','https://user:password@example.invalid'])assert.throws(()=>paidInvoiceMessage(invoice,{enabled:true,url}));
 assert.throws(()=>paidInvoiceMessage(invoice,{enabled:true,url:null}));
});
test('partial, unpaid, zero-charge and missing-recipient invoices cannot claim paid receipt',()=>{
 for(const change of [{paidCents:3000,balanceCents:6000},{paidCents:0,balanceCents:9000},{totalCents:0,paidCents:0},{recipient:null}])assert.throws(()=>paidInvoiceMessage({...invoice,...change},null));
});
