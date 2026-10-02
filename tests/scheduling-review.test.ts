import test from 'node:test';
import assert from 'node:assert/strict';
import {localInstant} from '../packages/domain/timezone.ts';
import {reviewedBusy, type OwnEvent} from '../apps/web/lib/google-availability.ts';
const own:OwnEvent={id:'own',etag:'exact',organization:'company',appointment:'appointment',revision:2,start:'2026-10-05T13:00:00Z',end:'2026-10-05T15:00:00Z'};
const event={id:own.id,etag:own.etag,start:{dateTime:own.start},end:{dateTime:own.end},extendedProperties:{private:{ynsgOrganization:own.organization,ynsgAppointment:own.appointment,ynsgRevision:'2'}}};
function transport(items:unknown[],busy=[{start:own.start,end:own.end}]):typeof fetch{return async input=>new Response(JSON.stringify(String(input).includes('/freeBusy')?{calendars:{calendar:{busy}}}:{items}),{status:200});}
const check=(fetcher:typeof fetch)=>reviewedBusy('synthetic','calendar','2026-10-05T12:00:00Z','2026-10-05T16:00:00Z','America/Chicago',own,fetcher);
test('local input respects company timezone and rejects both DST ambiguities',()=>{
 assert.equal(localInstant('2026-10-05T08:00','America/Chicago'),Date.parse(own.start));
 assert.throws(()=>localInstant('2026-11-01T01:30','America/Chicago'));
 assert.throws(()=>localInstant('2026-03-08T02:30','America/Chicago'));
 assert.throws(()=>localInstant('2026-02-30T08:00','America/Chicago'));
});
test('exact mapped event can be exempted without hiding overlapping external work',async()=>{
 const external={id:'external',etag:'external',start:{dateTime:'2026-10-05T14:00:00Z'},end:{dateTime:'2026-10-05T16:00:00Z'}};
 const result=await check(transport([event,external],[{start:own.start,end:'2026-10-05T16:00:00Z'}]));
 assert.deepEqual(result.busy,[{start:'2026-10-05T14:00:00.000Z',end:'2026-10-05T16:00:00.000Z'}]);
});
test('changed or absent mapped event and unexplained free/busy fail closed',async()=>{
 await assert.rejects(check(transport([{...event,etag:'changed'}])),/GOOGLE_EVENT_CHANGED/);
 await assert.rejects(check(transport([])),/GOOGLE_EVENT_CHANGED/);
 await assert.rejects(check(transport([event],[{start:own.start,end:'2026-10-05T16:00:00Z'}])),/BUSY_DATA_MISMATCH/);
});
test('provider pagination retains busy events on later pages',async()=>{
 let pages=0;
 const result=await check(async input=>{
  const url=String(input);
  if(url.includes('/freeBusy'))return new Response(JSON.stringify({calendars:{calendar:{busy:[{start:own.start,end:own.end}]}}}));
  pages++;
  return new Response(JSON.stringify(url.includes('pageToken=next')?{items:[{id:'later',start:{dateTime:'2026-10-05T15:30:00Z'},end:{dateTime:'2026-10-05T16:00:00Z'}}]}:{items:[event],nextPageToken:'next'}));
 });
 assert.equal(pages,2);assert.equal(result.busy.length,1);
});
