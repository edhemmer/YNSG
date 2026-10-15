import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewUnforeseenJob,hiddenConditionPreflight} from '../apps/web/lib/unforeseen-job-cost.ts';

const good={
 kind:'wrong_part',description:'Wrong-size anchor discovered after inspection',
 expectedHandsOnMinutes:30,supplyRunMinutes:45,minutesBeforeNextCommitment:120,
 ownerLaborCostCentsPerHour:6000,businessMaterialCostCents:1500,additionalApprovedChargeCents:11000,
 customerApprovedExtra:true,materialCompatibilityConfirmed:true,safeConditionsConfirmed:true,permittedByLicenseAndScope:true
} as const;
test('supplier run is labor opportunity cost, not free time',()=>{
 const r=reviewUnforeseenJob(good);
 assert.equal(r.extraMinutes,75);
 assert.equal(r.laborOpportunityCostCents,7500);
 assert.equal(r.estimatedIncrementalContributionCents,2000);
 assert.equal(r.decision,'review-before-proceed');
});
test('even fully checked plumbing is held for professional review',()=>{
 for(const kind of ['supply_line','shutoff_valve','damaged_connection','hidden_damage'] as const){
  const r=reviewUnforeseenJob({...good,kind});
  assert.equal(r.decision,'stop-refer');
 }
});
test('cannot continue when time conflicts with the next customer',()=>{
 const r=reviewUnforeseenJob({...good,minutesBeforeNextCommitment:45});
 assert.equal(r.decision,'reschedule');
});
test('customer approval, compatibility and license are explicit gates',()=>{
 assert.equal(reviewUnforeseenJob({...good,customerApprovedExtra:false}).decision,'approval-required');
 assert.equal(reviewUnforeseenJob({...good,materialCompatibilityConfirmed:false}).decision,'approval-required');
 assert.equal(reviewUnforeseenJob({...good,permittedByLicenseAndScope:false}).decision,'stop-refer');
 assert.equal(reviewUnforeseenJob({...good,safeConditionsConfirmed:false}).decision,'stop-refer');
});
test('negative incremental contribution is flagged, not hidden',()=>{
 const r=reviewUnforeseenJob({...good,additionalApprovedChargeCents:0});
 assert.ok(r.estimatedIncrementalContributionCents<0);
 assert.ok(r.flags.some(x=>/negative estimated/.test(x)));
});
test('rejects invalid money, fractional minutes and missing issue description',()=>{
 for(const patch of [{businessMaterialCostCents:-1},{expectedHandsOnMinutes:2.2},{description:' '},{supplyRunMinutes:1000},{ownerLaborCostCentsPerHour:Number.NaN}]){
  assert.throws(()=>reviewUnforeseenJob({...good,...patch}));
 }
});

test('pre-quote prompts flag unseen supply lines and valves without authorizing plumbing',()=>{
 const p=hiddenConditionPreflight('Home maintenance','Replace kitchen faucet');
 assert.equal(p?.hold,true);
 assert.ok(p?.questions.some(x=>/corroded valves/.test(x)));
 assert.ok(hiddenConditionPreflight('Home maintenance','Adjust door strike')?.questions.some(x=>/batteries/.test(x)));
 assert.equal(hiddenConditionPreflight('Lawn care','Mow and trim'),null);
});
test('profit analysis cannot use zero or missing owner labor cost as a fabricated margin',()=>{
 assert.throws(()=>reviewUnforeseenJob({...good,ownerLaborCostCentsPerHour:0}));
});
