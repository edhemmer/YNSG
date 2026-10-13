import {emailLayout,emailParagraph,emailSignedText,type EmailIdentity} from '../../../lib/email-layout.js';
type RequestContact = {
  name?: string; email: string; phone?: string; street?: string; city?: string;
};
export function requestDeclinedMessage(company: string, request: RequestContact, identity?:EmailIdentity) {
  const body = `Hi ${request.name || "there"},\n\nThanks for reaching out. Unfortunately, we won't be able to take on this job. We haven't booked an appointment for it.\n\nIf you have any questions, you're welcome to reply to this email.`;
  return {
    to: request.email,
    subject: "Update on your service request",
    body:emailSignedText(body,identity),
    html:emailLayout(company,'An update on your request','An update from '+company,body.split('\n\n').map(emailParagraph).join(''),identity),
  };
}
