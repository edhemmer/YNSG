import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../apps/web/app/service-workflow.tsx',import.meta.url),'utf8');
const jobs=readFileSync(new URL('../apps/web/app/owner-work.tsx',import.meta.url),'utf8');
test('field workflow prioritizes active phase; secondary phases and preview stay available on demand',()=>{
 assert.match(workflow,/className="field-secondary-tools"/);
 assert.match(workflow,/<summary>Upcoming invoice preview<\/summary><ScheduledInvoice compact/);
 assert.match(workflow,/className="field-command-primary"/);
 assert.match(workflow,/requestTasks\(request.original_submission\)\.slice\(0,2\)/);
 assert.match(workflow,/Customer’s note/);
 assert.match(workflow,/readyJob\.status==='paused'\?'resume':'start'/);
 assert.match(workflow,/readyJob\.status==='working'\?'pause'/);
 assert.match(workflow,/fieldAction\(readyJob/);
});
test('Jobs keep direct review and preserve full context inside an optional disclosure',()=>{
 assert.match(jobs,/<summary>Address & details<\/summary>/);
 assert.match(jobs,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);
 assert.match(jobs,/j\.tasks\.join\(' · '\)/);
});
