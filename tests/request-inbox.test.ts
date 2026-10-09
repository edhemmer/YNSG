import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxSearch,requestStage,requestTiming,visitState,type InboxRequest,type Visit} from '../apps/web/lib/request-inbox.ts';
const visit=(status:string,expires_at:string|null=null)=>({status,expires_at}) as Visit;
const request=(status:string,appointments:Visit[])=>({status,appointments}) as InboxRequest;
test('request inbox highlights actionable appointments and respects expired holds and terminal requests',()=>{
 const now=Date.parse('2026-10-08T10:00Z');
 assert.equal(visitState(visit('proposal','2026-10-08T09:59Z'),now),'expired');
 assert.equal(requestStage(request('submitted',[visit('proposal','2026-10-08T09:59Z')]),now).label,'New request');
 assert.equal(requestStage(request('reviewing',[visit('proposal','2026-10-09T09:59Z')]),now).label,'Needs approval');
 assert.equal(requestStage(request('reviewing',[visit('reserved'),visit('proposal','2026-10-09T09:59Z')]),now).label,'Needs approval');
 assert.equal(requestStage(request('declined',[visit('proposal','2026-10-09T09:59Z')]),now).label,'Declined');
 assert.equal(requestStage(request('reviewing',[visit('reserved')]),now).label,'Confirmed');
});
test('request summaries show appointment arrival in business timezone, prioritizing active proposals',()=>{
 const now=Date.parse('2026-10-09T12:00Z');
 const reserved={...visit('reserved'),start_at:'2026-10-13T13:00:00Z',arrival_at:'2026-10-13T13:00:00Z'};
 const proposed={...visit('proposal','2026-10-10T12:00Z'),start_at:'2026-10-14T13:00:00Z',arrival_at:'2026-10-14T14:00:00Z'};
 const r={...request('reviewing',[reserved,proposed]),original_submission:{preferredTime:'2026-10-15 at 08:00'}} as InboxRequest;
 assert.equal(requestTiming(r,'America/Chicago',now).label,'Requested appointment');
 assert.match(requestTiming(r,'America/Chicago',now).text,/Oct 14, 2026.*9:00 AM CDT/);
 assert.equal(requestTiming(r,'America/Chicago',Date.parse('2026-10-11T12:00Z')).label,'Confirmed appointment');
 r.appointments=[];
 assert.match(requestTiming(r,'America/Chicago',now).text,/Oct 15, 2026.*8:00 AM/);
 r.original_submission.preferredTime='Weekly Monday 09:00; 2026-10-12 onwards';
 assert.match(requestTiming(r,'America/Chicago',now).text,/Weekly Monday/);
 r.original_submission.preferredTime='';
 assert.match(requestTiming(r,'America/Chicago',now).text,/No time selected/);
 r.original_submission.preferredTime='2026-02-30 at 09:00';
 assert.equal(requestTiming(r,'America/Chicago',now).label,'Requested timing');
});
test('inbox search preserves useful contact text while excluding filter operators and wildcards',()=>{
 assert.equal(inboxSearch(' José O’Neil +1 555-0100 '),'José O’Neil +1 555-0100');
 assert.equal(inboxSearch('alex@example.test'),'alex@example.test');
 const value=inboxSearch('x*%,)status.eq.declined,("y');
 assert.doesNotMatch(value,/[*%,()"]|[\r\n]/);
 assert.equal(inboxSearch('A'.repeat(200)).length,100);
});
