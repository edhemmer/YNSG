import type {BusinessSnapshot} from './business-snapshot.ts';
type Totals=Pick<BusinessSnapshot,'counts'|'finance'>;
type Action={title:string;description:string;label:string;section:string}|null;
export function nextBusinessAction(data:Totals|null):Action{
 if(!data)return null;
 if(data.counts.requestsToReview)return {title:'Review a new request',description:'Check every requested service and the proposed time.',label:'Open request inbox',section:'Requests'};
 if(data.counts.rescheduleRequests)return {title:'Review a requested time change',description:'The current appointment stays booked until its replacement is approved.',label:'Open request inbox',section:'Requests'};
 if(data.counts.proposals)return {title:'Decide on a proposed time',description:'Accept, choose another time or decline the proposal.',label:'Open request inbox',section:'Requests'};
 if(data.counts.messagesToCheck)return {title:'Check customer message delivery',description:'Review queued messages and delivery exceptions; follow up where needed.',label:'Open activity & messages',section:'Activity'};
 if(data.counts.upcomingVisits)return {title:'Review the next visit',description:'Check the appointment, route and customer notes.',label:'Open calendar',section:'Calendar'};
 if(data.counts.working+data.counts.paused)return {title:'Continue the active job',description:'Record progress while the details are fresh.',label:'Open active jobs',section:'Work'};
 if(data.counts.quotes)return {title:'Follow up on a sent quote',description:'Check whether the customer has accepted the scope and price.',label:'Open quotes & jobs',section:'Work'};
 if(data.finance.outstandingAsOfEndCents>0)return {title:'Review unpaid invoices',description:'Check invoice status and record payments received.',label:'Open invoices',section:'Money'};
 return {title:'You’re caught up on these items',description:'No pending requests, time decisions, messages needing review, visits, active jobs, sent quotes or unpaid balances were reported in this check.',label:'Open requests',section:'Requests'};
}
