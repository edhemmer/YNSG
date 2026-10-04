import {emailLayout,emailParagraph,emailSignedText,type EmailIdentity} from '../../../lib/email-layout.js';
type RequestContact = {
  name?: string; email: string; phone?: string; street?: string; city?: string;
};
export function requestDeclinedMessage(company: string, request: RequestContact, identity?:EmailIdentity) {
  const body = `Hi ${request.name || "there"},\n\nThanks for getting in touch with ${company}. We’re unable to accept this service request. No appointment has been booked for this request.\n\nIf you have a question, please reply to this email.`;
  return {
    to: request.email,
    subject: "Update on your service request",
    body:emailSignedText(body,identity),
    html:emailLayout(company,'An update on your request','An update from '+company,body.split('\n\n').map(emailParagraph).join(''),identity),
  };
}
