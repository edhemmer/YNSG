import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/web/app/request-detail.tsx','utf8');
test('request detail freezes unknown owner actions instead of silently minting replacement keys',()=>{
 assert.match(source,/frozen=useRef<\{path:string;body:string\}\|null>/);
 assert.match(source,/body:frozen\.current\.body/);
 assert.match(source,/setUnknown\(true\)/);
 assert.match(source,/if\(busy\|\|frozen\.current\|\|unknown\)return false/);
 assert.match(source,/Check saved action result/);
 assert.match(source,/useBlockedEntry/);
});
test('unknown owner decisions do not claim unconfirmed customer message delivery',()=>{
 assert.match(source,/Check Activity for the actual customer-message and calendar-delivery status/);
 assert.match(source,/if\(value\?\.ok!==true\|\|value\.result===null\|\|value\.result===undefined\)/);
 assert.match(source,/if\(busy\|\|unknown\)return;onClose/);
});
