import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const work=readFileSync(new URL('../apps/web/app/owner-work.tsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('Jobs opens existing workspace records instead of reloading owner authentication',()=>{
 assert.match(work,/onOpen:\(requestId:string\)=>void/);
 assert.match(work,/onClick=\{\(\)=>onOpen\(j\.request\)\}/);
 assert.doesNotMatch(work,/href=\{'\/owner\?'/);
 assert.match(workspace,/onOpen=\{openWork\}/);
 assert.match(workspace,/function openWork\(id:string\)/);
});
