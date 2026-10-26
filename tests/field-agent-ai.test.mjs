import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {suggestFieldPreparation} from '../apps/web/lib/field-agent-ai.ts';
const route=readFileSync(new URL('../apps/web/app/api/field-agent/suggest/route.ts',import.meta.url),'utf8');
const source=readFileSync(new URL('../apps/web/lib/field-agent-ai.ts',import.meta.url),'utf8');
test('AI advisory fails closed without explicit credentials and enablement',async()=>{
 const value=process.env.YNSG_AI_ENABLED;const key=process.env.AI_GATEWAY_API_KEY;
 try{delete process.env.YNSG_AI_ENABLED;delete process.env.AI_GATEWAY_API_KEY;
  assert.equal(await suggestFieldPreparation({kind:'schedule',title:'Confirm appointment',detail:'Review requested time'}),null);
 }finally{if(value===undefined)delete process.env.YNSG_AI_ENABLED;else process.env.YNSG_AI_ENABLED=value;if(key===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=key;}
});
test('AI advisory is bounded, single-purpose and cannot execute CRM commands',()=>{
 assert.match(source,/AI_GATEWAY_API_KEY/);
 assert.match(source,/YNSG_AI_ENABLED/);
 assert.match(source,/AbortController/);
 assert.match(source,/max_tokens:120/);
 assert.match(route,/await authenticated\(\)/);
 assert.match(route,/\.is\('revoked_at',null\)/);
 assert.match(route,/\.in\('role',\['owner','admin'\]\)/);
 assert.match(route,/requiresOwnerApproval:true/);
 assert.match(route,/execution:'none'/);
 assert.doesNotMatch(route,/\.insert\(|\.upsert\(|dispatchGoogleMail|RecordPayment|IssueInvoice/);
});

test('scheduled agent invokes AI only within an explicit one-task budget',()=>{
 const worker=readFileSync(new URL('../apps/web/app/api/field-agent/worker/route.ts',import.meta.url),'utf8');
 assert.match(worker,/aiBudget=1/);
 assert.match(worker,/aiBudget--/);
 assert.match(worker,/suggestFieldPreparation\(task\)/);
 assert.match(worker,/!existing\.data/);
 assert.match(worker,/existing\.data\.detail/);
 assert.match(worker,/startsWith\(task\.detail/);
 assert.match(worker,/Optional AI preparation \(review only\)/);
 assert.doesNotMatch(worker,/suggestFieldPreparation\(record\.data/);
});

test('model prompt sends fixed task categories, not customer instructions or payment detail',()=>{
 assert.match(source,/taskCategory:/);
 assert.doesNotMatch(source,/task\.detail\.slice|task\.title\.slice/);
 assert.match(source,/\['schedule','quote','review','work','invoice','payment','follow_up'\]/);
});

test('AI advice must be checked against latest saved request revision',()=>{
 assert.match(route,/latest\.data\.revision!==result\.requestRevision/);
 assert.match(route,/status:'stale',suggestion:null/);
 assert.match(route,/status:409/);
});
