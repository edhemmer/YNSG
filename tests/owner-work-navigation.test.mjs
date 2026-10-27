import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const owner=readFileSync('apps/web/app/owner-work.tsx','utf8');
const workspace=readFileSync('apps/web/app/workspace.tsx','utf8');
test('Jobs primary action opens guarded in-app work, preserving request context',()=>{
 assert.match(owner,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);
 assert.match(workspace,/onOpen=\{openWork\}/);
 assert.doesNotMatch(owner,/event\.preventDefault\(\)/);
 assert.doesNotMatch(owner,/onClick=\{event=>/);
 assert.match(workspace,/readWorkspaceRoute/);
 assert.match(workspace,/setWorkRequest\(route.section==='Work'\?route.request:null\)/);
});
test('blocked in-app request navigation reports a reason, not a silent ignored tap',()=>{
 assert.match(workspace,/Please finish the current action before opening another request/);
});

test('unfinished job cards expose direct directions without replacing the in-app job action',()=>{
 assert.match(owner,/navigationUrl\(address\)/);
 assert.doesNotMatch(owner,/navigationUrl\(address\)\|\|'#'/);
 assert.match(owner,/aria-label=\{"Directions to "\+j\.name\}/);
 assert.match(owner,/target="_blank" rel="noopener noreferrer"/);
 assert.match(owner,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);
});

test('owner field cards distinguish paused jobs from actual work-in-progress',()=>{
 assert.match(owner,/j\.status==='paused'\?'Resume job'/);
 assert.match(owner,/j\.status==='working'\?'In progress':'Needs attention'/);
});

test('field job status quick filters preserve all jobs and backend pagination',()=>{
 assert.match(owner,/status:statusFilter/);
 assert.match(owner,/setPage\(0\);setStatusFilter\(value\)/);
 assert.match(owner,/aria-pressed=\{statusFilter===value\}/);
 assert.match(owner,/Choose All to see other jobs/);
 assert.match(owner,/data\.hasMore\|\|page>0/);
});

test('job filters apply before database pagination and retain owner authorization',()=>{
 const read=readFileSync('apps/web/lib/owner-work-read.ts','utf8');
 const route=readFileSync('apps/web/app/api/owner-work/route.ts','utf8');
 assert.match(read,/status==='all'\?query\.in/);
 assert.match(read,/query\.eq\('status',status\)/);
 assert.match(read,/\.range\(page\*20,page\*20\+20\)/);
 assert.match(read,/OWNER_ACCESS_REQUIRED/);
 assert.match(route,/readOwnerWork\(db,org,user\.id,page,status\)/);
});
