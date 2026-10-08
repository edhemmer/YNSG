import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxSearch,requestStage,visitState,type InboxRequest,type Visit} from '../apps/web/lib/request-inbox.ts';
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
test('inbox search preserves useful contact text while excluding filter operators and wildcards',()=>{
 assert.equal(inboxSearch(' José O’Neil +1 555-0100 '),'José O’Neil +1 555-0100');
 assert.equal(inboxSearch('alex@example.test'),'alex@example.test');
 const value=inboxSearch('x*%,)status.eq.declined,("y');
 assert.doesNotMatch(value,/[*%,()"]|[\r\n]/);
 assert.equal(inboxSearch('A'.repeat(200)).length,100);
});
