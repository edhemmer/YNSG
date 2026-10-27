import test from 'node:test';
import assert from 'node:assert/strict';
import {radiusAssessment,RADIUS_CENTER,PREFERRED_RADIUS_MILES} from '../apps/web/lib/service-radius.ts';
test('operating area uses ZIP 60115 and never determines intake eligibility',()=>{
 assert.match(RADIUS_CENTER.label,/60115/);assert.equal(PREFERRED_RADIUS_MILES,15);
 assert.deepEqual(radiusAssessment(RADIUS_CENTER.latitude,RADIUS_CENTER.longitude),{status:'nearby',miles:0});
 const outside=radiusAssessment(42.3,-88.75);assert.equal(outside.status,'outside_preferred');assert.ok(outside.miles>15);
 assert.deepEqual(radiusAssessment(NaN,0),{status:'needs_review',miles:null});
});
