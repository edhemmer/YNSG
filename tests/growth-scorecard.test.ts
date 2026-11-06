import test from 'node:test';
import assert from 'node:assert/strict';
import {localWeekStart,weeklyBookedHours,leadSourceCounts,growthScorecard,scorecardTargets} from '../apps/web/lib/growth-scorecard.ts';

const tz='America/Chicago';
test('local weeks start Monday in the business timezone, including late Sunday nights',()=>{
 assert.equal(localWeekStart(Date.parse('2026-11-06T17:00:00Z'),tz),'2026-11-02');
 // Sunday 11:30pm Chicago is already Monday in UTC; it still belongs to the earlier week.
 assert.equal(localWeekStart(Date.parse('2026-11-09T05:30:00Z'),tz),'2026-11-02');
 assert.equal(localWeekStart(Date.parse('2026-11-09T06:30:00Z'),tz),'2026-11-09');
});
test('booked hours land in the right week and ignore bad or overlong visits',()=>{
 const now=Date.parse('2026-11-06T17:00:00Z');
 const weeks=weeklyBookedHours([
  {start_at:'2026-11-03T15:00:00Z',end_at:'2026-11-03T17:00:00Z'},
  {start_at:'2026-11-04T15:00:00Z',end_at:'2026-11-04T16:30:00Z'},
  {start_at:'2026-10-27T15:00:00Z',end_at:'2026-10-27T19:00:00Z'},
  {start_at:'2026-11-05T15:00:00Z',end_at:'2026-11-05T14:00:00Z'},
  {start_at:'2026-11-05T00:00:00Z',end_at:'2026-11-06T00:00:00Z'},
  {start_at:'2025-01-01T15:00:00Z',end_at:'2025-01-01T17:00:00Z'},
 ],now,tz,3);
 assert.deepEqual(weeks,[{week:'2026-10-19',hours:0},{week:'2026-10-26',hours:4},{week:'2026-11-02',hours:3.5}]);
 assert.throws(()=>weeklyBookedHours([],now,tz,0));
});
test('lead sources are counted, unknown answers become Not given, biggest first',()=>{
 assert.deepEqual(leadSourceCounts(['Facebook','Nextdoor','Facebook',null,undefined,'Billboard']),[{source:'Facebook',count:2},{source:'Not given',count:3},{source:'Nextdoor',count:1}].sort((a,b)=>b.count-a.count||a.source.localeCompare(b.source)));
 assert.deepEqual(leadSourceCounts([]),[]);
});
test('phase follows the playbook gates and the current week never counts toward the build gate',()=>{
 const empty=[0,0,0,0,0].map((h,i)=>({week:`w${i}`,hours:h}));
 assert.equal(growthScorecard({completedJobs:0,reviews:null,weeks:empty}).phase,'Launch');
 assert.equal(growthScorecard({completedJobs:12,reviews:4,weeks:empty}).phase,'Launch');
 assert.equal(growthScorecard({completedJobs:12,reviews:5,weeks:empty}).phase,'Build');
 const full=[41,40,45,42,0].map((hours,i)=>({week:`w${i}`,hours}));
 const ready=growthScorecard({completedJobs:60,reviews:20,weeks:full});
 assert.equal(ready.phase,'First hire');assert.equal(ready.gates[1].met,true);
 const currentOnly=[30,41,40,45,90].map((hours,i)=>({week:`w${i}`,hours}));
 assert.equal(growthScorecard({completedJobs:60,reviews:20,weeks:currentOnly}).gates[1].met,false);
 assert.match(growthScorecard({completedJobs:3,reviews:null,weeks:empty}).gates[0].progress,/3 of 10 jobs · reviews not entered/);
 assert.equal(scorecardTargets.reviewGoal,50);
 assert.throws(()=>growthScorecard({completedJobs:-1,reviews:0,weeks:empty}));
});
