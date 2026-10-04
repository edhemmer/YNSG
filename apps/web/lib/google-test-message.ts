import {emailLayout,emailParagraph,emailSignedText,type EmailIdentity} from '../../../lib/email-layout.js';
export function googleTestMessage(company:string,identity?:EmailIdentity){
 const copy='Your business email connection is working. Please return to Settings and confirm that this message arrived before enabling email notifications.';
 const note='This is a test for you. No customer appointment or service request has been changed.';
 return {subject:company+' — Email connection test',body:emailSignedText(copy+'\n\n'+note,identity),html:emailLayout(company,'Your email is connected','Your business email test arrived',emailParagraph(copy)+emailParagraph(note),identity)};
}
