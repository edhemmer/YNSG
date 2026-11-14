import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../apps/web/app/'+p,import.meta.url),'utf8');
test('owner invoice editor no longer blocks a final amount above the agreed estimate',()=>{
  const draft=read('invoice-draft.tsx');
  assert.ok(!draft.includes('exceeds the approved labor estimate'));
  assert.ok(!draft.includes('final labor must stay within its approved amount'));
  assert.ok(!/Charges cannot exceed approved labor/.test(draft));
});
test('apply-total-across-services works for totals above the normal value',()=>{
  const pricing=read('owner-service-pricing.tsx');
  assert.ok(!pricing.includes('>standardTotal} onClick={distribute}'));
});
test('issued invoices offer a one-field way to lower the amount through the audited credit command',()=>{
  const credits=read('invoice-credits.tsx');
  assert.ok(credits.includes('Quick: lower the charge to'));
  assert.ok(credits.includes('Save reviewed adjustment'));
});
