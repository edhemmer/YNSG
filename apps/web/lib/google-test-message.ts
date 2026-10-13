import {emailLayout,emailParagraph,emailSignedText,type EmailIdentity} from '../../../lib/email-layout.js';
export function googleTestMessage(company:string,identity?:EmailIdentity,mode:'gmail'|'business'='gmail'){
 const copy=mode==='business'?'This is the email test you requested. Please return to Settings and confirm that it arrived.':'Your business email connection is working. Please return to Settings and confirm that this message arrived before enabling email notifications.';
 const note='This is a test for you. No customer appointment or service request has been changed.';
 return {subject:company+' — Email connection test',body:emailSignedText(copy+'\n\n'+note,identity),html:emailLayout(company,mode==='business'?'Business email test':'Your email is connected',mode==='business'?'A test for your workspace':'Your business email test arrived',emailParagraph(copy)+emailParagraph(note),identity)};
}
