import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentMessage} from '../apps/web/lib/appointment-message.ts';
test('cancellation names the canceled visit and retained request without an attendance or payment action',()=>{
 const m=appointmentMessage({kind:'appointment.canceled',company:'Synthetic Neighbor Service',recipient:'test@example.invalid',notificationRecipient:'owner@example.invalid',request:{name:'Test Neighbor',street:'Test only',city:'DeKalb',services:[{service:'Home jobs',task:'Furniture assembly'}]},arrivalAt:'2026-11-02T15:00:00Z',timezone:'America/Chicago',ownerUrl:'https://app.example.invalid/owner',reason:'The customer requested cancellation.'});
 assert.equal(m.to,'test@example.invalid');assert.match(m.body,/Monday, November 2, 2026 at 9:00 AM CST/);
 assert.match(m.body,/service request is still saved/);assert.match(m.body,/does not change any agreed charges or payment records/);
 assert.doesNotMatch(m.html,/Confirm attendance|Request another time|Pay now|\/owner/);
});
