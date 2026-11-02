import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crewTerms,crewBilledMinutes,crewLaborCharge} from '../apps/web/lib/crew-billing.ts';
const community=crewTerms.parse({billingBasis:'per_person_first_minimum',plannedPeople:3,perPersonRateCents:4500,firstPersonMinimumMinutes:120,additionalPersonMinimumMinutes:0,partialExtension:'exact'});
test('owner-confirmed first-person minimum: three one-hour workers cost $180 Community or $240 standard',()=>{
 assert.equal(crewLaborCharge([60,60,60],community),18000);
 assert.equal(crewLaborCharge([60,60,60],{...community,perPersonRateCents:6000}),24000);
 assert.equal(crewLaborCharge([60],community),9000);
 assert.equal(crewLaborCharge([60],{...community,perPersonRateCents:6000}),12000);
});
test('additional people bill individual actual time without independent minimum or extension rounding',()=>{
 assert.equal(crewLaborCharge([60,20,40],community),13500);
 assert.equal(crewLaborCharge([120,120,120],community),27000);
 assert.equal(crewBilledMinutes(121,2,{...community,partialExtension:'ceil'}),121);
 assert.equal(crewBilledMinutes(121,1,{...community,partialExtension:'ceil'}),150);
 assert.equal(crewBilledMinutes(121,1,community),121);
 assert.throws(()=>crewBilledMinutes(121,1,{...community,partialExtension:null}),/EXTENSION_POLICY_REQUIRED/);
});
test('no work does not fabricate a minimum; invalid actual time and empty crews are rejected',()=>{
 assert.equal(crewLaborCharge([0],community),0);
 for(const minutes of [-1,0.5,1441,NaN])assert.throws(()=>crewBilledMinutes(minutes,1,community));
 assert.throws(()=>crewLaborCharge([],community));
 assert.throws(()=>crewLaborCharge(Array(7).fill(60),community));
});
