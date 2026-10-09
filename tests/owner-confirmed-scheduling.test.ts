import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentDeliveryMessage} from '../apps/web/lib/appointment-delivery.ts';
import {googleRoutesKey} from '../apps/web/lib/google-routes-key.ts';
import {schedulingMessages} from '../apps/web/lib/scheduling-errors.ts';
import {publicError} from '../apps/web/lib/public-errors.ts';
import {appointmentMessage} from '../apps/web/lib/appointment-message.ts';

test('booking status never turns queued or uncertain delivery into sent',()=>{
 const v={appointmentStatus:'reserved',revision:3,calendar:'pending',customerEmail:'pending',ownerEmail:'unknown'};
 assert.match(appointmentDeliveryMessage(v),/Appointment booked/);
 assert.match(appointmentDeliveryMessage(v),/update queued/);
 assert.match(appointmentDeliveryMessage(v),/delivery is uncertain/);
 assert.doesNotMatch(appointmentDeliveryMessage(v),/email sent/);
 assert.match(appointmentDeliveryMessage({...v,ownerEmail:'needs_reconciliation'}),/Owner email delivery is uncertain/);
 assert.match(appointmentDeliveryMessage({...v,calendar:'synced',customerEmail:'accepted',ownerEmail:'accepted'}),/Google Calendar synced. Customer email sent. Owner email sent/);
 assert.match(appointmentDeliveryMessage({...v,customerEmail:'not_queued'}),/Customer email needs attention/);
});
test('all reviewed scheduling failures survive the client filter without exposing raw errors',()=>{
 for(const message of Object.values(schedulingMessages))assert.equal(publicError(new Error(message)),message);
 assert.doesNotMatch(publicError('raw provider secret'),/raw provider/);
});
test('Maps suite aliases are server-only and dedicated Routes key takes priority',()=>{
 assert.equal(googleRoutesKey({GOOGLE_MAPS_API_KEY:'  suite-key '}),'suite-key');
 assert.equal(googleRoutesKey({GOOGLE_API_KEY:'google-key'}),'google-key');
 assert.equal(googleRoutesKey({GOOGLE_ROUTES_API_KEY:'routes-key',GOOGLE_MAPS_API_KEY:'suite-key'}),'routes-key');
 assert.equal(googleRoutesKey({NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:'public-key'}),'');
});
test('owner receives booked visit details without a customer bearer link or approval prompt',()=>{
 const v=appointmentMessage({kind:'appointment.owner_confirmation',company:'Synthetic Company',recipient:'customer@example.invalid',notificationRecipient:'owner@example.invalid',request:{name:'Synthetic Customer',street:'100 Test Street',city:'DeKalb',services:[{service:'Lawn care',task:'Mowing'}]},arrivalAt:'2026-10-19T13:00:00Z',timezone:'America/Chicago',ownerUrl:'https://crm.example.invalid/?request=test'});
 assert.equal(v.to,'owner@example.invalid');assert.equal(v.subject,'Service appointment booked');
 assert.match(v.body,/Synthetic Customer/);assert.match(v.body,/Mowing/);assert.match(v.body,/8:00/);
 assert.doesNotMatch(v.body,/ready for you to review|Confirm attendance/);
});
