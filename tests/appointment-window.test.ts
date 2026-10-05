import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentSelection,addDays,weeklyDates,yearEnd} from '../lib/appointment-window.js';
// @ts-expect-error Shared public gateway is JavaScript.
import {websiteAvailability} from '../lib/website-availability.js';
const now=Date.parse('2026-10-04T16:00:00Z');
test('one-time date boundary is 30 local calendar days and server rejects later and past starts',()=>{
 assert.equal(appointmentSelection({mode:'once',start:'2026-11-03T15:00:00Z'},now).firstDate,'2026-11-03');
 assert.throws(()=>appointmentSelection({mode:'once',start:'2026-11-04T15:00:00Z'},now));
 assert.throws(()=>appointmentSelection({mode:'once',start:'2026-10-02T15:00:00Z'},now));
 assert.throws(()=>appointmentSelection({mode:'once',start:'2026-10-05T14:15:00Z'},now));
 assert.equal(appointmentSelection({mode:'once',start:'2026-10-10T15:00:00Z'},now).weekday,'Saturday');
});
test('weekly pattern captures local weekday/time and an exact 12-month exclusive ending',()=>{
 const v=appointmentSelection({mode:'weekly',start:'2026-10-05T14:00:00Z'},now);
 assert.equal(v.weekday,'Monday');assert.equal(v.localTime,'09:00');assert.equal(v.endExclusive,'2027-10-05');
 assert.ok(v.preferredTime.includes('Owner approval required'));assert.ok(v.preferredTime.length<=180);
 const series=weeklyDates('2026-10-05');assert.equal(series.dates.length,53);assert.ok(series.dates.every(d=>new Date(d+'T12:00Z').getUTCDay()===1));assert.equal(series.dates.at(-1),'2027-10-04');
 assert.equal(yearEnd('2028-02-29'),'2029-02-28');assert.throws(()=>addDays('2026-02-30',1));
});
test('weekly initial start obeys same 30-day limit and no-time fallback claims no reservation',()=>{
 assert.throws(()=>appointmentSelection({mode:'weekly',start:'2026-11-04T15:00:00Z'},now));
 assert.equal(appointmentSelection({mode:'once',start:null},now).preferredTime,'');
 assert.ok(appointmentSelection({mode:'weekly',start:null},now).preferredTime.includes('to be arranged'));
 assert.throws(()=>appointmentSelection({mode:'daily',start:null},now));
 assert.throws(()=>appointmentSelection({mode:'once',start:null,organization:'forged'},now));
});
test('availability gateway fails closed on provider/setup issues and strips private fields',async()=>{
 const env={CRM_AVAILABILITY_URL:'https://synthetic.vercel.app/api/public-availability'},start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+93600000).toISOString(),validUntil=new Date(Date.now()+60000).toISOString();
 await assert.rejects(websiteAvailability({},async()=>{throw Error('Must not fetch');}));
 await assert.rejects(websiteAvailability(env,async()=>Response.json({error:'private raw error'},{status:503})));
 await assert.rejects(websiteAvailability(env,async()=>Response.json({reserved:false,timezone:'America/Chicago',validUntil,times:[{start,end:'invalid'}]})));
 const result=await websiteAvailability(env,async()=>Response.json({reserved:false,timezone:'America/Chicago',validUntil,times:[{start,end,customer:'Private name'}],calendarId:'private'}));
 assert.deepEqual(result,{times:[{start,end}],timezone:'America/Chicago',validUntil,reserved:false});
});
