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
