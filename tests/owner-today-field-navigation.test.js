import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../apps/web/app/'+p,import.meta.url),'utf8');
const day=read('owner-day.tsx'),center=read('command-center.tsx');
test('Today opens the next job through guarded in-app navigation with no owner reload',()=>{
 assert.match(center,/onOpen\(next.request\)/);
 assert.match(day,/onClick=\{\(\)=>onOpen\(c\.requestId\)\}/);
 assert.doesNotMatch(day,/href=\{'\/owner\?'/);
});
test('Today prioritizes one next job and keeps later stops available when asked',()=>{
 assert.match(day,/data\.calls\.slice\(0,1\)/);
 assert.match(day,/<summary>Next /);
 assert.match(day,/data\.calls\.slice\(1,3\)/);
});
