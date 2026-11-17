import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileDue} from '../apps/web/lib/reconcile-cadence.ts';

test('Google drift check is queued once an hour, not every minute',()=>{
 const hour=Date.UTC(2026,10,17,15,0,0);
 assert.equal(reconcileDue(hour),true);
 assert.equal(reconcileDue(hour+59_000),true,'any time in the first minute');
 assert.equal(reconcileDue(hour+60_000),false);
 assert.equal(reconcileDue(hour+30*60_000),false);
 let due=0;for(let m=0;m<24*60;m++)if(reconcileDue(hour+m*60_000))due++;
 assert.equal(due,24,'24 checks a day instead of 288 per appointment');
});
