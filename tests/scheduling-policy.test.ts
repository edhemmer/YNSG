import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulingPolicy} from '../packages/contracts/scheduling.js';

test('36-hour horizon retains owner precision and rejects an empty booking window',()=>{
 const fixture={selectionMinutes:10,proposalMinutes:120,leadMinutes:1440,horizonMinutes:2160,pendingLimit:1,bufferMinutes:30};
 assert.equal(schedulingPolicy.parse(fixture).horizonMinutes,2160);
 assert.equal(schedulingPolicy.safeParse({...fixture,horizonMinutes:1440}).success,false);
 assert.equal(schedulingPolicy.safeParse({...fixture,horizonMinutes:1439}).success,false);
});
