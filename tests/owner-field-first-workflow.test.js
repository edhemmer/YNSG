import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
const jobs=readFileSync(new URL('../apps/web/app/owner-work.tsx',import.meta.url),'utf8');
test('field workflow prioritizes active phase; secondary phases and preview stay available on demand',()=>{
 assert.match(workflow,/<details className="workflow-supporting workflow-other-steps"><summary>Other steps<\/summary>/);
 assert.match(workflow,/<summary>Upcoming invoice preview<\/summary><ScheduledInvoice compact/);
 assert.match(workflow,/className="workflow-next" role="status"/);
 assert.match(workflow,/requestTasks\(request.original_submission\)\.slice\(0,2\)/);
 assert.match(workflow,/Customer’s note/);
 assert.match(workflow,/onClick=\{\(\)=>void fieldAction\(j,'start'\)\}/);
 assert.match(workflow,/onClick=\{\(\)=>void fieldAction\(j,'pause'\)\}/);
 assert.match(workflow,/onClick=\{\(\)=>void fieldAction\(j,'resume'\)\}/);
});
test('Jobs keep direct review and preserve full context inside an optional disclosure',()=>{
 assert.match(jobs,/<summary>Address & details<\/summary>/);
 assert.match(jobs,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);
 assert.match(jobs,/j\.tasks\.join\(' · '\)/);
});
