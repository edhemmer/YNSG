import {emailLayout,emailButton} from '../../../lib/email-layout.js';
import type { InvoiceDocument } from './invoice-document.js';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function paidInvoiceMessage(d:InvoiceDocument,review:unknown){
 if(!d.recipient||d.totalCents<=0||d.balanceCents!==0||d.paidCents!==d.totalCents)throw Error('CONFIRMED_FULL_PAYMENT_REQUIRED');
 let reviewUrl:string|undefined;
 if(review&&typeof review==='object'&&'enabled' in review&&review.enabled===true){
  if(!('url' in review)||typeof review.url!=='string')throw Error('REVIEW_URL_REQUIRED');
  const u=new URL(review.url);
  if(u.protocol!=='https:'||u.username||u.password)throw Error('INVALID_REVIEW_URL');
  reviewUrl=u.toString();
 }
 const total=(d.totalCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const greeting=`Hi ${d.recipient.name},`;
 const thanks=`Thank you for your payment. Invoice ${d.number} for ${total} is paid in full. We appreciate you choosing ${d.businessName}.`;
 const ask='If you have a moment, we’d appreciate a review of your experience.';
 return {to:d.recipient.email,subject:`${d.businessName} — Thank you for your payment`,
 body:[greeting,thanks,...(reviewUrl?[ask,reviewUrl]:[]),'If you need anything else, you can reply to this email.'].join('\n\n'),
 html:emailLayout(d.businessName,'Thank you',`Invoice ${d.number} is paid in full`, `<p>${escape(greeting)}</p><p>${escape(thanks)}</p>${reviewUrl?`<p>${ask}</p>${emailButton("Leave a review",reviewUrl)}`:''}<p>If you need anything else, you can reply to this email.</p>`)}
}
