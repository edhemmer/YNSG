import {emailLayout,emailParagraph,emailButton} from '../../../lib/email-layout.js';
type Submission = {
  name?: string;
  phone?: string;
  email?: string;
  street?: string;
  city?: string;
  service?: string;
  task?: string;
  services?: { service: string; task?: string }[];
};
export type AppointmentMessageInput = {
  kind:
    | "appointment.owner_approval"
    | "appointment.confirmation"
    | "appointment.reminder"
    | "appointment.owner_reminder"
    | "appointment.declined_time"
    | "appointment.declined_service"
    | "appointment.reschedule_requested";
  company: string;
  recipient: string;
  notificationRecipient: string;
  request: Submission;
  arrivalAt: string;
  timezone: string;
  manageUrl?: string;
  confirmUrl?: string;
  rescheduleUrl?: string;
  ownerUrl: string;
  reason?: string;
  preference?: { preferred_local_start: string | null; note: string };
};
function appointmentText(v: AppointmentMessageInput) {
  const when = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: v.timezone,
  }).format(new Date(v.arrivalAt));
  const services = v.request.services?.length
    ? v.request.services
        .map((s) => s.service + (s.task ? ": " + s.task : ""))
        .join("\n")
    : (v.request.service || "Work details require review") + (v.request.task ? ": " + v.request.task : "");
  const address = [v.request.street, v.request.city].filter(Boolean).join(", ");
  const work = "Requested work:\n" + services + "\n\nAddress: " + address;
  const ownerSubject = v.company + " New Request";
  if (v.kind === "appointment.owner_approval")
    return {
      to: v.notificationRecipient,
      subject: ownerSubject,
      body: `A proposed appointment needs your review.\n\n${v.request.name || "Customer"}\n${address}\nPhone: ${v.request.phone || "See service request"}\nEmail: ${v.request.email || "See service request"}\nArrival: ${when}\n\n${services}\n\nReview the work, any material pickups and the time needed before approving:\n${v.ownerUrl}`,
    };
  if (v.kind === "appointment.owner_reminder")
    return {
      to: v.notificationRecipient,
      subject: "Tomorrow’s service appointment",
      body: `Your upcoming appointment with ${v.request.name || "the customer"} is confirmed.\n\nArrival: ${when} (${v.timezone})\n${work}\nPhone: ${v.request.phone || "See service order"}\nEmail: ${v.request.email || "See service order"}\n\nReview the current order, pickup details and equipment before loading:\n${v.ownerUrl}\n\nCheck the current calendar before heading out; this appointment may change.`,
    };
  if (v.kind === "appointment.reschedule_requested")
    return {
      to: v.notificationRecipient,
      subject: "Customer requested another appointment time",
      body: `${v.request.name || "The customer"} requested another time.\n\n${work}\n\nPreferred time: ${v.preference?.preferred_local_start?.replace("T", " at ") || "See the customer’s message"} (${v.timezone})\n${v.preference?.note || ""}\n\nIf there is already a confirmed appointment, it stays booked until you approve a replacement. A declined time is no longer reserved.\nReview the same request:\n${v.ownerUrl}`,
    };
  if (!v.manageUrl) throw Error("CUSTOMER_LINK_REQUIRED");
  if (
    v.kind === "appointment.confirmation" ||
    v.kind === "appointment.reminder"
  ) {
    if (!v.confirmUrl || !v.rescheduleUrl)
      throw Error("CUSTOMER_ACTIONS_REQUIRED");
    const reminder = v.kind === "appointment.reminder";
    return {
      to: v.recipient,
      subject: reminder
        ? "Reminder: your service appointment"
        : "Your appointment is confirmed",
      body: `Hi ${v.request.name || "there"},\n\n${reminder ? "A reminder of your appointment with" : "Your appointment is confirmed with"} ${v.company}.\n\nArrival: ${when}\n${work}\n\nPlease let us know you plan to be there:\n${v.confirmUrl}\n\nNeed another time?\n${v.rescheduleUrl}\nYour current appointment stays booked until a replacement is approved.\n\nThese links open your appointment. Nothing changes until you choose an action on the page. Confirming attendance does not approve a quote or extra work.\n\n${reminder ? "Please email "+v.notificationRecipient+" immediately if you need to reschedule." : "Reply to this email if you need to reach us."}`,
    };
  }
  const declinedTime = v.kind === "appointment.declined_time";
  return {
    to: v.recipient,
    subject: declinedTime
      ? "Please choose another appointment time"
      : "Update on your service request",
    body: `Hi ${v.request.name || "there"},\n\n${declinedTime ? "We couldn’t confirm the requested time. Your service request and work details are still saved." : "We can’t accept the proposed service appointment."}${v.reason ? "\n" + v.reason : ""}\n\n${work}\n\n${declinedTime ? "Choose another time on the same request:" : "Review this appointment update:"}\n${v.manageUrl}\n\n${declinedTime ? "A new time needs review and approval before it is booked.\n\n" : ""}Reply to this email with any questions.`,
  };
}

export function appointmentMessage(v: AppointmentMessageInput) {
 const message=appointmentText(v);
 const titles:Record<AppointmentMessageInput['kind'],string>={
  'appointment.owner_approval':'Appointment to review',
  'appointment.owner_reminder':'Your upcoming visit',
  'appointment.reschedule_requested':'A new time requested',
  'appointment.confirmation':'Your appointment is confirmed',
  'appointment.reminder':'Your appointment reminder',
  'appointment.declined_time':'Let’s find another time',
  'appointment.declined_service':'An update on your request',
 };
 const owner=['appointment.owner_approval','appointment.owner_reminder','appointment.reschedule_requested'].includes(v.kind);
 const actions=new Map<string,string>();
 if(owner)actions.set(v.ownerUrl,'Open service request');
 else {
  if(v.confirmUrl)actions.set(v.confirmUrl,'Confirm attendance');
  if(v.rescheduleUrl)actions.set(v.rescheduleUrl,'Request another time');
  if(v.manageUrl&&!actions.has(v.manageUrl))actions.set(v.manageUrl,v.kind==='appointment.declined_time'?'Choose another time':'View appointment update');
 }
 const content=message.body.split('\n\n').map(block=>{
  const parts:string[]=[];let lines:string[]=[];
  const flush=()=>{if(lines.length){parts.push(emailParagraph(lines.join('\n')));lines=[];}};
  for(const line of block.split('\n')){
   const label=actions.get(line);
   if(label){flush();parts.push(emailButton(label,line,label==='Request another time'));}
   else lines.push(line);
  }
  flush();
  return parts.join('');
 }).join('');
 return {...message,html:emailLayout(v.company,titles[v.kind],message.subject,content)};
}
