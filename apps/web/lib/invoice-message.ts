import {emailLayout,emailSignedText,type EmailIdentity} from '../../../lib/email-layout.js';
import type {InvoiceDocument} from './invoice-document.js';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export function invoiceMessage(d:InvoiceDocument,identity?:EmailIdentity){
 if(!d.recipient)throw Error('INVOICE_CUSTOMER_DETAILS_REQUIRED');
 const customer=d.recipient;
 const address=[customer.street,customer.city,customer.region,customer.postalCode].filter(Boolean).join(', ');
 const issued=new Date(d.issuedAt).toLocaleDateString('en-US',{timeZone:d.timezone});
 const text=[d.businessName,`Invoice ${d.number}`,`Issued ${issued}`,`Customer: ${customer.name}`,`Service address: ${address}`,`Email: ${customer.email}`,`Phone: ${customer.phone}`,...d.lines.map(l=>`${l.description}: ${l.chargedCents?money(l.chargedCents):'No charge'}`),`Invoice total: ${money(d.totalCents)}`,`Payments received: ${money(d.paidCents)}`,`Remaining balance: ${money(d.balanceCents)}`,'Invoice terms:',d.terms,'Reply to this email if you have a question.'].join('\n\n');
 const html=emailLayout(d.businessName, `Invoice ${d.number}`, `Your invoice from ${d.businessName}`, `<p>Issued ${escape(issued)}</p><h2 style="font-size:20px">Customer and service address</h2><p>${escape(customer.name)}<br>${escape(address)}<br>${escape(customer.email)}<br>${escape(customer.phone)}</p><table style="width:100%;border-collapse:collapse;table-layout:fixed"><caption style="text-align:left;font-weight:bold">Work and charges</caption><thead><tr><th scope="col" style="text-align:left">Work</th><th scope="col" style="text-align:right;width:34%">Charge</th></tr></thead><tbody>${d.lines.map(l=>`<tr><td style="padding:12px 8px 12px 0;border-bottom:1px solid #d6dfd7;white-space:pre-wrap">${escape(l.description)}</td><td style="padding:12px 0;text-align:right;border-bottom:1px solid #d6dfd7">${l.chargedCents?money(l.chargedCents):'No charge'}</td></tr>`).join('')}</tbody></table><p>Invoice total: <strong>${money(d.totalCents)}</strong></p><p>Payments received: ${money(d.paidCents)}</p><p>Remaining balance: <strong>${money(d.balanceCents)}</strong></p><h2 style="font-size:20px">Invoice terms</h2><p style="white-space:pre-wrap">${escape(d.terms)}</p><p>Reply to this email if you have a question.</p>`,identity);
 return {to:customer.email,subject:`${d.businessName} — Invoice ${d.number}`,body:emailSignedText(text,identity),html};
}
