import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('apps/web/app/service-workflow.tsx','utf8');
const invoice=readFileSync('apps/web/app/invoice-draft.tsx','utf8');
const time=readFileSync('apps/web/app/task-timer.tsx','utf8');
const styles=readFileSync('apps/web/app/style.css','utf8');

test('work completion leads to saved work and invoice review without a second task-time detour',()=>{
 const current=workflow.indexOf('aria-label="Current field action"');
 const work=workflow.indexOf('className="field-work-record"');
 const timer=workflow.indexOf('className="field-task-time"');
 const history=workflow.indexOf('className="workflow-history"');
 assert.ok(current>=0&&work>current&&timer>work&&history>timer,'Action → completion/invoice → timer details → history');
 assert.match(workflow,/hidden=\{working&&!workRecordOpen\}/,'The work form is initially hidden while work is active');
 assert.match(workflow,/initialExpanded=\{workRecordOpen\|\|task.kind==='invoice'\}/,'A completed visit opens invoice review');
 assert.match(workflow,/completed=\{j.status==='completed'\}/,'Completion state comes from saved job');
 assert.match(workflow,/Review &amp; finish work/);
 assert.match(workflow,/Review &amp; issue invoice/);
 assert.match(workflow,/onClick=\{\(\)=>setWorkRecordOpen\(true\)\}/);
});

test('work completion and invoice issue remain distinct reviewed canonical actions',()=>{
 assert.match(invoice,/command: "ApproveInvoice"/);
 assert.match(invoice,/completeOnSave&&!completed/);
 assert.match(invoice,/Check saved work/);
 assert.match(invoice,/The work is finished\. I reviewed the actual work, minutes and agreed labor charges/);
 assert.match(invoice,/I reviewed the work, final charges and any applicable tax/);
 assert.match(invoice,/Approve and issue invoice/);
 assert.ok(invoice.includes('/api/visit-completion'));
 assert.ok(invoice.includes('/api/invoice-draft'));
 assert.match(invoice,/entryConflict/);
 assert.match(invoice,/completionUncertain/);
 assert.match(workflow,/onBusy=\{busyFor\('work:'\+j.id\)\}/);
 assert.match(workflow,/saved=\{onChanged\}/);
});

test('task time recovery and complete original history remain available after handoff',()=>{
 assert.match(workflow,/className="field-task-time"/);
 assert.match(workflow,/<TaskTimer key=\{organization\+':'\+j.id\}/);
 assert.match(time,/useBlockedEntry/);
 assert.match(time,/useUnsavedEntry/);
 assert.match(time,/Check same saved action/);
 assert.match(workflow,/className="field-job-details"/);
 assert.match(workflow,/className="workflow-history"/);
 assert.match(styles,/\.field-job \.field-work-record\{scroll-margin-top/);
 assert.match(styles,/\.field-job \.field-task-time\{border-top/);
});
