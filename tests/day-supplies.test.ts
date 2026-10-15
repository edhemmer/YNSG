import test from 'node:test';
import assert from 'node:assert/strict';
import {consolidateDaySupplies,supplyReviewForWork,mergeApprovedDaySupplies} from '../apps/web/lib/day-supplies.ts';

test('multiple jobs produce one consolidated before-departure list with measurements',()=>{
 const result=consolidateDaySupplies([
  {service:'Help around the home',task:'Hang a shelf'},
  {service:'Help around the home',task:'Hang a picture'},
  {service:'Help around the home',task:'Patch drywall'},
 ]);
 assert.ok(result.items.find(x=>x.name==='Level and measuring tape')||result.items.find(x=>x.name==='Level and tape'));
 assert.ok(result.questions.length>=3);
 assert.equal(result.unscoped.length,0);
});
test('mulch planning flags supplier-paid material order and transport, not an unplanned run',()=>{
 const r=supplyReviewForWork({service:'Yard & garden',task:'Deliver and spread mulch'});
 assert.ok(r.prompts.some(p=>p.name.includes('Customer-approved mulch order')));
 assert.ok(r.questions.some(q=>q.includes('paid directly')));
});
test('unknown tasks remain unscoped and safety-held lock work is not cleared by packing',()=>{
 const unknown=consolidateDaySupplies([{service:'Other',task:'Some new job'}]);
 assert.equal(unknown.unscoped.length,1);
 const held=consolidateDaySupplies([{service:'Help around the home',task:'Smart lock replacement'}]);
 assert.equal(held.held.length,1);
});
test('nothing in the planning contract claims inventory exists or purchases automatically',()=>{
 const p=consolidateDaySupplies([{service:'Help around the home',task:'Hang shelf'}]);
 assert.ok(p.items.every(i=>i.requiresVerification));
});

test('owner-approved equipment and quantities are represented, without claiming to be packed',()=>{
 const suggestions=consolidateDaySupplies([{service:'Help around the home',task:'Hang a shelf'}]);
 const merged=mergeApprovedDaySupplies(suggestions,[{name:'Stud finder',quantity:1,unit:'each',consumed:false,callIds:['a']},{name:'Shelf screws',quantity:12,unit:'each',consumed:true,callIds:['a']}]);
 assert.equal(merged.items.filter(x=>x.name==='Stud finder').length,1);
 assert.equal(merged.items.find(x=>x.name==='Stud finder')?.approved?.quantity,1);
 assert.equal(merged.items.find(x=>x.name==='Shelf screws')?.approved?.quantity,12);
 assert.ok(merged.items.every(x=>x.requiresVerification));
 assert.throws(()=>mergeApprovedDaySupplies(suggestions,[{name:'Bad',quantity:0,unit:'each',consumed:true,callIds:[]}]));
});
