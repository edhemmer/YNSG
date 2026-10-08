import {requestTiming} from './request-timing.js';
import {emailLayout,emailEscape,emailParagraph,emailSignedText} from './email-layout.js';
export function customerRequestEmail(company,request,identity){
 const services=Array.isArray(request.services)&&request.services.length?request.services:[{service:request.service||'Work requested',task:request.task||'Details to discuss'}];
 const groups=new Map();for(const item of services){if(!groups.has(item.service))groups.set(item.service,[]);groups.get(item.service).push(item.task);}
 const timing=requestTiming(request.preferredTime);
 const greeting=`Hi ${request.name||'there'},`;
 const followup='We’ll call you to confirm the work, details, and date. '+(typeof request.preferredTime==='string'&&request.preferredTime.trim()?'Your requested time is awaiting our review. ':'')+'This email does not confirm an appointment.';
 const text=[greeting,'Thanks for getting in touch. We’ve received your service request.','Requested day and time:\n'+timing,'Work requested:',...[...groups].map(([service,tasks])=>service+'\n'+tasks.map(task=>'• '+task).join('\n')),followup,'If anything changes, reply to this email.'].join('\n\n');
 const html=emailLayout(company,'Your request came through','We’ll call to confirm your service request',emailParagraph(greeting)+emailParagraph('Thanks for getting in touch. We’ve received your service request.')+'<h2 style="font-size:20px;margin:22px 0 10px">Requested day and time</h2>'+emailParagraph(timing)+'<h2 style="font-size:20px;margin:22px 0 10px">Work requested</h2>'+[...groups].map(([service,tasks])=>`<h3 style="font-size:17px;margin:16px 0 6px">${emailEscape(service)}</h3><ul style="padding-left:24px">${tasks.map(task=>`<li style="margin:6px 0">${emailEscape(task)}</li>`).join('')}</ul>`).join('')+emailParagraph(followup)+emailParagraph('If anything changes, reply to this email.'),identity);
 return {to:request.email,subject:company+' — Service request received',body:emailSignedText(text,identity),html};
}
