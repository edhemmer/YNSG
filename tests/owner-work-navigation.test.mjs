import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const owner=readFileSync('apps/web/app/owner-work.tsx','utf8');
const workspace=readFileSync('apps/web/app/workspace.tsx','utf8');
test('Jobs primary action opens guarded in-app work, preserving request context',()=>{
 assert.match(owner,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);\n assert.match(workspace,/onOpen=\{openWork\}/);
 assert.doesNotMatch(owner,/event\.preventDefault\(\)/);
 assert.doesNotMatch(owner,/onClick=\{event=>/);
 assert.match(workspace,/requestedSection==='Work'/);
 assert.match(workspace,/setWorkRequest\(linkedRequest\)/);
});
test('blocked in-app request navigation reports a reason, not a silent ignored tap',()=>{
 assert.match(workspace,/Please finish the current action before opening another request/);
});
