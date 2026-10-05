import test from 'node:test';import assert from 'node:assert/strict';
import {ownerRequestEmail} from '../lib/owner-request-email.js';
import {ownerRequestUrl} from '../apps/web/lib/email-links';
import {customerLinkUrl} from '../apps/web/lib/customer-links';
import {appointmentMessage,type AppointmentMessageInput} from '../apps/web/lib/appointment-message';
import {requestTiming} from '../lib/request-timing.js';
const origin='https://business.example.invalid',id='80000000-0000-4000-8000-000000000001',org='20000000-0000-4000-8000-000000000001',owner=ownerRequestUrl(origin,id,org);
const links=(html:string)=>[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]!.replaceAll('&amp;','&'));
test('owner email contact and request buttons carry the exact intended destinations',()=>{
 const data={name:'Synthetic',phone:'(555) 010-0200',email:'test@example.invalid',street:'100 Main & First',city:'Test Town'};
 const m=ownerRequestEmail(data,[{service:'Yard',task:'Weeds'}],id,'Synthetic Company','',owner);
 const targets=links(m.html);assert.ok(targets.includes(owner));assert.ok(targets.includes('tel:5550100200'));assert.ok(targets.includes('mailto:test@example.invalid'));
 const map=new URL(targets.find(u=>u.startsWith('https://www.google.com/maps/'))!);assert.equal(map.searchParams.get('query'),'100 Main & First, Test Town');assert.equal(map.searchParams.get('api'),'1');
 assert.ok(!m.html.includes('Request ID:')&&!m.text.includes('Request ID:'));assert.ok(!targets.some(u=>u.includes('vercel.com')));
});
test('every appointment email links to its intended owner or customer action without triggering a mutation',()=>{
 const manage=customerLinkUrl(origin,'a'.repeat(43)),confirm=customerLinkUrl(origin,'a'.repeat(43),'confirm'),reschedule=customerLinkUrl(origin,'a'.repeat(43),'reschedule');
 for(const kind of ['appointment.owner_approval','appointment.owner_reminder','appointment.reschedule_requested','appointment.confirmation','appointment.reminder','appointment.declined_time','appointment.declined_service'] as AppointmentMessageInput['kind'][]){
  const m=appointmentMessage({kind,company:'Synthetic',recipient:'customer@example.invalid',notificationRecipient:'owner@example.invalid',request:{name:'Synthetic',services:[{service:'Yard',task:'Weeds'}]},arrivalAt:'2026-11-02T15:00:00Z',timezone:'America/Chicago',ownerUrl:owner,manageUrl:manage,confirmUrl:confirm,rescheduleUrl:reschedule});
  const targets=links(m.html),isOwner=kind.includes('owner_')||kind==='appointment.reschedule_requested';assert.ok(targets.includes(isOwner?owner:kind==='appointment.confirmation'||kind==='appointment.reminder'?confirm:manage),kind);
  if(kind==='appointment.confirmation'||kind==='appointment.reminder')assert.ok(targets.includes(reschedule),kind);
  assert.ok(!targets.some(u=>new URL(u).pathname.startsWith('/api/')),kind);
 }
});
test('reschedule preference is readable and preserves the requested local day and time',()=>{
 assert.equal(requestTiming('2026-11-02T09:00'),'Monday, November 2, 2026 at 9:00 AM (local time)');
 assert.equal(requestTiming('2026-11-02T09:00:00'),'Monday, November 2, 2026 at 9:00 AM (local time)');
 assert.equal(requestTiming('2026-02-30T09:00'),'2026-02-30T09:00');
});
