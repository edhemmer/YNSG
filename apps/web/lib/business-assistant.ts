import type {BusinessSnapshot} from './business-snapshot.ts';
import type {CompanySettings} from '../../../packages/contracts/index.ts';

export type BusinessTask={id:string;title:string;detail:string;label:string;section:string};
const quantity=(n:number,single:string,plural=single+'s')=>`${n.toLocaleString('en-US')} ${n===1?single:plural}`;
export function businessBrief(data:BusinessSnapshot):BusinessTask[]{
 const c=data.counts,tasks:BusinessTask[]=[];
 const add=(id:string,title:string,detail:string,label:string,section:string)=>tasks.push({id,title,detail,label,section});
 if(c.deliveryExceptions) add('exceptions',`${quantity(c.deliveryExceptions,'automation exception')}`,'A failed or uncertain calendar/email action needs attention. Review its recorded outcome before retrying.','Resolve delivery issues','Activity');
 if(c.rescheduleRequests) add('changes',`${quantity(c.rescheduleRequests,'customer time change')}`,'Keep the current appointment until you approve its replacement.','Review time changes','Requests');
 if(c.requestsToReview) add('requests',`${quantity(c.requestsToReview,'request')} to review`,'Check services and proposed time, then approve directly when the details are right.','Review requests','Requests');
 if(c.proposals) add('proposals',`${quantity(c.proposals,'proposed time')} awaiting a decision`,'Accept the saved proposal or choose another time in Review.','Review proposed times','Requests');
 if(c.upcomingVisits) add('routes',`${quantity(c.upcomingVisits,'confirmed visit')} ahead`,'Choose a day to see its stops and travel gaps. Check estimates before departure.','Open day routes','Today');
 if(c.working+c.paused) add('work',`${quantity(c.working+c.paused,'active job')}`,'Record progress or resume paused work.','Open active jobs','Work');
 if(c.quotes) add('quotes',`${quantity(c.quotes,'sent quote')}`,'Review the customer response before following up. A sent quote does not prove it is overdue.','Review quotes','Work');
 if(data.finance.outstandingAsOfEndCents>0) add('payments',`${(data.finance.outstandingAsOfEndCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})} unpaid`,'This is the recorded balance through today. Check payments and invoice terms before following up.','Review invoices','Money');
 if(c.messagesToCheck&&!c.deliveryExceptions) add('automation',`${quantity(c.messagesToCheck,'automation item')} due`,'Review pending work and delivery status. Queued does not mean delivered.','Open activity','Activity');
 return tasks;
}

export type MarketingService={name:string;scope:string;exclusions:string;compliance:string;pricing_mode:string};
export function marketingDraft(settings:CompanySettings,service:MarketingService,format:'post'|'flyer'):string{
 if(!['approved','review'].includes(service.compliance)||!service.name.trim()||!service.scope.trim()||!service.exclusions.trim())throw Error('Choose a published service that is not on hold.');
 const name=settings.displayName.trim(),area=settings.cities.join(', ');
 const rate=(settings.hourly.standardCents/100).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0});
 const pricing=service.pricing_mode==='hourly'?`Standard rate: ${rate}/hour. ${settings.hourly.minimumMinutes/60}-hour minimum.`:'Scope and price confirmed before work begins.';
 const intro=format==='flyer'?`${service.name}\n${name}`:`A few jobs on your list? ${name} handles ${service.name.toLowerCase()} requests in ${area}.`;
 const review=service.compliance==='review'?'Requests are reviewed individually before work is accepted.\n\n':'';
 return `${intro}\n\n${review}${service.scope.trim()}\n\n${pricing}\n\nService area: ${area}.\nConditions: ${service.exclusions.trim()}\n\nRequest service appt. Work, price and timing are confirmed together.`;
}
