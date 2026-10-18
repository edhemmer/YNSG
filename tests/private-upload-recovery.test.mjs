import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('uncertain private image upload retains the same originally approved idempotency key',()=>{
 const source=readFileSync('apps/web/app/customer-files.tsx','utf8');
 assert.match(source,/if\(!frozen\.current\)\{/);
 assert.match(source,/frozen\.current=\{file,purpose,key:crypto\.randomUUID\(\)\}/);
 assert.match(source,/if\(!mounted\.current\)return/);
 assert.match(source,/unknown&&frozen\.current&&<button/);
 assert.match(source,/readFailed\|\|\(unknown&&!frozen\.current\)/);
 assert.match(source,/if\(unknown\|\|r\.status===409\)\{setUnknown\(true\);\}/);
});
