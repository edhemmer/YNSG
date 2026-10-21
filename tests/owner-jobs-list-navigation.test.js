import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
test('selecting Jobs clears a previously selected work detail instead of reopening the same job',()=>{
 const navigate=source.split('function navigate(next:string)')[1]?.split('function openWork(id:string)')[0];
 assert.ok(navigate);
 assert.match(navigate,/setSection\(next\)/);
 assert.match(navigate,/setWorkRequest\(null\)/);
 assert.match(navigate,/url.searchParams.delete\('request'\)/);
 assert.doesNotMatch(navigate,/if\(next!=='Work'\)/);
});
