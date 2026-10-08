export type Submission={name:string;phone:string;email:string;street:string;city:string;description?:string;preferredTime?:string;communityRate?:string;service?:string;task?:string;services?:{service:string;task:string}[]};
export type Visit={id:string;request_id:string;status:string;revision:number;start_at:string;end_at:string;arrival_at:string;expires_at:string|null;replaces_id:string|null;customer_response:string};
export type InboxRequest={id:string;status:string;revision:number;created_at:string;original_submission:Submission;appointments:Visit[]};
export type LinkedQuote={id:string;request_id:string;status:string;current_version:number;quote_versions:{version:number;scope:string;labor_cents:number;duration_minutes:number}[]};
export type LinkedJob={id:string;quote_id:string;status:string;revision:number};
export type LinkedInvoice={id:string;job_id:string;number:number;total_cents:number;payments:{cents:number}[]};
export type InboxData={requests:InboxRequest[];total:number;needsReview:number;page:number;hasMore:boolean;checkedAt:string;quotes:LinkedQuote[];jobs:LinkedJob[];invoices:LinkedInvoice[];preferences:{id:string;request_id:string;preferred_local_start:string|null;note:string;timezone:string}[]};
export const requestTasks=(r:Submission)=>r.services?.length?r.services:[{service:r.service||'Service request',task:r.task||'Details to review'}];
export function visitState(v:Pick<Visit,'status'|'expires_at'>,now=Date.now()){
 if(['held','proposal'].includes(v.status)&&v.expires_at&&Date.parse(v.expires_at)<=now)return 'expired';
 return v.status;
}
export function requestStage(r:InboxRequest,now=Date.now()){
 if(['declined','canceled'].includes(r.status))return {label:r.status==='declined'?'Declined':'Canceled',tone:'neutral',next:'View history'};
 if(r.appointments.some(a=>visitState(a,now)==='proposal'))return {label:'Needs approval',tone:'amber',next:'Review appointment'};
 if(r.appointments.some(a=>visitState(a,now)==='reserved'))return {label:'Confirmed',tone:'green',next:'Manage visit'};
 if(r.appointments.some(a=>visitState(a,now)==='needs_review'))return {label:'Schedule needs review',tone:'amber',next:'Review schedule'};
 if(r.status==='submitted')return {label:'New request',tone:'blue',next:'Review request'};
 if(r.status==='reviewing')return {label:'Under review',tone:'amber',next:'Choose next step'};
 if(r.status==='quoted')return {label:'Quoted',tone:'violet',next:'Review quote'};
 return {label:r.status.replaceAll('_',' '),tone:'neutral',next:'Open request'};
}
// PostgREST OR clauses use a small literal-only search alphabet. No filter syntax
// or wildcard characters from the search input can become query operators.
export function inboxSearch(value:string){return value.normalize('NFKC').replace(/[^\p{L}\p{N} @+.'’\-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,100);}
