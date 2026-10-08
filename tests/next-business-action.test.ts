import test from 'node:test';
import assert from 'node:assert/strict';
import {nextBusinessAction} from '../apps/web/lib/next-business-action.ts';
import type {BusinessSnapshot} from '../apps/web/lib/business-snapshot.ts';
function totals(counts:Partial<BusinessSnapshot['counts']>={},balance=0){return {counts:{customers:0,requestsInPeriod:0,requestsToReview:0,upcomingVisits:0,proposals:0,working:0,paused:0,completed:0,quotes:0,messagesToCheck:0,rescheduleRequests:0,...counts},finance:{cashReceivedCents:0,expenseCents:0,cashAfterExpensesCents:0,issuedInvoicesCents:0,outstandingAsOfEndCents:balance,paymentCount:0,expenseCount:0}};}
test('missing totals never imply the owner is caught up',()=>{assert.equal(nextBusinessAction(null),null);assert.match(nextBusinessAction(totals())!.title,/caught up/);});
test('pending scheduling decisions and failed messages take priority over visits and money',()=>{
 assert.equal(nextBusinessAction(totals({rescheduleRequests:1,upcomingVisits:1},100))!.title,'Review a requested time change');
 assert.equal(nextBusinessAction(totals({proposals:1}))!.section,'Requests');
 assert.equal(nextBusinessAction(totals({messagesToCheck:1,upcomingVisits:1}))!.section,'Activity');
 assert.equal(nextBusinessAction(totals({requestsToReview:1,rescheduleRequests:1,messagesToCheck:1}))!.title,'Review a new request');
});
test('paused jobs remain actionable and money is shown only for positive balances',()=>{
 assert.equal(nextBusinessAction(totals({paused:1},100))!.section,'Work');
 assert.equal(nextBusinessAction(totals({quotes:1}))!.title,'Follow up on a sent quote');
 assert.equal(nextBusinessAction(totals({},100))!.section,'Money');
 assert.notEqual(nextBusinessAction(totals({},-100))!.section,'Money');
});
