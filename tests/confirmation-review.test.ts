import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmationReview} from '../apps/web/lib/confirmation-review.js';
import {schedulingReview} from '../packages/contracts/scheduling-review.js';
const id='40000000-0000-4000-8000-000000000001';
test('combined owner confirmation accepts optional short notes without weakening scheduling validation',()=>{
 const input={organizationId:id,requestId:id,requestRevision:1,configurationVersion:1,scheduleRevision:0,appointmentId:id,appointmentRevision:1,localStart:'2026-10-15T09:00',durationMinutes:120,arrivalOffsetMinutes:0,resources:[id],travelBeforeMinutes:15,travelAfterMinutes:15,key:'synthetic-confirmation'};
 for(const note of ['', '  Gate code 123  ', 'OK']) {
  const parsed=schedulingReview.parse({...input,...confirmationReview(note)});
  assert.match(parsed.reviewNote,/Owner confirmed review/);
  if(note.trim())assert.ok(parsed.reviewNote.endsWith(note.trim()));
 }
 assert.throws(()=>schedulingReview.parse({...input,...confirmationReview(''),resources:[]}));
 assert.throws(()=>schedulingReview.parse({...input,...confirmationReview(''),travelBeforeMinutes:-1}));
 assert.throws(()=>schedulingReview.parse({...input,...confirmationReview(''),appointmentRevision:null}));
 assert.throws(()=>confirmationReview('x'.repeat(2801)));
});
