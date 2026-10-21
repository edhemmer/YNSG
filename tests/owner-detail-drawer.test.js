import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('opening a work detail dismisses the mobile workspace drawer',()=>{
 const body=source.split('function openWork(id:string)')[1]?.split('function openCustomer(id:string)')[0];
 assert.ok(body,'openWork handler exists');
 assert.match(source,/setCustomerFocus\(route.customer\);setMobileNav\(false\)/);
 assert.match(body,/section:'Work',request:id,customer:null/);
 assert.match(source,/setWorkRequest\(route.section==='Work'/);
});
test('opening customer detail dismisses drawer without losing context',()=>{
 const body=source.split('function openCustomer(id:string)')[1]?.split('async function loadSession()')[0];
 assert.ok(body,'openCustomer handler exists');
 assert.match(source,/setCustomerFocus\(route.customer\);setMobileNav\(false\)/);
 assert.match(body,/section:'Customers',request:null,customer:id/);
 assert.match(source,/setCustomerFocus\(route.customer\)/);
});
