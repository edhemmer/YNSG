import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringPreview} from '../packages/domain/recurring-preview';
import {localMinute} from '../packages/domain/timezone';
const clock=Date.parse('2026-10-04T08:00:00Z');
const base={localStart:'2026-10-05T09:00',durationMinutes:120,timezone:'America/Chicago',clock,rules:{weekdays:[1,2,3,4,5],earliestStart:480,latestStart:900,endOfDay:1020,bufferMinutes:30,leadMinutes:1440,horizonMinutes:43200},busy:[],verifiedUntil:clock+60000,travelBeforeMinutes:0,travelAfterMinutes:0};
test('full-year preview retains local weekday/time across both DST changes without claiming reservations',()=>{
 const result=recurringPreview(base);
 assert.equal(result.occurrences.length,53);assert.equal(result.conflicts,0);assert.equal(result.reserved,false);
 assert.equal(result.endExclusive,'2027-10-05');
 assert.ok(result.occurrences.every(v=>localMinute(Date.parse(v.start),base.timezone).endsWith('T09:00')));
 assert.equal(result.occurrences[0]!.start,'2026-10-05T14:00:00.000Z');
 assert.equal(result.occurrences[5]!.start,'2026-11-09T15:00:00.000Z');
 assert.equal(result.occurrences[23]!.start,'2027-03-15T14:00:00.000Z');
});
test('later conflicts are detected beyond the one-time horizon and travel buffer is enforced',()=>{
 const result=recurringPreview({...base,busy:[{start:Date.parse('2027-01-04T15:00Z'),end:Date.parse('2027-01-04T17:00Z')},{start:Date.parse('2027-01-11T14:20Z'),end:Date.parse('2027-01-11T14:40Z')}],travelBeforeMinutes:20});
 assert.equal(result.conflicts,2);
 assert.equal(result.occurrences.find(v=>v.date==='2027-01-04')!.available,false);
 assert.equal(result.occurrences.find(v=>v.date==='2027-01-11')!.available,false);
});
test('first date must be in the 30-day window and unavailable provider facts fail closed',()=>{
 assert.throws(()=>recurringPreview({...base,localStart:'2026-11-09T09:00'}));
 assert.throws(()=>recurringPreview({...base,verifiedUntil:clock}));
 assert.throws(()=>recurringPreview({...base,rules:{...base.rules,bufferMinutes:null}}));
 const narrow=recurringPreview({...base,rules:{...base.rules,horizonMinutes:60}});
 assert.equal(narrow.occurrences[0]!.available,false);
});
