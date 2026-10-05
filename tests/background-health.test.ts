import test from 'node:test';import assert from 'node:assert/strict';
import {workerHealth,type BackgroundHealth} from '../apps/web/lib/background-health.ts';
const now=Date.parse('2026-10-05T20:00:00Z'),time=new Date(now-60000).toISOString();
const health:BackgroundHealth={checkedAt:time,workers:[{kind:'mail',lastRequestedAt:time,lastSuccessfulAt:time,lastOutcome:'success'}],queue:{needsReview:0,overdue:0,waiting:0}};
test('active jobs require recent successful execution; saved schedules alone are insufficient',()=>{
 assert.equal(workerHealth(health,'mail',true,true,now),'Running');
 assert.equal(workerHealth(null,'mail',true,true,now),'Needs attention');
 assert.equal(workerHealth(health,'calendar',true,true,now),'Needs attention');
 assert.equal(workerHealth(health,'mail',false,true,now),'Paused');
 assert.equal(workerHealth(health,'mail',true,false,now),'Paused');
 assert.equal(workerHealth(health,'mail',true,true,now+300000),'Needs attention');
 for(const patch of [{lastOutcome:'failed' as const},{lastSuccessfulAt:null},{lastRequestedAt:'invalid'},{lastRequestedAt:new Date(now+60000).toISOString()}])assert.equal(workerHealth({...health,workers:[{...health.workers[0]!,...patch}]},'mail',true,true,now),'Needs attention');
});
