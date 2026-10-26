import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/api/field-agent/worker/route.ts',import.meta.url),'utf8');
const attention=readFileSync(new URL('../apps/web/app/field-agent-attention.tsx',import.meta.url),'utf8');
const today=readFileSync(new URL('../apps/web/app/command-center.tsx',import.meta.url),'utf8');
const route=readFileSync(new URL('../apps/web/app/api/field-agent/route.ts',import.meta.url),'utf8');
const cron=JSON.parse(readFileSync(new URL('../apps/web/vercel.json',import.meta.url),'utf8'));
test('agent discovery is independently scheduled and secret protected',()=>{
 assert.ok(cron.crons.some(c=>c.path==='/api/field-agent/worker'&&c.schedule==='0 13 * * *'));
 assert.match(source,/timingSafeEqual/);
 assert.match(source,/process\.env\.CRON_SECRET/);
 assert.match(source,/process\.env\.GOOGLE_WORKER_ORGANIZATION_ID/);
 assert.match(source,/status:401/);
 assert.doesNotMatch(source,/export (async )?function POST/);
});
test('discovery rotates through requests with bounded refresh and reconciles old proposals',()=>{
 assert.match(source,/Math\.floor\(Date\.now\(\)\/86400000\)%pages/);
 assert.match(source,/\.range\(page\*10,page\*10\+9\)/);
 assert.match(source,/\.limit\(10\)/);
 assert.match(source,/status:'superseded'/);
 assert.match(source,/completeInvoicePayments\(db,org,invoices\.data\)/);
 assert.match(source,/automaticActions:0/);
});
test('owner sees approvals inside Today, not in an additional dashboard',()=>{
 assert.match(today,/FieldAgentAttention/);
 assert.match(attention,/onOpen\(first\.request_id\)/);
 assert.match(attention,/Prepared automatically · not approved/);
 assert.match(route,/export async function GET/);
 assert.match(route,/\.is\('revoked_at',null\)/);
 assert.match(route,/\.in\('role',\['owner','admin'\]\)/);
 assert.doesNotMatch(attention,/\.post\(|method:'POST'/);
});
