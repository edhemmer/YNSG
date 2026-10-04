const messageNames: Record<string, string> = {
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
 'appointment.reschedule_requested': 'Rescheduling request',
};
export function notificationName(kind: string): string {
 return Object.hasOwn(messageNames, kind) ? messageNames[kind]! : 'Business notification';
}
export type AttentionRecord={id:string;kind:string;status:string;object_id:string;created_at:string;next_attempt_at:string;lease_until:string|null;attempts:number};
export function notificationAttention(row:AttentionRecord,enabled:boolean,now:number){
 if(row.status==='needs_reconciliation')return {label:'Check the delivery result',action:'The send result is uncertain. Check Gmail sent mail before any resend; automatic retries are stopped.'};
 if(row.status==='dead_letter')return {label:'Delivery stopped after repeated failures',action:'Check your Google connection in Settings and review this message before trying again.'};
 if(row.status==='failed')return {label:'Last send failed',action:enabled?'The system may retry when this message is due. If it stays here, check email delivery in Settings.':'Connect Gmail, confirm the test email arrived and enable notifications in Settings.'};
 if(!enabled)return {label:'Email delivery is paused',action:'Connect Gmail, confirm the test email arrived and enable notifications in Settings. The saved notification remains queued.'};
 if(row.status==='sending')return {label:'Waiting for the send result',action:row.lease_until&&Date.parse(row.lease_until)<=now?'The send result has not arrived. Check Gmail sent mail before taking action; do not resend until the result is known.':'The email service is processing this message. Wait for its result.'};
 if(row.status==='leased')return {label:'Preparing the message',action:row.lease_until&&Date.parse(row.lease_until)<=now?'Preparation timed out before sending. Check email delivery in Settings.':'The system is preparing this message for delivery.'};
 return {label:'Waiting to send',action:'This message is due. If it stays here, check email delivery in Settings.'};
}
