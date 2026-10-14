import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringDates,recurringInput} from '../apps/web/lib/recurring-series.ts';
import {recurringMessage} from '../apps/web/lib/recurring-message.ts';
import {localMinute} from '../packages/domain/timezone.ts';
const first={startAt:'2026-10-19T14:00:00Z',endAt:'2026-10-19T18:00:00Z',arrivalAt:'2026-10-19T14:30:00Z',timezone:'America/Chicago'};
test('weekly bookings retain local weekday, arrival, full work window and exclusive year boundary across DST',()=>{
 const p=recurringDates(first);assert.equal(p.visits.length,53);assert.equal(p.endExclusive,'2027-10-19');assert.ok(p.visits.every(v=>localMinute(Date.parse(v.start),first.timezone).endsWith('T09:00')&&localMinute(Date.parse(v.arrival),first.timezone).endsWith('T09:30')&&Date.parse(v.end)-Date.parse(v.start)===14400000));assert.ok(p.visits.some(v=>v.start.includes('T15:00:00')));assert.equal(p.visits.at(-1)!.date,'2027-10-18');
 assert.throws(()=>recurringDates({...first,endAt:first.startAt}));
});
test('series command requires actual customer agreement and explicit review; clients cannot add provider facts',()=>{
 const input={organization:'20000000-0000-4000-8000-000000000001',firstAppointment:'30000000-0000-4000-8000-000000000001',agreement:'Recorded customer agreement to the weekly dates, scope and price',travelBeforeMinutes:0,travelAfterMinutes:0,reviewed:true};assert.ok(recurringInput.parse(input));for(const value of [{...input,agreement:''},{...input,reviewed:false},{...input,facts:[]},{...input,travelBeforeMinutes:-1}])assert.throws(()=>recurringInput.parse(value));
});
const notice={status:'active',name:'Synthetic <neighbor>',recipient:'fixture@example.invalid',timezone:'America/Chicago',firstAt:'2026-10-19T14:00:00Z',lastAt:'2027-10-18T14:00:00Z',visits:53,scope:'Synthetic <b>approved work</b>',laborCents:24000,reason:null,visitsCanceled:null};
test('one natural series message preserves per-visit price and separates booking from billing',()=>{
 const d=recurringMessage('Fixture Neighbor',notice);assert.match(d.body,/53 visits/);assert.match(d.body,/Labor estimate per visit: \$240.00/);assert.match(d.body,/does not charge you for the year/);assert.match(d.html,/&lt;neighbor&gt;/);assert.doesNotMatch(d.html,/<b>approved work<\/b>/);
 const canceled=recurringMessage('Fixture Neighbor',{...notice,status:'stopped',reason:'Customer requested a break.',visitsCanceled:50});assert.match(canceled.body,/50 remaining repeat visits/);assert.match(canceled.body,/does not cancel your original visit/);assert.match(canceled.body,/invoices or payments/);
});
