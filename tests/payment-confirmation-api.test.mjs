import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/web/app/api/commands/route.ts','utf8');
test('cash/Zelle receipt is confirmed only with server-generated UUID',()=>{
 assert.match(source,/c\.command==='RecordPayment'/);
 assert.match(source,/z\.object\(\{id:z\.uuid\(\)\}\)\.passthrough\(\)\.safeParse\(data\)/);
 assert.match(source,/if\(!receipt\.success\)return NextResponse\.json/);
});
test('ambiguous payment errors remain unknown, not certain rejection',()=>{
 assert.match(source,/status:denied\?403:known\?409:503/);
 assert.match(source,/Check the same saved attempt before entering another payment/);
 assert.match(source,/Cache-Control':'private, no-store/);
});
