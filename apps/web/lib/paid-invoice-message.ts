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
 html:`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f8f6ef;color:#10283c;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:24px;background:white;font-size:18px;line-height:1.6;overflow-wrap:anywhere"><h1 style="font-size:26px">Thank you</h1><p>${escape(greeting)}</p><p>${escape(thanks)}</p>${reviewUrl?`<p>${ask}</p><p><a href="${escape(reviewUrl)}" style="display:inline-block;padding:14px 20px;background:#21503a;color:white;border-radius:6px;font-weight:bold">Leave a review</a></p>`:''}<p>If you need anything else, you can reply to this email.</p></div></body></html>`};
}
