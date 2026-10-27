import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceNextStep} from '../apps/web/lib/service-workflow.ts';
import {fieldWorkflow} from '../apps/web/lib/field-workflow.ts';
const request={id:'10000000-0000-4000-8000-000000000001',status:'reviewing',appointments:[{status:'reserved',id:'v1',job_id:'j1',start_at:'2026-10-30T14:00:00Z',arrival_at:'2026-10-30T14:00:00Z',end_at:'2026-10-30T16:00:00Z'}]};
const quote={id:'q1',status:'accepted',current_version:1,quote_versions:[{version:1,scope:'Yard cleanup',labor_cents:12000,duration_minutes:120}]};
test('unexpected job status requires review, never implies ready-to-start',()=>{
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'pending_review'};
 const next=serviceNextStep(request,[quote],[job],[]);
 assert.equal(next.step,3);
 assert.match(next.title,/Review/i);
 assert.equal(fieldWorkflow(request,[quote],[job],[]).kind,'agreement');
});
test('approved job with accepted version and adequate reserved window remains ready',()=>{
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 assert.equal(serviceNextStep(request,[quote],[job],[]).step,4);
});
test('approved job missing accepted quote never starts work',()=>{
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 assert.equal(serviceNextStep(request,[{...quote,status:'sent'}],[job],[]).step,3);
});

test('malformed appointment timestamp never permits a ready-to-work action',()=>{
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 const invalid={...request,appointments:[{...request.appointments[0],end_at:'invalid'}]};
 const next=serviceNextStep(invalid,[quote],[job],[]);
 assert.equal(next.step,2);
 assert.match(next.title,/Review the appointment window/);
 assert.equal(fieldWorkflow(invalid,[quote],[job],[]).kind,'confirm');
});
test('insufficient reserved time requires scheduling before starting work',()=>{
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 const short={...request,appointments:[{...request.appointments[0],end_at:'2026-10-30T14:45:00Z'}]};
 assert.equal(serviceNextStep(short,[quote],[job],[]).step,2);
});

test('ready action resolves to the exact verified approved job rather than arbitrary pending job',()=>{
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 const result=fieldWorkflow(request,[quote],[job],[]);
 assert.equal(result.kind,'ready');
 assert.equal(result.job?.id,'j1');
});
test('ongoing work remains the actionable job when another approved job exists',()=>{
 const current={id:'j2',quote_id:'q2',approved_version:1,status:'working'};
 const ready={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 const result=fieldWorkflow(request,[quote],[ready,current],[]);
 assert.equal(result.kind,'working');
 assert.equal(result.job?.id,'j2');
});

test('owner workflow keeps an active timer actionable when prior visit is no longer reserved',()=>{
 const active={id:'j1',quote_id:'q1',approved_version:1,status:'working'};
 const canceled={...request,appointments:[{...request.appointments[0],status:'canceled'}]};
 const next=fieldWorkflow(canceled,[quote],[active],[]);
 assert.equal(next.kind,'working');
 assert.equal(next.job?.id,'j1');
});
test('owner workflow retains completed work awaiting invoice without requiring new booking',()=>{
 const completed={id:'j1',quote_id:'q1',approved_version:1,status:'completed'};
 const canceled={...request,appointments:[]};
 assert.equal(fieldWorkflow(canceled,[quote],[completed],[]).kind,'invoice');
});
test('owner workflow retains issued invoice balance when no appointment remains',()=>{
 const completed={id:'j1',quote_id:'q1',approved_version:1,status:'completed'};
 const invoice={id:'i1',job_id:'j1',total_cents:12000,credits:[],payments:[]};
 assert.equal(fieldWorkflow({...request,appointments:[]},[quote],[completed],[invoice]).kind,'payment');
});

test('unassigned reservation cannot authorize two approved jobs',()=>{
 const jobs=[{id:'j1',quote_id:'q1',approved_version:1,status:'approved'},{id:'j2',quote_id:'q2',approved_version:1,status:'approved'}];
 const quotes=[quote,{...quote,id:'q2'}];
 const unassigned={...request,appointments:[{...request.appointments[0],job_id:null}]};
 const next=serviceNextStep(unassigned,quotes,jobs,[]);
 assert.equal(next.step,2);
 assert.match(next.title,/Confirm an appointment/);
 assert.equal(fieldWorkflow(unassigned,quotes,jobs,[]).kind,'confirm');
});
test('single approved job may use a reserved unassigned appointment',()=>{
 const job={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 const unassigned={...request,appointments:[{...request.appointments[0],job_id:null}]};
 assert.equal(serviceNextStep(unassigned,[quote],[job],[]).step,4);
 assert.equal(fieldWorkflow(unassigned,[quote],[job],[]).kind,'ready');
});

test('a previously invoiced approved job cannot redirect a second completed job to scheduling',()=>{
 const invoiced={id:'j1',quote_id:'q1',approved_version:1,status:'approved'};
 const completed={id:'j2',quote_id:'q2',approved_version:1,status:'completed'};
 const oldInvoice={id:'i1',job_id:'j1',total_cents:12000,credits:[],payments:[]};
 const withoutVisit={...request,appointments:[]};
 const next=serviceNextStep(withoutVisit,[quote,{...quote,id:'q2'}],[invoiced,completed],[oldInvoice]);
 assert.equal(next.step,5);
 assert.equal(fieldWorkflow(withoutVisit,[quote,{...quote,id:'q2'}],[invoiced,completed],[oldInvoice]).kind,'invoice');
});

test('one field screen exposes request-to-payment progress with a single saved-state stage',()=>{
 const source=readFileSync('apps/web/app/service-workflow.tsx','utf8');
 assert.match(source,/aria-label="Job progress"/);
 assert.match(source,/aria-current=\{task\.kind==='confirm'/);
 assert.match(source,/aria-current=\{task\.kind==='payment'/);
 assert.match(source,/navigationUrl\(submissionAddress\(request\.original_submission\)\)/);
 assert.doesNotMatch(source,/href=\{navigationUrl\(submissionAddress\(request\.original_submission\)\)\|\|undefined\}/);
});
