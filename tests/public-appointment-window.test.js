import test from 'node:test';import assert from 'node:assert/strict';
import {appointmentSelection,weeklyDates} from '../lib/appointment-window.js';
const now=Date.parse('2026-10-05T12:00:00Z');
test('selection parser permits published business schedules and leaves availability verification to the server',()=>{
 assert.equal(appointmentSelection({mode:'once',start:'2026-10-10T15:00:00Z'},now).weekday,'Saturday');
 assert.throws(()=>appointmentSelection({mode:'once',start:'2026-10-06T15:15:00Z'},now));
 assert.throws(()=>appointmentSelection({mode:'once',start:'2026-11-06T15:00:00Z'},now));
 assert.throws(()=>appointmentSelection({mode:'once',start:'2026-10-04T15:00:00Z'},now));
 assert.equal(appointmentSelection({mode:'once',start:null},now).start,null);
});
test('weekly intent preserves local dates across daylight-saving transitions without claiming a reservation',()=>{
 const v=appointmentSelection({mode:'weekly',start:'2026-10-06T15:00:00Z'},now);
 assert.equal(v.localTime,'10:00');assert.equal(v.endExclusive,'2027-10-06');assert.ok(v.preferredTime.includes('Owner approval required'));
 const dates=weeklyDates('2026-10-06').dates;assert.equal(dates.length,53);assert.ok(dates.every(day=>new Date(day+'T12:00Z').getUTCDay()===2));
});
