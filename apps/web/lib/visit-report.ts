import {safeEmailCta,emailRequestUrl,type EmailDraft} from './email-templates.ts';
// Owner-written visit report sent from the owner's own email app (photos attached there).
// Pure text assembly: no storage, no sending, no pricing. Every line is what the owner typed.
export type VisitReport={customerName:string;visitDate:string;workDone:string;noticed:string;photosAttached:boolean;nextVisit:string;reviewLink:string};
export const visitReportLimits=Object.freeze({workDone:2000,noticed:1200,nextVisit:300});
const clean=(v:string,max:number)=>v.replace(/\r/g,'').trim().slice(0,max);
export function workLines(text:string){return clean(text,visitReportLimits.workDone).split('\n').map(l=>l.replace(/^[\s•*\-–]+/,'').trim()).filter(Boolean).slice(0,25);}
export function visitDateLabel(iso:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
 const d=new Date(iso+'T12:00:00Z');if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso)return '';
 return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
}
export function visitReportReady(r:VisitReport){return workLines(r.workDone).length>0&&Boolean(visitDateLabel(r.visitDate));}
export function visitReportDraft(r:VisitReport):EmailDraft{
 const first=r.customerName.trim().split(/\s+/)[0]||'neighbor',when=visitDateLabel(r.visitDate),lines=workLines(r.workDone);
 const noticed=clean(r.noticed,visitReportLimits.noticed),next=clean(r.nextVisit,visitReportLimits.nextVisit),review=safeEmailCta(r.reviewLink);
 const parts=[`Hi ${first},`,`Thank you for having us${when?' on '+when:''}. Here’s a quick report of the visit so you have a record of what was done.`,'What we did:\n'+lines.map(l=>'• '+l).join('\n')];
 if(noticed)parts.push('What we noticed:\n'+noticed);
 if(r.photosAttached)parts.push('Before-and-after photos are attached to this email.');
 parts.push('Our promise: if anything isn’t right within 7 days, just reply to this email and we’ll come back and make it right.');
 if(next)parts.push('Suggested next visit:\n'+next);
 parts.push('Thank you,\nYour Neighborhood Service Guy LLC\nWe’re Here to Help.');
 return {subject:'Your visit report'+(when?' for '+when:''),body:parts.join('\n\n'),cta:review?'Share a quick Google review':'Plan your next visit',url:review||emailRequestUrl};
}
