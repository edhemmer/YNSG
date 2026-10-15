import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync('apps/web/app/api/invoice-delivery/route.ts','utf8');
test('invoice email request requires saved canonical outbox receipt',()=>{assert.match(source,/z\.object\(\{id:z\.uuid\(\),status:z\.string\(\)\.min\(1\)\}\)/);assert.match(source,/if\(!receipt\.success\)/);});
test('unknown outcome is not claimed rejected or delivered',()=>{assert.match(source,/status:denied\?403:known\?409:503/);assert.match(source,/queue result is uncertain/);assert.match(source,/private, no-store/);});
