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
 assert.match(owner,/aria-label=\{"Directions to "\+j\.name\}/);
 assert.match(owner,/target="_blank" rel="noopener noreferrer"/);
 assert.match(owner,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);
});
