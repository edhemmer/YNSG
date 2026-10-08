import test from 'node:test';
import assert from 'node:assert/strict';
import { visitStart, visitTimes, preferredVisitStart, visitDateError } from '../apps/web/lib/visit-start.ts';
import { localInstant } from '../packages/domain/timezone.ts';
import { publicError } from '../apps/web/lib/public-errors.ts';
const hours={weekdays:[1,2,3,4,5],earliestStart:480,latestStart:900,endOfDay:1020};
test('owner date and time fields produce canonical Chicago appointment input',()=>{
 const start=visitStart('2026-10-09','08:30',hours);
 assert.equal(start,'2026-10-09T08:30');
 assert.equal(localInstant(start,'America/Chicago'),Date.parse('2026-10-09T13:30:00Z'));
 assert.equal(visitTimes('2026-10-09',hours).length,15);
 assert.equal(visitTimes('2026-10-09',hours).at(-1),'15:00');
});
test('missing, impossible, weekend and unsupported start values fail before submission',()=>{
 for(const [date,time] of [['','08:00'],['2026-02-30','08:00'],['10/09/2026','08:00'],['2026-10-10','08:00'],['2026-10-09',''],['2026-10-09','08:15'],['2026-10-09','08:30:00'],['2026-10-09','15:30']])assert.throws(()=>visitStart(date!,time!,hours),{message:visitDateError});
 assert.throws(()=>visitStart(null,'08:00',hours));
 assert.equal(publicError(Error(visitDateError)),visitDateError);
});
test('start options follow company settings and leave the minimum work time',()=>{
 assert.deepEqual(visitTimes('2026-10-10',{weekdays:[6],earliestStart:615,latestStart:900,endOfDay:780}),['10:30','11:00']);
});
test('one-time and weekly request preferences prefill separate fields',()=>{
 assert.deepEqual(preferredVisitStart('2026-10-09 at 08:30 America/Chicago. Owner approval required.'),{date:'2026-10-09',time:'08:30'});
 assert.deepEqual(preferredVisitStart('Weekly Friday 09:00; 2026-10-09 to before 2027-10-09; America/Chicago; 12 months. Owner approval required.'),{date:'2026-10-09',time:'09:00'});
 assert.deepEqual(preferredVisitStart(),{date:'',time:''});
});
