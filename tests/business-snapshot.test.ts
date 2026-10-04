import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotWindow,chartPercent} from '../apps/web/lib/business-snapshot.ts';
import {emailRaw} from '../apps/web/lib/google-core.ts';
test('snapshot dates include the complete local end day through daylight-saving changes',()=>{
 const w=snapshotWindow('2026-11-01','2026-11-01','America/Chicago');
 assert.equal(w.start,'2026-11-01T05:00:00.000Z');assert.equal(w.end,'2026-11-02T06:00:00.000Z');
 for(const pair of [['2026-02-30','2026-03-01'],['2026-10-04','2026-10-01'],['2020-01-01','2026-01-01']] as const)assert.throws(()=>snapshotWindow(pair[0],pair[1],'America/Chicago'));
 assert.equal(chartPercent(0,0),0);assert.equal(chartPercent(30,60),50);assert.throws(()=>chartPercent(-1,60));
});
test('business sender name is safely encoded without spoofing the verified address',()=>{
 const raw=Buffer.from(emailRaw('owner@example.invalid','customer@example.invalid','Appointment confirmed','Current details','ynsg-test',{fromName:'Your Neighborhood Service Guy'}),'base64url').toString();
 assert.ok(raw.includes(' <owner@example.invalid>\r\nTo: customer@example.invalid'));
 assert.ok(raw.includes(Buffer.from('Your Neighborhood Service Guy').toString('base64')));
 assert.throws(()=>emailRaw('owner@example.invalid','customer@example.invalid','Subject','Body','ynsg-test',{fromName:'Business\r\nBcc: bad@example.invalid'}));
});
