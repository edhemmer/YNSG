import {futureProjectInvitation} from './decline-message.ts';
import {emailLayout,emailParagraph,emailButton,emailSignedText,type EmailIdentity} from '../../../lib/email-layout.js';
type RequestContact = {
  name?: string; email: string; phone?: string; street?: string; city?: string;
};
export function requestDeclinedMessage(company: string, request: RequestContact, identity?:EmailIdentity, reason?:string, organization?:string) {
  const invitation=futureProjectInvitation(organization);
  const body = `Hi ${request.name || "there"},\n\nThank you for reaching out to ${company}.\n\n${reason||"I won’t be able to take on this particular project, but I appreciate you considering me."}\n\nWe haven’t booked an appointment for this request.${invitation?'\n\n'+invitation:''}\n\nYou’re welcome to reply to this email with any questions.`;
  return {
    to: request.email,
    subject: "Update on your service request",
    body:emailSignedText(body,identity),
    html:emailLayout(company,'An update on your request','An update from '+company,body.split('\n\n').map(block=>block==='See services and limits:\nhttps://www.yourneighborhoodserviceguy.com/services'?emailButton('Explore home & yard services','https://www.yourneighborhoodserviceguy.com/services'):emailParagraph(block)).join(''),identity),
  };
}
