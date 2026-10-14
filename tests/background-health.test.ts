import test from 'node:test';import assert from 'node:assert/strict';
import {workerHealth,visibleBackgroundQueue,type BackgroundHealth} from '../apps/web/lib/background-health.ts';
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

test('paused optional exports are separate from active delays, while uncertain results still need review',()=>{
 const mail={needsReview:0,overdue:0,waiting:4},calendar={needsReview:0,overdue:6,waiting:6};
 assert.deepEqual(visibleBackgroundQueue(mail,calendar,{mail:true,calendar:false}),{needsReview:0,overdue:0,waiting:4,pausedMailWaiting:0,pausedCalendarWaiting:6});
 assert.equal(visibleBackgroundQueue({...mail,overdue:2},{...calendar,needsReview:1},{mail:true,calendar:false}).overdue,2);
 assert.equal(visibleBackgroundQueue(mail,{...calendar,needsReview:1},{mail:true,calendar:false}).needsReview,1);
 assert.equal(visibleBackgroundQueue(mail,calendar,{mail:true,calendar:true}).overdue,6);
 assert.equal(visibleBackgroundQueue(mail,calendar,{mail:false,calendar:false}).pausedMailWaiting,4);
 assert.throws(()=>visibleBackgroundQueue({...mail,overdue:-1},calendar,{mail:true,calendar:false}));
});
