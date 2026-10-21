import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('every owner entry uses the shared guarded history controller',()=>{
 for(const handler of ['function navigate(next:string)','function openWork(id:string)','function openCustomer(id:string)']){
   const start=source.indexOf(handler);assert.ok(start>=0,handler);
   assert.match(source.slice(start,start+900),/saveDestination/);
 }
 assert.match(source,/createWorkspaceHistory\(window/);
 assert.match(source,/readWorkspaceRoute\(url,session.memberships,org\)/);
 assert.match(source,/canLeave\(\)/);
 assert.match(source,/canSeeSection\(item\)/);
});
