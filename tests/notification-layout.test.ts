import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentMessage,type AppointmentMessageInput} from '../apps/web/lib/appointment-message.ts';
import {emailButton} from '../lib/email-layout.js';
const base={company:'Test & Company',recipient:'customer@example.invalid',notificationRecipient:'owner@example.invalid',request:{name:'<Customer>',phone:'555-0100',email:'customer@example.invalid',street:'100 Example',city:'Test',services:[{service:'Yard',task:'Mulch & flowers'},{service:'Home',task:'Door adjustment'}]},arrivalAt:'2026-11-02T15:00:00Z',timezone:'America/Chicago',ownerUrl:'https://example.invalid/owner?request=test',manageUrl:'https://example.invalid/request/manage#token=test',confirmUrl:'https://example.invalid/request/manage#action=confirm',rescheduleUrl:'https://example.invalid/request/manage#action=reschedule',reason:'<script>reason</script>',preference:{preferred_local_start:null,note:'Afternoons & weekends'}};
test('every appointment notification includes safe HTML, readable actions and the same multi-service details',()=>{
 for(const kind of ['appointment.owner_approval','appointment.owner_reminder','appointment.reschedule_requested','appointment.confirmation','appointment.reminder','appointment.declined_time','appointment.declined_service'] as AppointmentMessageInput['kind'][]){
  const m=appointmentMessage({...base,kind});
  assert.ok(m.html.includes('Test &amp; Company'),kind);
  assert.ok(m.html.includes('Mulch &amp; flowers'),kind);
  assert.ok(m.html.includes('Door adjustment'),kind);
  assert.ok(!m.html.includes('<Customer>')&&!m.html.includes('<script>'),kind);
  assert.ok(!/\bCRM\b|undefined/.test(m.html),kind);
  assert.ok(m.html.includes('role="presentation"'),kind);
  assert.ok(m.html.includes(kind.includes('owner_')||kind==='appointment.reschedule_requested'?'Open service request':kind==='appointment.declined_time'?'Choose another time':kind==='appointment.declined_service'?'View appointment update':'Confirm attendance'),kind);
 }
});
test('email action links reject unsafe protocols and credential-bearing destinations',()=>{
 for(const url of ['javascript:alert(1)','http://example.invalid','https://user:secret@example.invalid'])assert.throws(()=>emailButton('Open',url));
 assert.ok(emailButton('Request another time','https://example.invalid/#token=a&action=reschedule',true).includes('a&amp;action=reschedule'));
});
