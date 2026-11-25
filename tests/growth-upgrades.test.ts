import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceOutcomes} from '../apps/web/lib/growth-scorecard.ts';
import {businessHoursWaiting,waitBadge,quoteFollowUp} from '../apps/web/lib/request-inbox.ts';
import {ownerReviewEmail} from '../apps/web/lib/owner-day.ts';
import {callLeadCommand,daysWaiting} from '../apps/web/lib/call-leads-contract.ts';
// @ts-expect-error The public handler is JavaScript.
import {callbackInput} from '../api/callback-request.js';
// @ts-expect-error The public handler is JavaScript.
import {siteEvent} from '../api/site-event.js';
// @ts-expect-error The public handler is JavaScript.
import {sourceOf} from '../site/site-counts.js';

test('lead sources roll up to booked jobs and invoiced dollars',()=>{
 const out=sourceOutcomes(
  [{id:'r1',lead:'Nextdoor'},{id:'r2',lead:'Nextdoor'},{id:'r3',lead:null},{id:'r4',lead:'Billboard'}],
  [{id:'q1',request_id:'r1'},{id:'q2',request_id:'r2'},{id:'q3',request_id:'r3'}],
  [{id:'j1',quote_id:'q1',status:'completed'},{id:'j2',quote_id:'q2',status:'canceled'},{id:'j3',quote_id:'q3',status:'scheduled'}],
  [{job_id:'j1',total_cents:24000},{job_id:'j2',total_cents:5000}],
 );
 assert.deepEqual(out,[{source:'Nextdoor',requests:2,booked:1,invoicedCents:24000},{source:'Not given',requests:2,booked:1,invoicedCents:0}]);
});

test('wait timer counts business hours only and flags a full business day',()=>{
 // Friday 4 PM Central to Monday 10 AM Central: 1 hour Friday + 2 hours Monday.
 assert.equal(businessHoursWaiting('2026-11-20T22:00:00Z',Date.parse('2026-11-23T16:00:00Z')),3);
 const r={id:'x',status:'submitted',revision:1,created_at:'2026-11-23T14:00:00Z',original_submission:{name:'A',phone:'1',email:'a@b.c',street:'1',city:'DeKalb'},appointments:[]};
 assert.equal(waitBadge(r,Date.parse('2026-11-23T16:00:00Z'))?.late,false);
 assert.equal(waitBadge(r,Date.parse('2026-11-25T16:00:00Z'))?.late,true);
 assert.equal(waitBadge({...r,status:'quoted'},Date.parse('2026-11-25T16:00:00Z')),null);
});

test('estimate follow-up appears only for a sent estimate a week old',()=>{
 const now=Date.parse('2026-11-25T12:00:00Z'),q=(status:string,created_at:string)=>({id:'q',request_id:'r',status,current_version:1,created_at,quote_versions:[]});
 assert.equal(quoteFollowUp([q('sent','2026-11-20T12:00:00Z')],now),null);
 assert.deepEqual(quoteFollowUp([q('sent','2026-11-15T12:00:00Z')],now),{days:10});
 assert.equal(quoteFollowUp([q('accepted','2026-11-01T12:00:00Z')],now),null);
});

test('review email opens the owner mail app and needs a real address and https link',()=>{
 const link=ownerReviewEmail('pat@example.test','Pat Doe','https://g.page/r/example/review');
 assert.ok(link?.startsWith('mailto:pat@example.test?subject='));
 assert.match(decodeURIComponent(link!),/Hi Pat,/);
 assert.equal(ownerReviewEmail('not-an-email','Pat','https://g.page/r/example/review'),null);
 assert.equal(ownerReviewEmail('pat@example.test','Pat','http://insecure.test'),null);
});

test('call list commands and website call-back input are strict',()=>{
 assert.ok(callLeadCommand.safeParse({organization:'a933d657-14d3-46b6-85e6-21d973e4ed97',id:null,name:'Pat',phone:'815-555-0100',need:'Leaves'}).success);
 assert.equal(callLeadCommand.safeParse({organization:'a933d657-14d3-46b6-85e6-21d973e4ed97',id:null,name:'Pat'}).success,false);
 assert.equal(callLeadCommand.safeParse({organization:'a933d657-14d3-46b6-85e6-21d973e4ed97',id:null,name:'Pat',phone:'815-555-0100',need:'Leaves',extra:1}).success,false);
 assert.equal(daysWaiting('2026-11-20T12:00:00Z',Date.parse('2026-11-25T12:00:00Z')),5);
 const key='0f8fad5b-d9cb-469f-a165-70867728950e';
 assert.deepEqual(callbackInput({name:' Pat ',phone:'815-555-0100',need:'Leaves',requestKey:key}),{key,data:{name:'Pat',phone:'815-555-0100',need:'Leaves'}});
 assert.equal(callbackInput({name:'Pat',phone:'call me',need:'Leaves',requestKey:key}),null);
 assert.equal(callbackInput({name:'<b>Pat</b>',phone:'815-555-0100',need:'Leaves',requestKey:key}),null);
 assert.equal(callbackInput({name:'Pat',phone:'815-555-0100',need:'Leaves',requestKey:key,leadSource:'Billboard'}),null);
});

test('site events keep only a kind, a clean path and a broad source',()=>{
 assert.deepEqual(siteEvent({kind:'view',page:'/Lawn-Mowing-DeKalb-IL/',source:'google'}),{kind:'view',page:'/lawn-mowing-dekalb-il',source:'google'});
 assert.equal(siteEvent({kind:'view',page:'/request?email=a@b.c',source:'google'}),null);
 assert.equal(siteEvent({kind:'purchase',page:'/',source:'google'}),null);
 assert.equal(sourceOf('https://www.google.com/','', 'www.yourneighborhoodserviceguy.com'),'google');
 assert.equal(sourceOf('https://m.facebook.com/','', 'www.yourneighborhoodserviceguy.com'),'facebook');
 assert.equal(sourceOf('','?utm_medium=email', 'www.yourneighborhoodserviceguy.com'),'email');
 assert.equal(sourceOf('https://www.yourneighborhoodserviceguy.com/services','', 'www.yourneighborhoodserviceguy.com'),null);
 assert.equal(sourceOf('','', 'www.yourneighborhoodserviceguy.com'),'direct');
});
