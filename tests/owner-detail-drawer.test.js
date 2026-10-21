import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('opening a work detail dismisses the mobile workspace drawer',()=>{
 const body=source.match(/function openWork\(id:string\)\{([\s\S]*?)\n\s*\}/)?.[1];
 assert.ok(body,'openWork handler exists');
 assert.match(body,/setMobileNav\(false\)/);
 assert.match(body,/setWorkRequest\(id\)/);
 assert.match(body,/setSection\('Work'\)/);
});
test('opening customer detail dismisses drawer without losing context',()=>{
 const body=source.match(/function openCustomer\(id:string\)\{([\s\S]*?)\n\s*\}/)?.[1];
 assert.ok(body,'openCustomer handler exists');
 assert.match(body,/setMobileNav\(false\)/);
 assert.match(body,/setCustomerFocus\(id\)/);
 assert.match(body,/setSection\('Customers'\)/);
});
