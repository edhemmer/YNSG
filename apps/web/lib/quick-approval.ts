import {localMinute} from '../../../packages/domain/timezone.ts';
import {schedulingReview} from '../../../packages/contracts/scheduling-review.ts';
import {confirmationReview} from './confirmation-review.ts';
export type ApprovalAttempt={input:Record<string,unknown>;key:string}|null;
type Context={requestRevision:number;configurationVersion:number;scheduleRevision:number;settings:{timezone:string;scheduling:{bufferMinutes:number|null}};appointmentResources:string[];appointment:{id:string;revision:number;start_at:string;end_at:string;arrival_at:string}};
export function approvalInput(context:Context,organization:string,request:string,appointment:string,options?:{travelBeforeMinutes:number;travelAfterMinutes:number;reviewNote:string}) {
 const a=context.appointment,buffer=context.settings.scheduling.bufferMinutes;
 if(!a||a.id!==appointment)throw Error('The appointment changed. Refresh the request.');
 if(!options&&Date.parse(a.arrival_at)!==Date.parse(a.start_at))throw Error('This visit includes a supplier pickup. Open Review to confirm its arrangements.');
 if(buffer===null||(!options&&buffer===0))throw Error('Set a standard travel/setup buffer or confirm travel in Review.');
 return schedulingReview.parse({organizationId:organization,requestId:request,requestRevision:context.requestRevision,configurationVersion:context.configurationVersion,scheduleRevision:context.scheduleRevision,appointmentId:appointment,appointmentRevision:a.revision,replacesId:null,localStart:localMinute(Date.parse(a.start_at),context.settings.timezone),durationMinutes:(Date.parse(a.end_at)-Date.parse(a.start_at))/60000,arrivalOffsetMinutes:(Date.parse(a.arrival_at)-Date.parse(a.start_at))/60000,resources:context.appointmentResources,travelBeforeMinutes:options?.travelBeforeMinutes??0,travelAfterMinutes:options?.travelAfterMinutes??0,...confirmationReview('Quick approval uses the configured '+buffer+'-minute travel/setup buffer.'),...(options?{reviewNote:options.reviewNote}:{}),key:'temporary-validation-key'});
}
// Retain the exact submitted command after a transport failure. The server receipt
// can replay a successful commit even if the appointment is now reserved.
export async function confirmRequestedAppointment(organization:string,request:string,appointment:string,attempt:{current:ApprovalAttempt},send:(path:string,init?:RequestInit)=>Promise<Response>,options?:{travelBeforeMinutes:number;travelAfterMinutes:number;reviewNote:string}) {
 if(attempt.current&&(attempt.current.input.organizationId!==organization||attempt.current.input.requestId!==request||attempt.current.input.appointmentId!==appointment))attempt.current=null;
 if(!attempt.current){
  const response=await send('/api/scheduling-review?'+new URLSearchParams({organization,request,appointment}),{cache:'no-store'});
  const context=await response.json();if(!response.ok)throw Error(context.error);
  const input=approvalInput(context,organization,request,appointment,options),key=crypto.randomUUID();
  attempt.current={input:{...input,key},key};
 }
 const response=await send('/api/scheduling-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.current.input)});
 const value=await response.json();
 if(!response.ok){if(response.status===400||response.status===409)attempt.current=null;throw Error(value.error);}
 if(value.result?.status!=='reserved')throw Error('The time has not been confirmed. Open Review to check its status.');
 return {...value.result,delivery:value.delivery};
}
