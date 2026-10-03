import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentMessage} from '../apps/web/lib/appointment-message.js';
import {requestDeclinedMessage} from '../apps/web/lib/request-message.js';
test('request decline addresses the customer without inventing a booking or retry slot',()=>{
 const message=requestDeclinedMessage('Synthetic Company',{name:'Pat',email:'customer@example.invalid'});
 assert.equal(message.to,'customer@example.invalid');
 assert.equal(message.subject,'Update on your service request');
 assert.match(message.body,/unable to accept/);
 assert.match(message.body,/No appointment has been booked/);
 assert.doesNotMatch(message.body,/confirmed|choose another|https:/i);
});
test('owner reminder carries all work and contact details without customer action links',()=>{
 const message=appointmentMessage({kind:'appointment.owner_reminder',company:'Synthetic Company',recipient:'customer@example.invalid',notificationRecipient:'owner@example.invalid',request:{name:'Pat',email:'customer@example.invalid',phone:'555-0100',street:'123 Example',city:'Example',services:[{service:'Lawn',task:'Leaves'},{service:'Yard',task:'Mulch pickup'}]},arrivalAt:'2026-11-02T15:00:00Z',timezone:'America/Chicago',ownerUrl:'https://example.invalid/owner?request=order'});
 assert.equal(message.to,'owner@example.invalid');
 for(const detail of ['Pat','555-0100','123 Example','Leaves','Mulch pickup','9:00 AM','America/Chicago','request=order'])assert.ok(message.body.includes(detail),detail);
 assert.doesNotMatch(message.body,/confirmUrl|rescheduleUrl|choose an action/);
});
