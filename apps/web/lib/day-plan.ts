export type DayCall = {
  id: string;
  requestId: string;
  startAt: string;
  arrivalAt: string;
  endAt: string;
  status: "reserved" | "needs_review";
  customerResponse: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  tasks: string[];
  workItems: { service: string; task: string }[];
  description: string;
};
export type DayPlan = {
  date: string;
  timezone: string;
  company: string;
  generatedAt: string;
  calls: DayCall[];
  packing: import("./packing-plan.js").PackingPlan;
  packingRules: import("./packing-plan.js").PackingRule[];
  packingRulesAvailable: boolean;
};
export function localDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (kind: string) => parts.find((p) => p.type === kind)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function daySearchBounds(date: string) {
  const start = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(start.getTime()) ||
    start.toISOString().slice(0, 10) !== date
  )
    throw Error("INVALID_DATE");
  return {
    from: new Date(start.getTime() - 86400000).toISOString(),
    to: new Date(start.getTime() + 2 * 86400000).toISOString(),
  };
}
export function navigationUrl(address: string): string | null {
  if (!address.trim()) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", address);
  url.searchParams.set("dir_action", "navigate");
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}
export function requestedTasks(request: {
  services?: { service: string; task?: string }[];
  service?: string;
  task?: string;
}): string[] {
  return request.services?.length
    ? request.services.map(
        (item) => `${item.service}${item.task ? ": " + item.task : ""}`,
      )
    : [
        request.service
          ? request.service + (request.task ? ": " + request.task : "")
          : "Work details need review",
      ];
}

export function shiftLocalDate(date: string, days: number): string {
  daySearchBounds(date);
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
