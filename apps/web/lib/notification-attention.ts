const messageNames: Record<string, string> = {
 'recurring.confirmation': 'Weekly schedule confirmation',
 'recurring.stopped': 'Repeat visits stopped',
 'request.customer_receipt': 'Customer request acknowledgement',
 'request.owner_notification': 'New service request',
 'request.declined': 'Service request declined',
 'invoice.delivery': 'Invoice email',
 'invoice.paid': 'Payment thank-you email',
 'appointment.owner_approval': 'Appointment approval needed',
 'appointment.confirmation': 'Appointment confirmation',
 'appointment.reminder': 'Customer appointment reminder',
 'appointment.owner_reminder': 'Your appointment reminder',
 'appointment.declined_time': 'Requested time declined',
 'appointment.declined_service': 'Appointment declined',
 'appointment.canceled': 'Appointment cancellation',
 'appointment.reschedule_requested': 'Rescheduling request',
};
export const mailAttentionKinds=Object.keys(messageNames);
// The dashboard and Activity must describe the same email queue. Optional
// calendar projections are tracked by calendar connections, not this queue.
export function mailAttentionDueFilter(now:string){
 return `and(kind.neq.invoice.paid,or(status.in.(needs_reconciliation,dead_letter),next_attempt_at.lte.${now})),and(kind.eq.invoice.paid,payload->>schemaVersion.eq.2,or(status.in.(needs_reconciliation,dead_letter),next_attempt_at.lte.${now}))`;
}
export function notificationName(kind: string): string {
 return Object.hasOwn(messageNames, kind) ? messageNames[kind]! : 'Business notification';
}
export type AttentionRecord={id:string;kind:string;status:string;object_id:string;created_at:string;next_attempt_at:string;lease_until:string|null;attempts:number};
export function notificationAttention(row:AttentionRecord,enabled:boolean,now:number){
 if(row.status==='accepted')return {label:'Accepted by email service',action:'The email service accepted this message. This does not confirm inbox receipt.'};
 if(row.status==='suppressed')return {label:'Not sent',action:'This message was skipped by the saved delivery rules. Review the related request before sending a separate message.'};
 if(row.status==='needs_reconciliation')return {label:'Check the delivery result',action:'The send result is uncertain. Check the saved delivery result before sending again. Automatic retries are paused.'};
 if(row.status==='dead_letter')return {label:'Delivery stopped after repeated failures',action:'Review Business email in Settings and check this message before trying again.'};
 if(row.status==='failed')return {label:'Last send failed',action:enabled?'The system may retry when this message is due. If it stays here, check email delivery in Settings.':'Verify Business email and enable notifications in Settings.'};
 if(!enabled)return {label:'Email delivery is paused',action:'Verify Business email and enable notifications in Settings. The saved notification remains queued.'};
 if(row.status==='sending')return {label:'Waiting for the send result',action:row.lease_until&&Date.parse(row.lease_until)<=now?'The send result has not arrived. Check the saved delivery result before taking action. Wait until the result is known before sending again.':'The email service is processing this message. Wait for its result.'};
 if(row.status==='leased')return {label:'Preparing the message',action:row.lease_until&&Date.parse(row.lease_until)<=now?'Preparation timed out before sending. Check email delivery in Settings.':'The system is preparing this message for delivery.'};
 if(Date.parse(row.next_attempt_at)>now)return {label:'Scheduled to send',action:'This message is waiting for its scheduled send time.'};
 return {label:'Waiting to send',action:'This message is due. If it stays here, check email delivery in Settings.'};
}
