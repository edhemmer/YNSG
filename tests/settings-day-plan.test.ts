import test from 'node:test';
import assert from 'node:assert/strict';
import {clockLabel,clockOptions} from '../apps/web/lib/settings-display.js';
import {localDate,daySearchBounds,navigationUrl,requestedTasks} from '../apps/web/lib/day-plan.js';
test('clock labels show approved hours without changing custom saved values',()=>{
 assert.equal(clockLabel(480),'8:00 AM');assert.equal(clockLabel(900),'3:00 PM');assert.equal(clockLabel(1020),'5:00 PM');
 assert.ok(clockOptions(497).includes(497));assert.equal(clockLabel(497),'8:17 AM');
 assert.ok(!clockOptions(900).includes(1440));assert.ok(clockOptions(1440,true).includes(1440));assert.equal(clockLabel(1440),'Midnight (end of day)');
});
test('daily boundaries retain Chicago dates across midnight and DST and reject invalid dates',()=>{
 assert.equal(localDate(new Date('2026-10-04T01:00:00Z'),'America/Chicago'),'2026-10-03');
 assert.equal(localDate(new Date('2026-11-01T06:30:00Z'),'America/Chicago'),'2026-11-01');
 assert.equal(localDate(new Date('2026-11-01T07:30:00Z'),'America/Chicago'),'2026-11-01');
 for(const zone of ['Pacific/Kiritimati','Pacific/Pago_Pago','America/Chicago']){
  for(const instant of ['2026-11-01T00:00:00Z','2026-11-01T23:59:59Z']){
   const date=localDate(new Date(instant),zone),bounds=daySearchBounds(date);assert.ok(instant>=bounds.from&&instant<bounds.to);
  }
 }
 for(const bad of ['2026-02-30','2026-13-01','2026-1-01','not a date'])assert.throws(()=>daySearchBounds(bad));
});
test('navigation encodes addresses and uses device location rather than a saved origin',()=>{
 assert.equal(navigationUrl(''),null);
 const url=new URL(navigationUrl('123 Example St, A&B')!);
 assert.equal(url.hostname,'www.google.com');assert.equal(url.searchParams.get('destination'),'123 Example St, A&B');assert.equal(url.searchParams.get('origin'),null);assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('dir_action'),'navigate');
});
test('daily work list preserves every cross-category choice and flags missing scope',()=>{
 assert.deepEqual(requestedTasks({services:[{service:'Lawn care',task:'Leaves'},{service:'Yard & garden',task:'Mulch pickup'}]}),['Lawn care: Leaves','Yard & garden: Mulch pickup']);assert.deepEqual(requestedTasks({}),['Work details need review']);
});
