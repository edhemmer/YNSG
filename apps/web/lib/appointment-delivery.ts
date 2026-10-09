export type AppointmentDelivery={appointmentStatus:string;revision:number;calendar:string;customerEmail:string;ownerEmail:string};
export function appointmentDeliveryMessage(delivery?:AppointmentDelivery|null){
 if(!delivery)return 'Appointment booked. Delivery status is being checked; open Activity for calendar and email outcomes.';
 const calendar=delivery.calendar==='synced'?'Google Calendar synced.':delivery.calendar==='failed'||delivery.calendar==='conflict'?'Google Calendar needs attention.':'Google Calendar update queued.';
 const email=(state:string,who:string)=>state==='accepted'?`${who} email sent.`:['unknown','needs_reconciliation'].includes(state)?`${who} email delivery is uncertain; check Activity before retrying.`:['failed','not_queued','suppressed'].includes(state)?`${who} email needs attention.`:`${who} email queued.`;
 return ['Appointment booked.',calendar,email(delivery.customerEmail,'Customer'),email(delivery.ownerEmail,'Owner')].join(' ');
}
