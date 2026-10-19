import test from 'node:test';
import assert from 'node:assert/strict';
import {declineExplanation,declineReasons,emailDraftUrl,declineSignature,futureProjectInvitation,serviceNotOfferedDraft,YNSG_ORGANIZATION} from '../apps/web/lib/decline-message.ts';
import {requestDeclinedMessage} from '../apps/web/lib/request-message.ts';
import {appointmentMessage} from '../apps/web/lib/appointment-message.ts';
test('reason messages distinguish scheduling, unavailable services and geography without claiming a new appointment',()=>{
 assert.match(declineSignature(YNSG_ORGANIZATION),/Ed Hemmer\nYour Neighborhood Service Guy\n770-630-2094\nwww.yourneighborhoodserviceguy.com/);
 assert.equal(declineSignature('other-business'),'');
 assert.equal(declineReasons.length,4);assert.match(declineExplanation('time'),/schedule is flexible/);assert.match(declineExplanation('service'),/outside the services/);assert.match(declineExplanation('area'),/outside the area/);assert.equal(declineExplanation('other'),'');
 const message=requestDeclinedMessage('Your Neighborhood Service Guy',{name:'Synthetic <Customer>',email:'test@example.invalid'},undefined,declineExplanation('service'),YNSG_ORGANIZATION);
 assert.match(message.body,/Best regards,\nEd Hemmer\nYour Neighborhood Service Guy\n770-630-2094\nwww.yourneighborhoodserviceguy.com/);assert.equal((message.body.match(/Ed Hemmer/g)||[]).length,1);
 assert.ok(message.body.includes(declineExplanation('service')));assert.match(message.body,/future project/);assert.ok(message.html.includes('href="https://www.yourneighborhoodserviceguy.com/services"'));assert.ok(!message.html.includes('Synthetic <Customer>'));
 for(const term of ['Faucet','toilet','thermostat','smart lock'])assert.ok(!message.body.includes(term));
 assert.equal(futureProjectInvitation('other-business'),'');assert.ok(!requestDeclinedMessage('Another Business',{email:'test@example.invalid'},undefined,'Custom explanation','other-business').body.includes('yourneighborhoodserviceguy.com'));
});
test('manual reply remains an encoded draft, not an injected recipient or sent message',()=>{
 const draft=serviceNotOfferedDraft('Synthetic Customer',YNSG_ORGANIZATION);assert.match(draft.body,/Hi Synthetic,/);assert.match(draft.body,/future project/);assert.match(draft.body,/Best regards,\nEd Hemmer\nYour Neighborhood Service Guy/);
 const link=emailDraftUrl('test+draft@example.invalid','Thank you & next time',draft.body)!;const url=new URL(link);assert.equal(url.searchParams.get('subject'),'Thank you & next time');assert.equal(url.searchParams.get('body'),draft.body);
 for(const bad of ['test@example.invalid?bcc=other@example.invalid','test@example.invalid\r\nBcc:other@example.invalid','a@example.invalid,b@example.invalid'])assert.equal(emailDraftUrl(bad,'Subject','Body'),null);
 assert.equal(emailDraftUrl('test@example.invalid','Subject\nBcc:bad','Body'),null);
});
test('time-only declines retain choose-another-time instructions and do not receive service promotion',()=>{
 const base={company:'Your Neighborhood Service Guy',organization:YNSG_ORGANIZATION,recipient:'test@example.invalid',notificationRecipient:'owner@example.invalid',request:{name:'Synthetic'},arrivalAt:'2026-10-20T14:00:00Z',timezone:'America/Chicago',ownerUrl:'https://example.invalid/owner',manageUrl:'https://example.invalid/manage',reason:'Synthetic reason'};
 const time=appointmentMessage({...base,kind:'appointment.declined_time'}),service=appointmentMessage({...base,kind:'appointment.declined_service'});
 assert.match(time.body,/choose another available time/);assert.match(time.body,/Ed Hemmer\nYour Neighborhood Service Guy/);assert.ok(!time.body.includes('My services include'));assert.match(service.body,/future project/);assert.ok(service.body.includes('Synthetic reason'));assert.ok(service.html.includes('Explore home &amp; yard services'));
});
