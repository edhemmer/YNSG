import test from 'node:test';
import assert from 'node:assert/strict';
import { openTimesToReview } from '../packages/domain/availability.ts';
const clock = Date.parse('2026-10-01T14:00:00Z'); // Thursday 9AM Chicago
const base = {
 clock, timezone: 'America/Chicago', durationMinutes: 120,
 rules: { weekdays:[1,2,3,4,5], earliestStart:480,latestStart:900,endOfDay:1020,
  bufferMinutes:30, selectionMinutes:10,proposalMinutes:120,leadMinutes:1440,horizonMinutes:2160,pendingLimit:1 },
 resources:[{id:'operator',kind:'operator',status:'available'},{id:'mower',kind:'equipment',status:'available'}],
 selectedResources:['operator'], reservations:[], blocks:[], externalBusy:[], externalBusyVerifiedUntil:clock+60000,
 windowEnd:clock+36*60*60000,
};
test('only configured 24–36h starts appear; last 3–5PM remains valid',()=>{
 const times=openTimesToReview(base);
 assert.equal(times[0]!.start,Date.parse('2026-10-02T14:00:00Z'));
 assert.equal(times.at(-1)!.start,Date.parse('2026-10-02T20:00:00Z'));
 assert.equal(times.at(-1)!.end,Date.parse('2026-10-02T22:00:00Z'));
 assert.equal(times.length,13);
 assert.equal(new Set(times.map(t=>t.start)).size,times.length);
});
test('all selected resources, owner blocks, Google busy and buffers reduce options',()=>{
 const start=Date.parse('2026-10-02T16:00:00Z'),end=start+120*60000;
 const reservation={resourceId:'mower',start,end};
 assert.equal(openTimesToReview({...base,reservations:[reservation]}).length,13);
 for(const altered of [
  {...base,selectedResources:['operator','mower'],reservations:[reservation]},
  {...base,blocks:[{start,end}]}, {...base,externalBusy:[{start,end}]},
 ]){
  const times=openTimesToReview(altered);
  assert.ok(times.length<13);
  assert.ok(times.every(t=>t.end<=start-30*60000||t.start>=end+30*60000));
 }
});
test('closed-day narrow window stays empty rather than widening',()=>{
 const clock=Date.parse('2026-10-02T22:00:00Z');
 assert.deepEqual(openTimesToReview({...base,clock,externalBusyVerifiedUntil:clock+60000,windowEnd:clock+36*60*60000}),[]);
});
test('fails closed for stale facts, invalid intervals, missing or unavailable resources',()=>{
 for(const altered of [
  {...base,externalBusyVerifiedUntil:clock}, {...base,selectedResources:[]},
  {...base,selectedResources:['operator','operator']}, {...base,selectedResources:['mower']},
  {...base,resources:base.resources.map(r=>({...r,status:'out_of_service'}))},
  {...base,externalBusy:[{start:clock,end:clock}]}, {...base,rules:{...base.rules,bufferMinutes:null}},
 ])assert.throws(()=>openTimesToReview(altered));
});
test('DST and non-half-hour UTC offsets preserve local half-hour starts',()=>{
 const clock=Date.parse('2026-11-01T15:00:00Z');
 const times=openTimesToReview({...base,clock,externalBusyVerifiedUntil:clock+60000,windowEnd:clock+36*60*60000});
 assert.equal(times.at(-1)!.start,Date.parse('2026-11-02T21:00:00Z'));
 const localClock=Date.parse('2026-10-01T00:00:00Z');
 const india=openTimesToReview({...base,clock:localClock,externalBusyVerifiedUntil:localClock+60000,windowEnd:localClock+36*60*60000,timezone:'Asia/Kathmandu'});
 assert.ok(india.length>0);
 assert.ok(india.every(t=>Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Kathmandu',minute:'2-digit'}).format(t.start))%30===0));
});
