import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceDocument} from '../apps/web/lib/invoice-document.js';
const invoice={number:1,issued_at:'2026-10-03T14:00:00Z',total_cents:4500,snapshot:{configuration:{sellerLegalName:'Synthetic Company',invoiceTerms:'Agreed terms',internal:'PRIVATE'},recordedWork:[{description:'Garden work',chargedCents:4500,waiverReason:''},{description:'Door adjustment',chargedCents:0,waiverReason:'PRIVATE'}]},payments:[{cents:1500}]};
test('invoice document preserves issued cents and excludes private configuration and waiver reasons',()=>{const d=invoiceDocument(invoice);assert.equal(d.balanceCents,3000);assert.equal(d.lines[1]?.chargedCents,0);assert.equal(JSON.stringify(d).includes('PRIVATE'),false)});
test('invoice document refuses mismatched charges and overpayments',()=>{assert.throws(()=>invoiceDocument({...invoice,total_cents:1}));assert.throws(()=>invoiceDocument({...invoice,payments:[{cents:5000}]}));assert.throws(()=>invoiceDocument({...invoice,total_cents:1.5}))});
