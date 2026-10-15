import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateVisit,examplePlanningStandards,ownerTaskStandards,trainingTopics} from '../apps/web/lib/owner-job-standards.ts';

test('one-hour task allocation and combined two-hour visit minimum remain separate',()=>{
 const a=estimateVisit([{service:'Lawn care',task:'Mow, trim and blow-off'}],examplePlanningStandards,30);
 assert.equal(a.taskMinutes,60);
 assert.equal(a.visitMinutes,150);
 assert.equal(a.bufferMinutes,30);
});
test('two-hour weeding and four-hour mulch include a single visit floor, not two-hour charge per job',()=>{
 const e=estimateVisit([{service:'Yard & garden',task:'Pulling weeds by hand'},{service:'Yard & garden',task:'Bulk or bagged mulch pickup, delivery & spreading'}],examplePlanningStandards,30);
 assert.equal(e.taskMinutes,360);
 assert.equal(e.visitMinutes,390);
 assert.equal(e.breakdown[1]!.minutes,240);
});
test('a small job remains allocated for a full hour even when estimated under one hour',()=>{
 const e=estimateVisit([{service:'Lawn care',task:'Mow, trim and blow-off',sizeFactor:0.5}],examplePlanningStandards,0);
 assert.equal(e.taskMinutes,60);
 assert.equal(e.visitMinutes,120);
});
test('missing task standards fail closed instead of claiming a valid appointment duration',()=>{
 const e=estimateVisit([{service:'Unknown',task:'Unscoped task'}],examplePlanningStandards,30);
 assert.equal(e.visitMinutes,0);
 assert.equal(e.missing.length,1);
});
test('owner cannot enter negative, fractional, unreasonable durations or duplicate task standards',()=>{
 assert.equal(ownerTaskStandards.safeParse([{...examplePlanningStandards[0],plannedMinutes:30}]).success,false);
 assert.equal(ownerTaskStandards.safeParse([{...examplePlanningStandards[0],plannedMinutes:61.5}]).success,false);
 assert.equal(ownerTaskStandards.safeParse([examplePlanningStandards[0],examplePlanningStandards[0]]).success,false);
 assert.throws(()=>estimateVisit([{service:'Lawn care',task:'Mow, trim and blow-off',sizeFactor:99}],examplePlanningStandards,0));
});
test('education links have explicit sources and are not represented as AI verified outputs',()=>{
 for(const t of trainingTopics){assert.match(t.url,/^https:\/\//);assert.ok(t.source&&t.safety&&t.title);}
 assert.ok(trainingTopics.some(t=>t.id==='smart-lock-triage'));
});
