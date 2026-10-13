import test from 'node:test';
import assert from 'node:assert/strict';
import {customerRequestEmail} from '../lib/customer-request-email.js';
test('request receipt does not confirm a requested appointment',()=>{
 const message=customerRequestEmail('Your Neighborhood Service Guy',{name:'Test Customer',email:'test@example.com',preferredTime:'Thursday 10 AM',services:[{service:'Home tasks',task:'Door adjustment'}]},{});
 assert.match(message.body,/isn.t confirmed yet/);
 assert.match(message.body,/once it.s booked/);
 assert.match(message.html,/Door adjustment/);
});
