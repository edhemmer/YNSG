import {emailIdentity} from '../../../lib/email-layout.js';
import {customerRequestEmail} from '../../../lib/customer-request-email.js';
import {ownerRequestEmail} from '../../../lib/owner-request-email.js';
import {appointmentMessage,type AppointmentMessageInput} from './appointment-message.ts';
import {requestDeclinedMessage} from './request-message.ts';
import {delayMessage} from './delay-message.ts';
import {invoiceDocument,type InvoiceDocument} from './invoice-document.ts';
import {invoiceMessage} from './invoice-message.ts';
import {paidInvoiceMessage} from './paid-invoice-message.ts';
import {googleTestMessage} from './google-test-message.ts';
export type SampleMessage={id:string;label:string;audience:'owner'|'customer';to:string;subject:string;body:string;html:string;pdf?:boolean};
export type SampleSuite={invoice:InvoiceDocument;messages:SampleMessage[];createdAt:string;settingsWarnings:string[]};
export function productionSamples(settings:Record<string,any>,org:string,recipient:string,origin:string,run:string,now=new Date()):SampleSuite {
 const identity=emailIdentity(settings,org),company=settings.displayName;
 if(!company||!recipient||settings.notificationRecipient?.toLowerCase()!==recipient.toLowerCase())throw Error('APPROVED_SAMPLE_RECIPIENT_REQUIRED');
 const base=new URL(origin);if(base.protocol!=='https:'||base.username||base.password)throw Error('INVALID_SAMPLE_ORIGIN');
 const url=base.origin+'/owner/production-check?'+new URLSearchParams({organization:org,run});
 const arrivalAt=new Date(now.getTime()+3*86400000).toISOString(),timezone=settings.timezone||'America/Chicago';
 const request={name:'Sample Customer — demonstration only',phone:'202-555-0148',email:recipient,street:'100 Example Street (sample address)',city:'DeKalb',region:'IL',postalCode:'60115',description:'SAMPLE ONLY. No visit or payment is being requested.',communityRate:'No',preferredTime:'To be arranged',services:[{service:'Home tasks',task:'Furniture assembly'},{service:'Home tasks',task:'Door adjustment'}]};
 const invoice=invoiceDocument({number:1,issued_at:now.toISOString(),total_cents:12000,payments:[],snapshot:{configuration:{sellerLegalName:settings.sellerLegalName||company,timezone,notificationRecipient:recipient,invoiceTerms:settings.invoiceTerms||'SAMPLE — NOT A BILL. Example terms only; publish your actual invoice terms before issuing a customer invoice.'},recipient:{name:request.name,email:recipient,phone:request.phone,street:request.street,city:request.city,region:'IL',postalCode:'60115'},recordedWork:[{description:'SAMPLE: Furniture assembly — two hours of labor',chargedCents:12000},{description:'SAMPLE: Door adjustment — courtesy task',chargedCents:0}]}});
 invoice.sample=true;
 let messages:SampleMessage[]=[];
 function add(id:string,label:string,audience:'owner'|'customer',m:{subject:string;body:string;html:string},pdf=false){
 const note='SAMPLE ONLY — '+audience+' template: '+label+'. No appointment, bill or payment has been created. Preview buttons open the sample screen and cannot act on a customer record.';
 messages.push({id,label,audience,to:recipient,subject:'[SAMPLE '+audience.toUpperCase()+'] '+m.subject,body:note+'\n\n'+m.body,html:m.html.replace(/(<body[^>]*>)/,'$1<div style="background:#fff3cd;color:#10283c;padding:18px;font:16px Arial">'+note+'</div>'),...(pdf?{pdf:true}:{})});
 }
 const owner=ownerRequestEmail(request,request.services,run,company,'',url,identity);
 add('request.owner_notification','New service request','owner',{subject:company+' New Request',body:owner.text,html:owner.html});
 add('request.customer_receipt','Request received','customer',customerRequestEmail(company,request,identity));
 const kinds:AppointmentMessageInput['kind'][]=['appointment.owner_approval','appointment.confirmation','appointment.owner_confirmation','appointment.reminder','appointment.owner_reminder','appointment.declined_time','appointment.declined_service','appointment.reschedule_requested'];
 const labels=['Appointment awaiting approval','Appointment confirmed','Owner booking confirmation','Customer reminder','Owner reminder','Requested time declined','Appointment service declined','Reschedule requested'];
 kinds.forEach((kind,i)=>add(kind,labels[i]!,['appointment.owner_approval','appointment.owner_confirmation','appointment.owner_reminder','appointment.reschedule_requested'].includes(kind)?'owner':'customer',appointmentMessage({kind,company,identity,recipient,notificationRecipient:recipient,request,arrivalAt,timezone,ownerUrl:url,manageUrl:url,confirmUrl:url,rescheduleUrl:url,reason:'Sample explanation for this preview.',preference:{preferred_local_start:'2026-10-15T10:00',note:'Sample request for a different time.'}})));
 add('request.declined','Service request declined','customer',requestDeclinedMessage(company,request,identity));
 add('appointment.delay_notice','Running late','customer',delayMessage(company,recipient,request.name,new Date(Date.parse(arrivalAt)+15*60000).toISOString(),timezone,identity));
 add('invoice.delivery','Invoice and PDF','customer',invoiceMessage(invoice,identity),true);
 add('invoice.paid','Payment thank-you and review','customer',paidInvoiceMessage({...invoice,paidCents:12000,balanceCents:0},settings.review,identity));
 add('connection.test','Gmail connection test','owner',googleTestMessage(company,identity));
 // A sample must never generate a public review or real attendance action.
 messages=messages.map(m=>({...m,body:m.body.replaceAll(settings.review?.url||'__none__',url),html:m.html.replaceAll(settings.review?.url||'__none__',url)}));
 return {invoice,messages,createdAt:now.toISOString(),settingsWarnings:[...(!settings.invoiceTerms?['Publish invoice terms in Settings before issuing real invoices.']:[]),...(settings.sellerVerified!==true?['Confirm the seller identity in Settings.']:[]),...(settings.taxTreatmentVerified!==true?['Confirm tax treatment in Settings before issuing real invoices.']:[])]};
}
