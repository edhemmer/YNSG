import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('card checkout refuses an invoice already settled (for example by cash) with a clear message',()=>{
 const route=readFileSync('apps/web/app/api/stripe/checkout/route.ts','utf8'),button=readFileSync('apps/web/app/invoice-pay-button.tsx','utf8');
 assert.match(route,/OVERPAYMENT_REQUIRES_REVIEW[\s\S]*NO_BALANCE[\s\S]*409/);
 assert.match(button,/NO_BALANCE/);assert.match(button,/balanceCents<=0\)return null/);
 const sql=readFileSync('supabase/migrations/20261010011809_tax_workspace.sql','utf8');
 assert.match(sql,/paid\+p_cents>i\.total_cents then raise exception 'OVERPAYMENT_REQUIRES_REVIEW'/);
 assert.match(sql,/if paid\+amount>i\.total_cents then raise exception 'OVERPAYMENT_REQUIRES_REVIEW'/);
});
