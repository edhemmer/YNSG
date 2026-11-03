import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const job=readFileSync('apps/web/app/service-workflow.tsx','utf8'),frame=readFileSync('apps/web/app/job-workspace.tsx','utf8');
test('one job record connects plan, work, invoice and details with real panels',()=>{
 assert.match(job,/<JobWorkspace/);assert.match(frame,/<JobRecordTabs/);
 for(const panel of ['plan','work','invoice','details'])assert.ok(job.includes("hidden={panel!=='"+panel+"'}"));
 assert.ok(frame.indexOf('job-record-header')<frame.indexOf('<JobRecordTabs'));
 assert.match(job,/feedback={decision.unknown/);assert.ok(frame.indexOf('{feedback}')<frame.indexOf('job-record-body'));
 assert.match(job,/job-customer-message/);
});
test('work and consequential transitions keep canonical guards and wait for saved timer state',()=>{
 for(const operation of ["task.kind==='confirm'","task.kind==='agreement'","task.kind==='ready'","task.kind==='invoice'","task.kind==='payment'","task.kind==='settled'","task.kind==='closed'"])assert.ok(job.includes(operation),operation);
 assert.ok(job.includes('blocked||!canWork||!j'));
 assert.ok(job.includes("fieldAction(j,task.kind==='working'?'pause':'resume')"));
 assert.ok(job.includes("await fieldAction(j,'pause')"));
 assert.ok(job.includes("useFieldCommand('workflow:'"));
 assert.ok(job.includes('onChanged={onChanged}'));
});
test('details retain assignment, safety, files and history while invoice stays directly accessible',()=>{
 for(const feature of ['<LeadAssignment','prepared.preparedActions.map','prepared.notes.map','<RelatedCustomerFiles','<InvoicePayments streamlined guided','<InvoiceDraft','<OfficeFieldNotes'])assert.ok(job.includes(feature),feature);
 assert.ok(!job.includes('field-workflow-stages'));
 assert.ok(job.includes("setPanel('invoice')"));
});
