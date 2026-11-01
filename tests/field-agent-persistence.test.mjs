import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../apps/web/app/api/field-agent/route.ts',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261026170000_field_agent_tasks.sql',import.meta.url),'utf8');
test('persistent agent requires current owner membership',()=>{
 assert.match(api,/await authenticated\(\)/);
 assert.match(api,/\.is\('revoked_at',null\)/);
 assert.match(api,/\.in\('role',\['owner','admin'\]\)/);
 assert.match(api,/status:403/);
});
test('agent persistence never dispatches emails or performs financial commands',()=>{
 assert.match(api,/execution:'owner_review_only'/);
 assert.doesNotMatch(api,/dispatchGoogleMail|RecordPayment|IssueInvoice|fetch\(.*https:/);
 assert.match(sql,/row level security/i);
 assert.match(sql,/revoke all on public\.field_agent_tasks from anon, authenticated/i);
});
test('agent supersedes obsolete and settled proposals',()=>{
 assert.match(api,/previous\.data/);
 assert.match(api,/status:'superseded'/);
 assert.match(api,/request_revision/);
});


test('owner AI review scans past stale recent proposals with bounded tenant and revision checks',()=>{
 assert.match(api,/const pageSize=40,maxPages=5/);
 assert.match(api,/\.eq\('organization_id',q\.organization\)\.eq\('status','proposed'\)/);
 assert.match(api,/\.range\(page\*pageSize,\(page\+1\)\*pageSize-1\)/);
 assert.match(api,/record&&record\.revision===x\.request_revision/);
 assert.match(api,/!\['declined','canceled'\]\.includes\(record\.status\)/);
 assert.match(api,/scanIncomplete=true/);
 assert.match(api,/hasMore:valid\.length>5,scanIncomplete/);
 assert.doesNotMatch(api,/\.limit\(20\)/);
});
