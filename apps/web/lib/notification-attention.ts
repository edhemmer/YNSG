export type AttentionRecord={id:string;kind:string;status:string;object_id:string;created_at:string;next_attempt_at:string;lease_until:string|null;attempts:number};
export function notificationAttention(row:AttentionRecord,enabled:boolean,now:number){
 if(row.status==='needs_reconciliation')return {label:'Check the delivery result',action:'The send result is uncertain. Check Gmail sent mail before any resend; automatic retries are stopped.'};
 if(row.status==='dead_letter')return {label:'Delivery stopped after repeated failures',action:'Review the Google connection and delivery diagnostics. This message needs an owner review.'};
 if(row.status==='failed')return {label:'Last send failed',action:enabled?'The worker may retry when this message is due. Check recurring worker execution if it stays here.':'Complete Google connection, receipt verification and email activation.'};
 if(!enabled)return {label:'Email delivery is paused',action:'Complete Google connection, receipt verification and email activation. The saved notification remains queued.'};
 if(row.status==='sending')return {label:'Waiting for the send result',action:row.lease_until&&Date.parse(row.lease_until)<=now?'The send lease expired. The worker must reconcile this uncertain result; do not resend blindly.':'A provider call is in progress. Wait for its result.'};
 if(row.status==='leased')return {label:'Preparing the message',action:row.lease_until&&Date.parse(row.lease_until)<=now?'The worker lease expired before sending. Check worker execution.':'The worker has claimed this message.'};
 return {label:'Waiting for the email worker',action:'This message is due. Check recurring worker execution if it remains queued.'};
}
