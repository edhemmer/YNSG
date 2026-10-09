import {emailLayout,emailParagraph,emailSignedText,type EmailIdentity} from '../../../lib/email-layout.js';
export function delayMessage(company:string,recipient:string,name:string,eta:string,timezone:string,identity:EmailIdentity){
 const at=new Date(eta);if(!Number.isFinite(at.getTime()))throw Error('INVALID_ETA');
 const when=new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(at);
 const message=`Hi ${name||'there'}, we’re running a little behind for your service visit. We expect to arrive around ${when}. Thank you for your patience. Please reply if you need to reach us.`;
 return {to:recipient,subject:`An update on your ${company} visit`,body:emailSignedText(message,identity),html:emailLayout(company,'Your visit update','An update on your arrival time',emailParagraph(message),identity)};
}
