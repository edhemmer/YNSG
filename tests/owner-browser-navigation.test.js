import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('owner navigation creates history and restores destinations',()=>{
 for(const handler of ['function navigate(next:string)','function openWork(id:string)','function openCustomer(id:string)']){
   const start=source.indexOf(handler);
   assert.ok(start>=0,handler);
   assert.match(source.slice(start,start+900),/window\.history\.pushState\(null,'',url\)/);
 }
 assert.match(source,/addEventListener\('popstate',onHistory\)/);
 assert.match(source,/removeEventListener\('popstate',onHistory\)/);
 assert.match(source,/params\.get\('request'\)/);
 assert.match(source,/params\.get\('customer'\)/);
 assert.match(source,/canLeave\(\)/);
 assert.match(source,/canSeeSection\(item\)/);
});
