import {createHash} from 'node:crypto';
import {businessIdentity} from './business-identity.js';
import {emailLayout,emailParagraph,emailCallout,emailButton,emailSignedText,YNSG_EMAIL_IDENTITY} from './email-layout.js';

// Organization types offered on the business inquiry form. Order matches the form.
export const BUSINESS_INQUIRY_TYPES=Object.freeze([
 'Property manager or landlord',
 'Commercial or mixed-use building owner',
 'Church or place of worship',
 'Office or small business',
 'Realtor or real estate office',
 'Homebuilder or developer',
 'Farm manager or farm operation',
 'Community or senior-service organization',
 'Veterans or disability organization',
 'Other local business or organization'
]);

// Stable email id per inquiry so a retried form never sends a second confirmation.
export function businessConfirmationId(key){
 const h=createHash('sha256').update('business-inquiry-confirmation:'+key).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}

// Confirmation to the person who sent a business inquiry: what happens next and how we work.
// No price, availability, insurance or credential is promised here.
export function businessInquiryEmail({name,company}){
 const first=String(name||'').trim().split(/\s+/)[0]||'there';
 const greeting=`Hi ${first},`;
 const steps=['We reply within one business day (Monday–Friday, 8 AM–5 PM).','If it helps, we set up a free walkthrough to see the property and your list.','You get a written, itemized scope with a fixed price, or a not-to-exceed cap when we can’t see the whole job yet.','Nothing beyond the approved scope happens without your written OK, and every invoice comes with before-and-after photos.'];
 const intro=`Thanks for reaching out about ${company}. I read every inquiry myself, and I’ll be in touch shortly.`;
 const close='Have photos, an inspection report or a punch list? Just reply to this email and attach them.';
 const text=[greeting,intro,'What happens next:',...steps.map(s=>'• '+s),close,'Call or text '+businessIdentity.phoneDisplay+' · '+businessIdentity.website.replace(/^https:\/\//,'')].join('\n\n');
 const html=emailLayout(businessIdentity.brandName,'Thanks for reaching out','What happens next with your property inquiry',
  emailParagraph(greeting)+emailParagraph(intro)+emailCallout('What happens next',steps.map(s=>'• '+s).join('\n'),'navy')+emailParagraph(close)+emailButton('See how we work with businesses',businessIdentity.website+'/business-community-partners/'),
  YNSG_EMAIL_IDENTITY);
 return {subject:businessIdentity.brandName+' — Thanks for reaching out about '+company,text:emailSignedText(text,YNSG_EMAIL_IDENTITY),html};
}
