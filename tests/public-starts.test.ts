import test from 'node:test';import assert from 'node:assert/strict';
import {publicStartMinutes} from '../packages/domain/public-starts.ts';
const rules={weekdays:[1,2,3,4,5],earliestStart:480,latestStart:900,endOfDay:1020};
test('published last-start rule includes 3 p.m. with a full two-hour window',()=>{
 const starts=publicStartMinutes('2026-10-07',rules);assert.equal(starts[0],480);assert.equal(starts.at(-1),900);assert.equal(starts.length,15);
 assert.deepEqual(publicStartMinutes('2026-10-10',rules),[]);
 assert.deepEqual(publicStartMinutes('2026-10-11',rules),[]);
});
test('changed business days and hours determine candidates without YNSG-specific constants',()=>{
 const custom={weekdays:[7],earliestStart:555,latestStart:1080,endOfDay:1140};
 const starts=publicStartMinutes('2026-10-11',custom);assert.equal(starts[0],570);assert.equal(starts.at(-1),1020);
 assert.deepEqual(publicStartMinutes('2026-10-12',custom),[]);
 assert.equal(publicStartMinutes('2026-10-07',{...rules,endOfDay:900}).at(-1),780);
 assert.deepEqual(publicStartMinutes('2026-10-07',{...rules,earliestStart:900,endOfDay:900}),[]);
 assert.throws(()=>publicStartMinutes('2026-02-30',rules));
});
