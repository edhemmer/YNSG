import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
const body=(start,end)=>source.split(start)[1]?.split(end)[0];
test('section navigation drops prior request detail as well as old job/customer details',()=>{
 const s=body('function navigate(next:string)','function openWork(id:string)');
 assert.ok(s);assert.match(s,/setActiveRequest\(null\)/);assert.match(s,/setWorkRequest\(null\)/);assert.match(s,/setCustomerFocus\(null\)/);
});
test('record-opening actions verify role and identifier before changing selection and history',()=>{
 for(const [start,end,role] of [['function openWork(id:string)','function openCustomer(id:string)','Work'],['function openCustomer(id:string)','// Keep browser navigation','Customers']]){
  const s=body(start,end);assert.ok(s);
  assert.ok(s.indexOf("canSeeSection({key:'"+role+"'})")>=0);
  assert.match(s,/test\(id\)/);
  assert.ok(s.indexOf('canSeeSection')<s.indexOf('history.pushState'));
  assert.ok(s.indexOf('test(id)')<s.indexOf('history.pushState'));
 }
});
