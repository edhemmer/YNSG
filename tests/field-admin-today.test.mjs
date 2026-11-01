import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const today=readFileSync(new URL('../apps/web/app/command-center.tsx',import.meta.url),'utf8');
const route=readFileSync(new URL('../apps/web/app/api/field-agent/route.ts',import.meta.url),'utf8');
const styles=readFileSync(new URL('../apps/web/app/style.css',import.meta.url),'utf8');
test('prepared administration enriches the existing Today request queue, not a competing dashboard',()=>{
 assert.match(today,/\['agent','\/api\/field-agent',preparedDecisions\]/);
 assert.match(today,/preparationFor\(pending\[0\]!\.id\)/);
 assert.match(today,/preparationFor\(r\.id\)/);
 assert.match(today,/onOpen\(pending\[0\]!\.id\)/);
 assert.match(today,/onOpen\(r\.id\)/);
 assert.doesNotMatch(today,/<FieldAgentAttention/);
 assert.doesNotMatch(today,/<section[^>]*aria-label="Prepared decisions/);
});
test('prepared advice is tenant-scoped, revision-checked and read-only',()=>{
 assert.match(route,/await authenticated\(\)/);
 assert.match(route,/\.eq\('organization_id',q\.organization\)/);
 assert.match(route,/r\.revision===x\.request_revision/);
 assert.match(route,/status','proposed'/);
 assert.match(route,/execution:'owner_review_only'/);
 assert.doesNotMatch(today,/method:'POST'|dispatchGoogleMail|RecordPayment|IssueInvoice/);
});
test('failed preparation does not become an all-clear and remains optional to the field queue',()=>{
 assert.match(today,/Promise\.allSettled\(sources\.map/);
 assert.match(today,/Prepared admin checks/);
 assert.match(today,/agent:PreparedDecisions\|null/);
 assert.match(today,/data\?\.agent\?\.tasks\.find/);
 assert.match(styles,/\.field-admin-prep\{/);
});
