import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAgentPlan,prepareCustomerFollowUp} from '../apps/web/lib/field-agent-plan.ts';
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
test('field workflow does not present proposal-only agent advice as completed work',()=>{
 assert.doesNotMatch(source,/Prepared next decision|Awaiting your review · no action sent/);
 assert.match(source,/fieldAction\(j,'start'\)/);
});

test('follow-up is a draft only and never assumes appointment confirmation',()=>{
 const draft=prepareCustomerFollowUp(base);
 assert.equal(draft?.requiresOwnerApproval,true);
 assert.equal(draft?.status,'draft');
 assert.match(draft.body,/not confirmed until/);
 assert.equal(prepareCustomerFollowUp({...base,status:'declined'}),null);
 assert.doesNotMatch(source,/Prepared customer follow-up · not sent/);
});

test('agent follows saved quote approval rather than treating any quote as accepted',()=>{
 const confirmed={...base,appointments:[{status:'reserved'}]};
 const quote={id:'q1',request_id:base.id,status:'sent',current_version:1,quote_versions:[{version:1,scope:'Mow',labor_cents:12000,duration_minutes:120}]};
 const task=prepareAgentPlan(confirmed,[quote],[],[])[0];
 assert.equal(task?.kind,'quote');
 assert.match(task.title,/approval/i);
});
test('agent does not offer work when approved job has no accepted quote version',()=>{
 const confirmed={...base,appointments:[{status:'reserved'}]};
 const quote={id:'q1',request_id:base.id,status:'sent',current_version:1,quote_versions:[{version:1,scope:'Mow',labor_cents:12000,duration_minutes:120}]};
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'approved',revision:1};
 const task=prepareAgentPlan(confirmed,[quote],[job],[])[0];
 assert.equal(task?.kind,'quote');
 assert.match(task.title,/agreement/i);
});
test('agent never asks for payment on an already settled invoice',()=>{
 const confirmed={...base,appointments:[{status:'reserved'}]};
 const job={id:'j1',quote_id:'q1',status:'completed',revision:1};
 const invoice={id:'i1',job_id:'j1',number:1,total_cents:12000,payments:[{cents:12000}]};
 assert.deepEqual(prepareAgentPlan(confirmed,[],[job],[invoice]),[]);
});
test('agent treats outstanding receipts as owner-confirmed evidence, not automation',()=>{
 const confirmed={...base,appointments:[{status:'reserved'}]};
 const job={id:'j1',quote_id:'q1',status:'completed',revision:1};
 const invoice={id:'i1',job_id:'j1',number:1,total_cents:12000,payments:[]};
 const task=prepareAgentPlan(confirmed,[],[job],[invoice])[0];
 assert.equal(task?.kind,'payment');
 assert.match(task.detail,/actually received/i);
 assert.equal(task.requiresOwnerApproval,true);
});
