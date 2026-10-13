import {visitState,type InboxRequest,type LinkedQuote,type LinkedJob,type LinkedInvoice} from './request-inbox.ts';

export function serviceNextStep(request:InboxRequest,quotes:LinkedQuote[],jobs:LinkedJob[],invoices:LinkedInvoice[]){
 const balance=invoices.reduce((sum,i)=>sum+Math.max(0,i.total_cents-i.payments.reduce((n,p)=>n+p.cents,0)),0);
 if(['declined','canceled'].includes(request.status))return {step:0,title:'Request closed',detail:'The saved history is available below.',action:'history'};
 if(invoices.length)return balance>0?{step:6,title:'Record the payment received',detail:'Open the invoice, send its email if needed, then record cash or Zelle after the money arrives.',action:'invoice'}:{step:7,title:'Paid and complete',detail:'No balance remains on the issued invoices for this request.',action:'invoice'};
 if(jobs.some(j=>j.status==='completed'))return {step:5,title:'Review and issue the invoice',detail:'The work is complete. Review the saved charges and any tax before issuing the invoice.',action:'work'};
 if(jobs.some(j=>['working','paused'].includes(j.status)))return {step:4,title:'Finish and record the work',detail:'Keep the work record current. When the visit is finished, complete the work and review its invoice.',action:'work'};
 if(jobs.some(j=>j.status!=='canceled')&&!request.appointments.some(a=>visitState(a)==='reserved')&&request.appointments.some(a=>a.status==='canceled'))return {step:2,title:'Arrange a replacement appointment',detail:'The earlier visit was canceled. The agreed work and price remain saved.',action:'schedule'};
 if(jobs.some(j=>j.status!=='canceled'))return {step:4,title:'Ready to start work',detail:'The customer’s scope and price approval is recorded. Start the timer when work begins.',action:'work'};
 if(quotes.some(q=>q.status==='sent'))return {step:3,title:'Record the customer’s approval',detail:'Discuss the saved scope and price with the customer. Record their actual agreement before starting work.',action:'work'};
 if(request.appointments.some(a=>visitState(a)==='reserved'))return {step:3,title:'Agree on the work and price',detail:'The appointment is confirmed. Prepare the scope and labor estimate, then record the customer’s agreement.',action:'work'};
 return {step:2,title:request.appointments.some(a=>visitState(a)==='proposal')?'Confirm the requested appointment':'Choose the appointment time',detail:'Review the requested services and choose a valid time. Scheduling does not approve the price.',action:'schedule'};
}

export function invoiceIssuanceReadiness(configuration:Record<string,unknown>|null,taxProfileRequired:boolean){
 const reasons:string[]=[];
 if(!configuration||configuration.sellerVerified!==true||typeof configuration.sellerLegalName!=='string'||configuration.sellerLegalName.trim().length<2)reasons.push('Verify the business seller details in Settings.');
 if(!configuration||typeof configuration.invoiceTerms!=='string'||configuration.invoiceTerms.trim().length<2)reasons.push('Set the invoice payment terms in Settings.');
 if(!taxProfileRequired&&(configuration?.taxTreatmentVerified!==true||configuration.laborTaxTreatment!=='reviewed_non_taxable'))reasons.push('Tax treatment was not reviewed in the saved agreement. Set up reviewed rules in Taxes, then review the applicable rule and customer-approved invoice total.');
 return {ready:reasons.length===0,reasons};
}
export function invoiceDraftFingerprint(lines:Record<string,unknown>[]){
 return JSON.stringify(lines.map(line=>Object.fromEntries(Object.entries({...line,description:typeof line.description==='string'?line.description.trim():line.description}).sort(([a],[b])=>a.localeCompare(b)))));
}
