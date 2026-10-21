import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('workspace navigation rejects role-inaccessible and unknown destinations before updating state or URL',()=>{
 const handler=source.split('function navigate(next:string)')[1]?.split('function openWork(id:string)')[0];
 assert.ok(handler);
 const roleCheck=handler.indexOf('sections.some(item=>item.key===next&&canSeeSection(item))');
 assert.ok(roleCheck>=0);
 assert.ok(roleCheck<handler.indexOf('saveDestination'));
 assert.match(handler,/That workspace destination is not available to your account/);
});
