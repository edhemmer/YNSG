import test from 'node:test';
import assert from 'node:assert/strict';
import {previewMaterialUse,shouldSuppressTinyConsumable} from '../apps/web/lib/material-lot-accounting.ts';
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',job='40000000-0000-4000-8000-000000000001',receipt='50000000-0000-4000-8000-000000000001';
const lot={id,organizationId:org,productBarcode:'012345678905',description:'Paintable caulk',purchasedUnits:100,unitName:'percent of tube',pretaxCents:740,taxPaidCents:60,receiptId:receipt,quantityRemaining:100,returnStatus:'none'};
const use={organizationId:org,lotId:id,jobId:job,unitsUsed:50,treatment:'at-cost'};
test('partial-use amount includes allocated original purchase tax but never a second tax',()=>{
 const v=previewMaterialUse(lot,use);
 assert.equal(v.recordedCostCents,400);assert.equal(v.billableCents,400);
 assert.equal(v.quantityRemainingAfter,50);assert.equal(v.receiptId,receipt);
 assert.equal(v.issued,false);assert.equal(v.requiresDraftReview,true);
});
test('two partial uses allocate the exact original cents without rounding drift',()=>{
 const first=previewMaterialUse({...lot,purchasedUnits:3,quantityRemaining:3,pretaxCents:100,taxPaidCents:1},{...use,unitsUsed:1});
 const rest=previewMaterialUse({...lot,purchasedUnits:3,quantityRemaining:2,pretaxCents:100,taxPaidCents:1},{...use,unitsUsed:2});
 assert.equal(first.recordedCostCents+rest.recordedCostCents,101);
});
test('minor material included in labor or customer supplied carries zero additional charge',()=>{
 for(const treatment of ['included-in-labor','customer-supplied'])assert.equal(previewMaterialUse(lot,{...use,treatment}).billableCents,0);
 assert.equal(shouldSuppressTinyConsumable(30,100),true);
 assert.equal(shouldSuppressTinyConsumable(150,100),false);
});
test('cross-company/lot usage, depleted lots and return in progress fail closed',()=>{
 assert.throws(()=>previewMaterialUse(lot,{...use,organizationId:'60000000-0000-4000-8000-000000000001'}));
 assert.throws(()=>previewMaterialUse(lot,{...use,lotId:job}));
 assert.throws(()=>previewMaterialUse({...lot,quantityRemaining:20},use));
 assert.throws(()=>previewMaterialUse({...lot,returnStatus:'returned'},use));
 assert.throws(()=>previewMaterialUse({...lot,quantityRemaining:200},use));
});

test('materials must remain a reviewed quote and cannot be consumed twice in the same preview',()=>{
 const before=previewMaterialUse(lot,use);
 const after=previewMaterialUse({...lot,quantityRemaining:50},use);
 assert.equal(before.recordedCostCents+after.recordedCostCents,800);
 assert.equal(after.quantityRemainingAfter,0);
 assert.throws(()=>previewMaterialUse({...lot,quantityRemaining:0},use),/MATERIAL_STOCK_SHORTAGE/);
});
