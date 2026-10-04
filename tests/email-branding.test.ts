import test from 'node:test';
import assert from 'node:assert/strict';
import {emailIdentity,emailLayout,emailSignedText,YNSG_EMAIL_IDENTITY} from '../lib/email-layout.js';
import {googleTestMessage} from '../apps/web/lib/google-test-message.ts';
import {mailActivationBlocker} from '../apps/web/lib/mail-activation.ts';
import {requestDeclinedMessage} from '../apps/web/lib/request-message.ts';
import {ownerRequestEmail} from '../lib/owner-request-email.js';
import {appointmentMessage} from '../apps/web/lib/appointment-message.ts';
import {invoiceMessage} from '../apps/web/lib/invoice-message.ts';
import {paidInvoiceMessage} from '../apps/web/lib/paid-invoice-message.ts';
import {invoiceDocument} from '../apps/web/lib/invoice-document.ts';
import {companySettings} from '../packages/contracts/index.ts';
test('identity belongs to the organization, never a matching display name, and blank overrides are respected',()=>{
 assert.deepEqual(emailIdentity(null,'a933d657-14d3-46b6-85e6-21d973e4ed97'),YNSG_EMAIL_IDENTITY);
 assert.deepEqual(emailIdentity({},'another-business'),{logoUrl:null,ownerName:''});
 const identity=emailIdentity({brand:{ownerName:'Another Owner',logoUrl:'https://example.invalid/logo.png'}},'another-business');
 assert.equal(identity.ownerName,'Another Owner');assert.ok(!JSON.stringify(identity).includes('Hemmer'));
 assert.deepEqual(emailIdentity({brand:{ownerName:null,logoUrl:null}},'a933d657-14d3-46b6-85e6-21d973e4ed97'),{logoUrl:null,ownerName:''});
});
test('shared email branding escapes identity, rejects unsafe URLs, and preserves readable image fallback',()=>{
 const html=emailLayout('A & B','Message','Preview','<p>Contents</p>',{ownerName:'Owner <script>',logoUrl:'https://example.invalid/logo.png?a=1&b=2'});
 assert.ok(html.includes('Owner &lt;script&gt;'));assert.ok(!html.includes('Owner <script>'));
 assert.ok(html.includes('alt="A &amp; B logo"'));assert.ok(html.includes('Best Regards,'));
 for(const logoUrl of ['javascript:alert(1)','http://example.invalid/logo.png','https://user:password@example.invalid/logo.png'])assert.throws(()=>emailLayout('Business','Title','Preview','',{logoUrl}));
 assert.throws(()=>emailSignedText('Body',{ownerName:'Owner\nInjected'}));
 assert.equal(emailSignedText('Body',{ownerName:'Another Owner'}),'Body\n\nBest Regards,\nAnother Owner');
 assert.equal(companySettings.shape.brand.safeParse({navy:'#10283c',forest:'#315842',gold:'#edbd6b',cream:'#f8f6ef',ownerName:'Owner',logoUrl:'javascript:bad'}).success,false);
});
test('test, decline, owner request and appointment emails share HTML logo and matching text signature',()=>{
 const identity=YNSG_EMAIL_IDENTITY,company='Your Neighborhood Service Guy';
 const testMessage=googleTestMessage(company,identity);
 const declined=requestDeclinedMessage(company,{name:'Synthetic',email:'test@example.invalid'},identity);
 const owner=ownerRequestEmail({name:'Synthetic',phone:'5550000000',email:'test@example.invalid',street:'100 Test St',city:'DeKalb'},[{service:'Yard',task:'Weeds'}],'test-id',company,'IL',null,identity);
 const appointment=appointmentMessage({kind:'appointment.confirmation',company,identity,recipient:'test@example.invalid',notificationRecipient:'owner@example.invalid',request:{name:'Synthetic',street:'100 Test St',city:'DeKalb'},arrivalAt:'2026-10-07T14:00Z',timezone:'America/Chicago',ownerUrl:'https://example.invalid/owner',manageUrl:'https://example.invalid/manage',confirmUrl:'https://example.invalid/confirm',rescheduleUrl:'https://example.invalid/reschedule'});
 for(const message of [testMessage,declined,{...owner,body:owner.text},appointment]){
  assert.ok(message.html.includes(identity.logoUrl!));assert.ok(message.html.includes('Edward Hemmer'));
  assert.ok(message.body.endsWith('Best Regards,\nEdward Hemmer'));
 }
 assert.equal(testMessage.subject,company+' — Email connection test');assert.ok(!testMessage.body.includes('Your existing website'));
});
test('mail activation explains the actual prerequisite instead of leaving a disabled button unexplained',()=>{
 const delivery={configurationVersion:1,senderMatches:true,testKey:'test'};
 assert.ok(mailActivationBlocker({...delivery,configurationVersion:null},'accepted',true)?.includes('Publish'));
 assert.ok(mailActivationBlocker({...delivery,senderMatches:false},'accepted',true)?.includes('must match'));
 assert.ok(mailActivationBlocker(delivery,'accepted',false)?.includes('checking the box'));
 assert.equal(mailActivationBlocker(delivery,'accepted',true),null);
});

test('invoice and paid thank-you retain approved cents while sharing the configured signature',()=>{
 const document=invoiceDocument({number:12,issued_at:'2026-10-03T14:00:00Z',total_cents:4500,payments:[{cents:4500}],snapshot:{configuration:{sellerLegalName:'Synthetic Company',invoiceTerms:'Agreed terms',timezone:'America/Chicago'},recipient:{name:'Synthetic',email:'test@example.invalid',phone:'5550000000',street:'100 Test St',city:'DeKalb',region:'IL',postalCode:''},recordedWork:[{description:'Garden work',chargedCents:4500,recordedMinutes:120}]}});
 const identity={ownerName:'Another Owner',logoUrl:'https://example.invalid/logo.png'};
 for(const message of [invoiceMessage(document,identity),paidInvoiceMessage(document,{enabled:false},identity)]){
  assert.ok(message.html.includes(identity.logoUrl));assert.ok(message.body.endsWith('Best Regards,\nAnother Owner'));
  assert.ok(!JSON.stringify(message).includes('Hemmer'));assert.ok(message.body.includes('$45.00'));
 }
});
