import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('uncertain private image upload retains the same originally approved idempotency key',()=>{
 const source=readFileSync('apps/web/app/customer-files.tsx','utf8');
 assert.match(source,/if\(!frozen\.current\)\{/);
 assert.match(source,/frozen\.current=\{file,purpose,key:crypto\.randomUUID\(\)\}/);
 assert.match(source,/if\(!unknown\)frozen\.current=null/);
 assert.match(source,/unknown&&frozen\.current&&<button/);
 assert.match(source,/if\(sending\.current\|\|busy\|\|loading\|\|\(unknown&&!frozen\.current\)\)return/);
 assert.match(source,/if\(r\.status!==409\)\{frozen\.current=null;setUnknown\(false\);\}else setUnknown\(true\)/);
});
