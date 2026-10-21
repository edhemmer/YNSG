import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAgentPlan} from '../apps/web/lib/field-agent-plan.ts';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
const base={id:'10000000-0000-4000-8000-000000000001',status:'submitted',revision:1,original_submission:{name:'Synthetic',phone:'5550100',services:[{service:'Yard',task:'Mow'}]},appointments:[]};
test('agent prepares scheduling decision without mutating records or sending commands',()=>{
 const original=JSON.stringify(base);
 const tasks=prepareAgentPlan(base,[],[],[]);
 assert.equal(tasks.length,1);
 assert.equal(tasks[0].kind,'schedule');
 assert.equal(tasks[0].requiresOwnerApproval,true);
 assert.equal(tasks[0].status,'proposed');
 assert.equal(JSON.stringify(base),original);
});
test('declined requests produce no agent actions',()=>assert.deepEqual(prepareAgentPlan({...base,status:'declined'},[],[],[]),[]));
test('field workflow displays prepared decision as an uncommitted recommendation',()=>{
 assert.match(source,/prepareAgentPlan\(request,quotes,jobs,invoices\)/);
 assert.match(source,/Prepared next decision/);
 assert.match(source,/Awaiting your review · no action sent/);
});
