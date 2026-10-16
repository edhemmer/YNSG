import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const scheduling=readFileSync('apps/web/app/api/scheduling/route.ts','utf8');
const cancel=readFileSync('apps/web/app/api/appointment-cancel/route.ts','utf8');
test('scheduling unknown database responses are never described as definite rejection',()=>{
 assert.match(scheduling,/status:denied\?403:known\?409:503/);
 assert.match(scheduling,/scheduling result is unknown/);
 assert.match(scheduling,/Cache-Control':'private, no-store/);
});
test('appointment cancellation preserves uncertainty and known permission/stale errors',()=>{
 assert.match(cancel,/status:denied\?403:known\?409:503/);
 assert.match(cancel,/cancellation result is unknown/);
 assert.match(cancel,/STALE_REVISION/);
 assert.match(cancel,/private, no-store/);
});
