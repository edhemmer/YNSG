import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerPricingSchema,pricingTotals,allocateActualCents} from '../apps/web/lib/owner-invoice-pricing.ts';
test('lawn fixed $50 and leaf hourly $100 produce $150 standard and $45 actual, $105 private reduction',()=>{
 const pricing=ownerPricingSchema.parse({services:[
  {description:'Lawn mowing',method:'fixed',standardCents:5000,billedCents:2500},
  {description:'Leaf management',method:'hourly',minutes:120,hourlyRateCents:5000,standardCents:10000,billedCents:2000}
 ],reason:'Owner discretion'});
 assert.deepEqual(pricingTotals(pricing),{standardCents:15000,billedCents:4500,reductionCents:10500});
 assert.deepEqual(allocateActualCents([5000,10000],4500),[1500,3000]);
});
test('allocation is exact to the cent and never exceeds standard totals',()=>{
 assert.deepEqual(allocateActualCents([1,1,1],2),[1,1,0]);
 assert.equal(allocateActualCents([100,100],300),null);
 assert.equal(allocateActualCents([0,0],0),null);
});
test('never silently conceal a markup or unsupported hourly calculation',()=>{
 assert.equal(ownerPricingSchema.safeParse({services:[{description:'Lawn mowing',method:'fixed',standardCents:5000,billedCents:6000}],reason:''}).success,false);
 assert.equal(ownerPricingSchema.safeParse({services:[{description:'Leaf work',method:'hourly',minutes:120,hourlyRateCents:5000,standardCents:9000,billedCents:4000}],reason:'Lower price'}).success,false);
 assert.equal(ownerPricingSchema.safeParse({services:[{description:'Lawn mowing',method:'fixed',standardCents:5000,billedCents:4500}],reason:''}).success,false);
});
