import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewOnSiteExtra} from '../apps/web/lib/on-site-extra.ts';
const base={work:'hang_shelf',expectedMinutes:35,remainingMinutes:90,additionalMaterialsCents:0,materialsApproved:false,scopeReviewed:true,customerPriceApproved:true,accessSafe:true} as const;
test('a small on-site shelf request uses a minimum 60 minute task allocation',()=>{
 const result=reviewOnSiteExtra(base);assert.equal(result.decision,'review-and-record');assert.equal(result.allocationMinutes,60);
});
test('insufficient time protects the next customer appointment',()=>{
 const result=reviewOnSiteExtra({...base,remainingMinutes:30});assert.equal(result.decision,'reschedule');assert.ok(result.reasons.some(x=>/Not enough/.test(x)));
});
test('held smart-lock work and unapproved unknown tasks cannot be accepted on site',()=>{
 for(const work of ['smart_lock','other'] as const)assert.equal(reviewOnSiteExtra({...base,work}).decision,'refer');
});
test('unsafe conditions cannot be overridden by customer price approval',()=>{
 const result=reviewOnSiteExtra({...base,accessSafe:false});assert.equal(result.decision,'refer');
});
test('unapproved materials and price must be identified before recording extra work',()=>{
 const result=reviewOnSiteExtra({...base,additionalMaterialsCents:4500,materialsApproved:false,customerPriceApproved:false});
 assert.equal(result.reasons.length,2);assert.equal(result.decision,'review-and-record');
});
test('invalid negative time, fractional cents and unknown scope fail closed',()=>{
 for(const patch of [{expectedMinutes:-4},{remainingMinutes:-1},{additionalMaterialsCents:1.5},{work:'electrical-repair'}])assert.throws(()=>reviewOnSiteExtra({...base,...patch}));
});
