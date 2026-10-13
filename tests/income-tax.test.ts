import test from 'node:test';
import assert from 'node:assert/strict';
import {federalIncome2026,ownerIncomeEstimate,type IncomeTaxInput} from '../apps/web/lib/income-tax.ts';
const input:IncomeTaxInput={year:2026,state:'IL',status:'single',taxableIncomeCents:6500000,netProfitCents:10000000,socialSecurityWagesCents:0,medicareWagesCents:0,federalNonrefundableCreditsCents:0,federalWithholdingAndRefundableCreditsCents:0,otherFederalTaxesCents:0,stateBaseIncomeCents:10000000,stateExemptionsCents:0,stateSurchargesCents:0,stateWithholdingAndCreditsCents:0};
test('2026 progressive bracket totals agree with IRS rate schedule at every boundary',()=>{
 const fixtures={single:[[12400,1240],[50400,5800],[105700,17966],[201775,41024],[256225,58448],[640600,192979.25]],joint:[[24800,2480],[100800,11600],[211400,35932],[403550,82048],[512450,116896],[768700,206583.5]],head:[[17700,1770],[67450,7740],[105700,16155],[201750,39207],[256200,56631],[640600,191171]],separate:[[384350,103291.75]],surviving:[[768700,206583.5]]} as const;
 for(const status of Object.keys(fixtures) as (keyof typeof fixtures)[])for(const [income,tax] of fixtures[status])assert.equal(federalIncome2026(income*100,status).taxCents,Math.round(tax*100),`${status}: ${income}`);
 assert.equal(federalIncome2026(6500000,'single').taxCents,901200);
 assert.equal(federalIncome2026(0,'single').taxCents,0);
 assert.equal(federalIncome2026(5040100,'single').taxCents,580022);
});
test('Illinois uses state base less exemptions, keeps income and self-employment obligations distinct',()=>{
 const r=ownerIncomeEstimate({...input,stateExemptionsCents:500000});
 assert.equal(r.income.taxCents,901200);assert.equal(r.selfEmploymentCents,1412955);assert.equal(r.halfSeDeductionCents,706478);
 assert.equal(r.federalNetCents,2314155);assert.equal(r.stateNetIncomeCents,9500000);assert.equal(r.stateLiabilityCents,470250);
 assert.equal(r.stateAnnualPaymentCents,470250);
});
test('Social Security wage base, $400 adjusted-earnings threshold and Additional Medicare use current rules',()=>{
 assert.equal(ownerIncomeEstimate({...input,socialSecurityWagesCents:18450000}).selfEmploymentCents,267815);
 assert.equal(ownerIncomeEstimate({...input,netProfitCents:43300}).selfEmploymentCents,0);
 assert.ok(ownerIncomeEstimate({...input,netProfitCents:43314}).selfEmploymentCents>0);
 assert.equal(ownerIncomeEstimate({...input,medicareWagesCents:20000000}).additionalMedicareCents,83115);
 assert.equal(ownerIncomeEstimate({...input,status:'joint',medicareWagesCents:25000000}).additionalMedicareCents,83115);
 assert.equal(ownerIncomeEstimate({...input,status:'surviving',medicareWagesCents:20000000}).additionalMedicareCents,83115);
});
test('nonrefundable credits cannot erase self-employment tax; refundable credits and withholding can',()=>{
 const r=ownerIncomeEstimate({...input,federalNonrefundableCreditsCents:2000000,federalWithholdingAndRefundableCreditsCents:1000000});
 assert.equal(r.federalNetCents,412955);
 assert.equal(ownerIncomeEstimate({...input,stateExemptionsCents:20000000}).stateNetCents,0);
 assert.equal(ownerIncomeEstimate({...input,stateWithholdingAndCreditsCents:395000}).stateAnnualPaymentCents,0);
 assert.equal(ownerIncomeEstimate({...input,stateWithholdingAndCreditsCents:394999}).stateAnnualPaymentCents,100001);
});
test('unsupported states, future years, invalid statuses and malformed money fail closed',()=>{
 for(const patch of [{state:'GA'},{year:2027},{status:'unknown'},{netProfitCents:-1},{taxableIncomeCents:1.2}])assert.throws(()=>ownerIncomeEstimate({...input,...patch} as IncomeTaxInput));
});
