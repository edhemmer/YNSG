import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/api/field-intelligence/route.ts',import.meta.url),'utf8');
test('field intelligence requires authenticated owner membership and scoped data',()=>{
 assert.match(source,/await authenticated\(\)/);
 assert.match(source,/\.in\('role',\['owner','admin'\]\)/);
 assert.match(source,/\.is\('revoked_at',null\)/);
 assert.match(source,/\.eq\('organization_id',organization\)/);
 assert.match(source,/\.eq\('id',requestId\)/);
 assert.match(source,/status:403/);
});
test('field intelligence verifies actual invoice payments before planning',()=>{
 assert.match(source,/completeInvoicePayments\(db,organization,invoices\.data\)/);
 assert.match(source,/prepareAgentPlan\(savedRequest/);
 assert.match(source,/execution:'owner_review_only'/);
});
test('field intelligence is strictly read only and non-sending',()=>{
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|dispatchGoogleMail|fetch\s*\(/);
 assert.match(source,/Cache-Control':'private, no-store/);
 assert.match(source,/export async function GET/);
 assert.doesNotMatch(source,/export (async )?function POST/);
});
