import {localInstant} from '../../../packages/domain/timezone.ts';
export function snapshotWindow(from:string,to:string,timezone:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('VALIDATION');
 const a=Date.parse(from),b=Date.parse(to);
 if(!Number.isFinite(a)||!Number.isFinite(b)||new Date(a).toISOString().slice(0,10)!==from||new Date(b).toISOString().slice(0,10)!==to||(b-a)/86400000>366)throw Error('VALIDATION');
 const next=new Date(b+86400000).toISOString().slice(0,10);
 return {start:new Date(localInstant(from+'T00:00',timezone)).toISOString(),end:new Date(localInstant(next+'T00:00',timezone)).toISOString()};
}
export function chartPercent(value:number,max:number){
 if(!Number.isFinite(value)||!Number.isFinite(max)||value<0||max<0)throw Error('INVALID_METRIC');
 return max===0?0:Math.min(100,100*value/max);
}
export type BusinessSnapshot={checkedAt:string;from:string;to:string;timezone:string;finance:{cashReceivedCents:number;expenseCents:number;cashAfterExpensesCents:number;issuedInvoicesCents:number;outstandingAsOfEndCents:number;paymentCount:number;expenseCount:number};counts:{customers:number;requestsInPeriod:number;requestsToReview:number;upcomingVisits:number;proposals:number;working:number;paused:number;completed:number;quotes:number;messagesToCheck:number;rescheduleRequests:number};email:{enabled:boolean;automaticSending:boolean}};
