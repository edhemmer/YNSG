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
