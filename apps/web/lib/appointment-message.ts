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
export function appointmentMessage(v: AppointmentMessageInput) {
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
      body: `A proposed appointment needs your review.\n\n${v.request.name}\n${address}\nPhone: ${v.request.phone}\nEmail: ${v.request.email}\nArrival: ${when}\n\n${services}\n\nReview the current request, pickup details, duration and expiry before deciding:\n${v.ownerUrl}`,
    };
  if (v.kind === "appointment.reschedule_requested")
    return {
      to: v.notificationRecipient,
      subject: "Customer requested another appointment time",
      body: `${v.request.name} requested another time.\n\n${work}\n\nPreferred time: ${v.preference?.preferred_local_start?.replace("T", " at ") || "See the customer’s message"} (${v.timezone})\n${v.preference?.note || ""}\n\nThe current confirmed appointment remains booked until a replacement is approved. A declined proposal has no reserved slot.\nReview the same request:\n${v.ownerUrl}`,
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
      body: `Hi ${v.request.name || "there"},\n\n${reminder ? "A reminder of your appointment with" : "Your appointment is confirmed with"} ${v.company}.\n\nArrival: ${when}\n${work}\n\nPlease let us know you plan to be there:\n${v.confirmUrl}\n\nNeed another time?\n${v.rescheduleUrl}\nYour current appointment stays booked until a replacement is approved.\n\nThese links open your appointment. Nothing changes until you choose an action on the page. They do not approve a quote or extra work.\n\n${reminder ? "Please email "+v.notificationRecipient+" immediately if you need to reschedule." : "Reply to this email if you need to reach us."}`,
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
