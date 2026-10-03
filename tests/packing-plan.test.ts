import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPackingPlan,workKey,type PackingRule} from '../apps/web/lib/packing-plan.js';
import {shiftLocalDate,type DayCall} from '../apps/web/lib/day-plan.js';
const work={service:'Lawn care',task:'Mow, trim and blow'};
const call=(id:string,patch:Partial<DayCall>={}):DayCall=>({id,requestId:id,startAt:id==='b'?'2026-10-05T17:00:00Z':'2026-10-05T14:00:00Z',arrivalAt:id==='b'?'2026-10-05T17:00:00Z':'2026-10-05T14:00:00Z',endAt:id==='b'?'2026-10-05T19:00:00Z':'2026-10-05T16:00:00Z',status:'reserved',customerResponse:'awaiting',name:'Synthetic Customer',phone:'5550000000',email:'customer@example.invalid',address:'123 Example',tasks:['Lawn care: Mow, trim and blow'],workItems:[work],description:'',...patch});
const rule: PackingRule={...work,revision:1,items:[{name:'Mower',quantity:1,unit:'each',consumed:false},{name:'Yard bag',quantity:2,unit:'bag',consumed:true}]};
test('daily packing consolidates reusable tools and sums consumables across calls',()=>{
 const result=buildPackingPlan([call('a'),call('b')],[rule]);assert.equal(result.complete,true);
 assert.equal(result.items.find(i=>i.name==='Mower')?.quantity,1);assert.equal(result.items.find(i=>i.name==='Yard bag')?.quantity,4);
 assert.deepEqual(result.items.find(i=>i.name==='Mower')?.callIds,['a','b']);
});
test('cross-category work preserves gaps, approved empty lists and the largest reusable quantity',()=>{
 const garden={service:'Yard & garden',task:'Pull weeds'};
 const calls=[call('a',{workItems:[work,garden]})];
 assert.deepEqual(buildPackingPlan(calls,[rule]).unmapped,[{...garden,callIds:['a']}]);
 assert.equal(buildPackingPlan(calls,[rule,{...garden,revision:1,items:[]}]).complete,true);
 const result=buildPackingPlan(calls,[rule,{...garden,revision:1,items:[{name:'mower',quantity:2,unit:'each',consumed:false}]}]);assert.equal(result.items.find(i=>i.name==='Mower')?.quantity,2);
});
test('conflicting units or reusable/consumable classification never produce a guessed total',()=>{
 const garden={service:'Yard & garden',task:'Plant flowers'};
 for(const item of [{name:'MOWER',quantity:2,unit:'pair',consumed:false},{name:'Mower',quantity:1,unit:'each',consumed:true}]){
  const result=buildPackingPlan([call('a',{workItems:[work,garden]})],[rule,{...garden,revision:1,items:[item]}]);assert.equal(result.complete,false);assert.ok(result.warnings[0]?.includes('No combined quantity'));assert.ok(!result.items.some(i=>i.name.toLowerCase()==='mower'));
 }
});
test('duplicate tasks do not multiply supplies; unreviewed appointments are excluded and flagged',()=>{
 const result=buildPackingPlan([call('a',{workItems:[work,work]}),call('b',{status:'needs_review'})],[rule]);assert.equal(result.items.find(i=>i.name==='Yard bag')?.quantity,2);assert.equal(result.complete,false);assert.ok(result.warnings.some(w=>w.includes('scheduling review')));
 assert.equal(buildPackingPlan([call('a',{workItems:[]})],[]).complete,false);
});
test('pending reschedule remains booked and warns before loading; exact task keys do not collide',()=>{
 const result=buildPackingPlan([call('a',{customerResponse:'reschedule_requested'})],[rule]);assert.equal(result.items.length,2);assert.equal(result.complete,false);assert.ok(result.warnings.some(w=>w.includes('stays booked')));
 assert.notEqual(workKey({service:'Home: Lawn',task:'Mow'}),workKey({service:'Home',task:'Lawn:Mow'}));
});
test('tomorrow uses local calendar dates rather than a 24-hour offset across DST',()=>{
 assert.equal(shiftLocalDate('2026-03-08',1),'2026-03-09');assert.equal(shiftLocalDate('2026-11-01',1),'2026-11-02');assert.equal(shiftLocalDate('2026-12-31',1),'2027-01-01');assert.throws(()=>shiftLocalDate('2026-02-30',1));
});

test('concurrent crews never receive a falsely complete reusable-equipment total',()=>{
 const result=buildPackingPlan([call('a'),call('b',{startAt:'2026-10-05T14:30:00Z'})],[rule]);assert.equal(result.complete,false);assert.ok(result.warnings.some(w=>w.includes('visits overlap')));
});
