import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const job=readFileSync('apps/web/app/service-workflow.tsx','utf8');
const style=readFileSync('apps/web/app/style.css','utf8');
const between=(a,b)=>job.slice(job.indexOf(a),job.indexOf(b));

test('next saved-state action appears before optional progress, preparation and supporting history',()=>{
 const action=job.indexOf('<section className="field-task" aria-label="Current field action">');
 const progress=job.indexOf('<details className="field-job-progress">');
 const timer=job.indexOf('<TaskTimer');
 const finance=job.indexOf('<InvoiceDraft');
 const supporting=job.indexOf('<details className="field-job-details">');
 assert.ok(action>0&&progress>action&&timer>progress&&finance>progress&&supporting>progress);
 assert.ok(job.indexOf('workflow-customer-note')<action,'Original customer instructions remain available before the decision');
 assert.ok(job.indexOf('decision.unknown&&')<action,'Unknown outcomes must be visible before another decision');
 assert.ok(job.indexOf('A different appointment time was requested')<action,'A reschedule request is visible before new actions');
});

test('workflow controls still use canonical saved-state permission and recovery guards',()=>{
 const action=between('<section className="field-task"','<details className="field-job-progress">');
 for(const operation of ["task.kind==='confirm'","task.kind==='agreement'","task.kind==='ready'","task.kind==='invoice'","task.kind==='payment'","task.kind==='settled'","task.kind==='closed'"])assert.ok(action.includes(operation),operation);
 assert.ok(action.includes("blocked||!canWork||!j"),'Start remains guarded');
 assert.ok(action.includes("fieldAction(j,task.kind==='working'?'pause':'resume')"),'Timer commands remain guarded');
 assert.ok(action.includes('setWorkRecordOpen(true)'), 'Reviewing completion is deliberate');
 assert.ok(job.includes("useFieldCommand('workflow:'"),'Saved action recovery preserved');
 assert.ok(job.includes('onChanged={onChanged}'),'Canonical refresh remains wired');
});

test('less primary-screen clutter does not conceal agreements, customer notes, preparation, or invoices',()=>{
 assert.ok(job.includes('<details className="field-job-progress">'));
 assert.ok(job.includes('<nav className="field-workflow-stages"'));
 assert.ok(job.includes('prepared.preparedActions.map'));
 assert.ok(job.includes('prepared.notes.slice(1)'));
 assert.ok(job.includes('open={task.kind===\'confirm\'||task.kind===\'agreement\'}'));
 assert.ok(job.includes('scopeCharacters.slice(0,120)'));
 assert.ok(job.includes('<details><summary>Read full agreed scope'));
 assert.ok(job.includes('<InvoicePayments guided'));
 assert.ok(job.includes('<RelatedCustomerFiles'));
 assert.ok(style.includes('.field-job .field-task button'));
 assert.ok(style.includes('min-height:52px'));
 assert.ok(style.includes('.field-job-progress[open]'));
});
