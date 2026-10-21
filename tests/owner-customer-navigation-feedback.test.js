import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('customer navigation gives visible error when a command is pending',()=>{
 const handler=source.split('function openCustomer(id:string)')[1]?.split('// Keep browser navigation')[0];
 assert.ok(handler);
 assert.match(handler,/if\(pending\|\|invoiceBusy\)\{setError\('Finish the current action before opening a customer\.'\);return;\}/);
 assert.match(handler,/if\(!canLeave\(\)\)return/);
 assert.match(handler,/setCustomerFocus\(id\)/);
});
