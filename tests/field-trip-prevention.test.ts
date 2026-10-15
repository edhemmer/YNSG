import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supplyReviewForWork} from '../apps/web/lib/day-supplies.ts';
test('shelves require bracket style, substrate, exact hardware and load review before departure',()=>{
 const result=supplyReviewForWork({service:'Help around the home',task:'Shelving and organizing'});
 assert.equal(result.known,true);
 assert.match(result.questions.join(' '),/floating, bracket, track, rail/);
 assert.match(result.questions.join(' '),/loaded weight/);
});
test('picture hanger styles are identified rather than treated as equivalent',()=>{
 const result=supplyReviewForWork({service:'Help around the home',task:'Hang picture artwork'});
 assert.match(result.questions.join(' '),/sawtooth clip, D-rings, wire, French cleat or keyhole/);
});
test('blinds require inside-outside mount clearance decision and manufacturer brackets',()=>{
 const result=supplyReviewForWork({service:'Help around the home',task:'Install window blinds'});
 assert.equal(result.known,true);
 assert.match(result.questions.join(' '),/inside versus outside mount/);
 assert.ok(result.prompts.some(x=>/mounting brackets/.test(x.name)));
});
test('dishwasher planning catches the existing 90-degree adapter and remains held from YNSG service',()=>{
 const result=supplyReviewForWork({service:'Help around the home',task:'Install dishwasher'});
 assert.equal(result.known,true);assert.equal(result.hold,true);
 assert.match(result.questions.join(' '),/90-degree inlet elbow/);
 assert.match(result.questions.join(' '),/whole kit is actually required/);
 assert.ok(result.prompts.some(x=>/existing supply elbow/.test(x.name)));
});
test('field readiness never claims unconfirmed parts have been packed and separates added-scope customer approval',()=>{
 const ui=readFileSync('apps/web/app/day-supply-readiness.tsx','utf8');
 assert.match(ui,/Do not assume reuse is safe/);
 assert.match(ui,/Customer requested an extra unplanned job/);
 assert.match(ui,/does not authorize restricted trades/);
 assert.match(ui,/not saved inventory/);
});
