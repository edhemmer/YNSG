import test from 'node:test';
import assert from 'node:assert/strict';
import {previewMileage,sumConfirmedBusinessMiles,mileageEntry} from '../apps/web/lib/mileage-contract.ts';
const a='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001';
const trip={organizationId:a,id,tripDate:'2026-10-15',purpose:'Customer appointment supplies',origin:'Workshop, DeKalb, IL',destination:'Customer property, Sycamore, IL',vehicleLabel:'Work truck',odometerStart:40212,odometerEnd:40236,businessUse:'business',recordedSource:'manual-odometer',jobId:null,notes:''};
test('real readings count miles without auto-tax or billing claims',()=>{
 const v=previewMileage(trip);assert.equal(v.miles,24);assert.equal(v.businessMiles,24);
 assert.equal(v.deductionCents,null);assert.equal(v.invoiceChargeCents,null);
});
test('inverted readings or anonymous/unknown purpose fail',()=>{
 assert.equal(mileageEntry.safeParse({...trip,odometerEnd:40211}).success,false);
 assert.equal(mileageEntry.safeParse({...trip,purpose:''}).success,false);
});
test('mixed/personal trips do not silently become business mileage',()=>{
 assert.equal(previewMileage({...trip,businessUse:'personal'}).businessMiles,0);
 assert.equal(previewMileage({...trip,businessUse:'mixed-review'}).requiresClassificationReview,true);
 assert.equal(sumConfirmedBusinessMiles([trip,{...trip,id:'40000000-0000-4000-8000-000000000001',businessUse:'mixed-review'}]),24);
});
test('duplicates cannot inflate totals',()=>assert.throws(()=>sumConfirmedBusinessMiles([trip,trip]),/DUPLICATE_TRIP/));

test('overlapping business odometer intervals on same truck and date are rejected',()=>{
 const overlapping={...trip,id:'40000000-0000-4000-8000-000000000002',odometerStart:40230,odometerEnd:40245};
 assert.throws(()=>sumConfirmedBusinessMiles([trip,overlapping]),/OVERLAPPING_BUSINESS_MILEAGE/);
});
test('adjacent trips and separate vehicle or date remain valid',()=>{
 const next={...trip,id:'40000000-0000-4000-8000-000000000003',odometerStart:40236,odometerEnd:40250};
 assert.equal(sumConfirmedBusinessMiles([trip,next]),38);
 assert.equal(sumConfirmedBusinessMiles([trip,{...next,odometerStart:40220,vehicleLabel:'Second truck'}]),54);
 assert.equal(sumConfirmedBusinessMiles([trip,{...next,odometerStart:40220,tripDate:'2026-10-16'}]),54);
});
test('different tenant labels do not cause cross-organization conflict',()=>{
 const other={...trip,organizationId:'50000000-0000-4000-8000-000000000001'};
 assert.equal(sumConfirmedBusinessMiles([trip,other]),48);
});
