import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/web/app/workspace.tsx','utf8');
test('Today and Jobs avoid redundant instructional banners',()=>{
 assert.doesNotMatch(source,/See the month, open a visit or block unavailable time/);
 assert.doesNotMatch(source,/Choose a customer request to continue its complete workflow/);
 assert.doesNotMatch(source,/Appointment, agreed price, work, invoice and payment for this request/);
});
test('Jobs retains direct inbox shortcut and unified selected request flow',()=>{
 assert.match(source,/owner-context-shortcut/);
 assert.match(source,/>All requests <Icon name="arrow"\/>/);
 assert.match(source,/workRequest\?data\.requests\.filter\(r=>r\.id===workRequest\)/);
 assert.match(source,/onOpen=\{openWork\}/);
});
