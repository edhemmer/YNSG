import test from 'node:test';
import assert from 'node:assert/strict';
import {monthCells,monthWindow,shiftMonth,spansDay,serviceTone,groupCalendarDays,activeCalendarVisit} from '../apps/web/lib/month-calendar.ts';
test('paper calendar aligns weekdays, retains leap day and ends in complete weeks',()=>{
 const october=monthCells('2026-10');assert.equal(october.length,35);assert.equal(october[4],'2026-10-01');assert.equal(october[34],'2026-10-31');
 const leap=monthCells('2028-02');assert.equal(leap.filter(Boolean).length,29);assert.ok(leap.includes('2028-02-29'));assert.equal(leap.length%7,0);
 assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
test('month windows follow company timezone across daylight saving boundaries',()=>{
 assert.deepEqual(monthWindow('2026-03','America/Chicago'),{start:'2026-03-01T06:00:00.000Z',end:'2026-04-01T05:00:00.000Z'});
 assert.deepEqual(monthWindow('2026-11','America/Chicago'),{start:'2026-11-01T05:00:00.000Z',end:'2026-12-01T06:00:00.000Z'});
 assert.throws(()=>monthWindow('2026-13','America/Chicago'));assert.throws(()=>monthWindow('1999-12','America/Chicago'));
});
test('multi-day blocks occupy every local day and midnight end excludes the following day',()=>{
 const start='2026-10-04T05:00:00Z',end='2026-10-07T05:00:00Z';
 for(const day of ['2026-10-04','2026-10-05','2026-10-06'])assert.equal(spansDay(start,end,day,'America/Chicago'),true);
 assert.equal(spansDay(start,end,'2026-10-07','America/Chicago'),false);
 assert.equal(spansDay('2026-10-05T00:00:00Z','2026-10-05T01:00:00Z','2026-10-04','America/Chicago'),true);
});
test('cross-category visits retain mixed color and unknown offerings use a neutral color',()=>{
 assert.equal(serviceTone(['Lawn care']),'lawn');assert.equal(serviceTone(['Help around the home','Lawn care']),'other');assert.equal(serviceTone(['Yard & garden']),'garden');assert.equal(serviceTone(['Something else']),'other');
});

test('month grouping preserves multiple visits and one long block on every affected day',()=>{
 const rows=[{id:'a',start:'2026-10-04T13:00:00Z',end:'2026-10-04T15:00:00Z'},{id:'b',start:'2026-10-04T16:00:00Z',end:'2026-10-04T18:00:00Z'},{id:'block',start:'2026-10-05T05:00:00Z',end:'2026-10-08T05:00:00Z'}];
 const days=groupCalendarDays(rows,monthCells('2026-10'),r=>r.start,r=>r.end,'America/Chicago');
 assert.deepEqual(days['2026-10-04']?.map(r=>r.id),['a','b']);assert.equal(days['2026-10-06']?.[0]?.id,'block');assert.deepEqual(days['2026-10-08'],[]);
});

test('canceled appointments and expired holds are not presented as active visits',()=>{
 const now=Date.parse('2026-10-04T13:00:00Z');
 assert.equal(activeCalendarVisit({status:'canceled',expires_at:null},now),false);
 assert.equal(activeCalendarVisit({status:'proposal',expires_at:'2026-10-04T12:00:00Z'},now),false);
 assert.equal(activeCalendarVisit({status:'reserved',expires_at:'2026-10-03T12:00:00Z'},now),true);
});
