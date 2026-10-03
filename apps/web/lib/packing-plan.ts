import type { DayCall } from "./day-plan.js";
export type WorkItem = { service: string; task: string };
export type PackingItem = {
  name: string;
  quantity: number;
  unit: string;
  consumed: boolean;
};
export type PackingRule = WorkItem & { revision: number; items: PackingItem[] };
export type PackingLine = PackingItem & { callIds: string[] };
export type PackingGap = WorkItem & { callIds: string[] };
export type PackingPlan = {
  items: PackingLine[];
  unmapped: PackingGap[];
  warnings: string[];
  complete: boolean;
};
const normalized = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
export const workKey = (work: WorkItem) =>
  JSON.stringify([work.service, work.task]);
export function buildPackingPlan(
  calls: DayCall[],
  rules: PackingRule[],
): PackingPlan {
  const mapped = new Map(rules.map((rule) => [workKey(rule), rule]));
  const lines = new Map<string, PackingLine>(),
    gaps = new Map<string, PackingGap>(),
    warnings = new Set<string>(),
    conflicts = new Set<string>();
  let occupiedUntil = -Infinity;
  for (const call of calls
    .filter((c) => c.status === "reserved")
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))) {
    const start = Date.parse(call.startAt),
      end = Date.parse(call.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      warnings.add(
        "Appointment timing needs review before calculating reusable equipment.",
      );
      continue;
    }
    if (start < occupiedUntil)
      warnings.add(
        "Some confirmed visits overlap. Review equipment for each crew; reusable quantities assume sequential visits.",
      );
    occupiedUntil = Math.max(occupiedUntil, end);
  }
  for (const call of calls) {
    if (call.status !== "reserved") {
      warnings.add(
        `${call.name} needs scheduling review before packing or travel.`,
      );
      continue;
    }
    if (call.customerResponse === "reschedule_requested")
      warnings.add(
        `${call.name} requested another time. The appointment stays booked until a replacement is approved.`,
      );
    if (!call.workItems.length)
      warnings.add(`Work details for ${call.name} need review before packing.`);
    const seen = new Set<string>();
    for (const work of call.workItems) {
      const key = workKey(work);
      if (seen.has(key)) continue;
      seen.add(key);
      const rule = mapped.get(key);
      if (!rule) {
        const gap = gaps.get(key) || { ...work, callIds: [] };
        gap.callIds.push(call.id);
        gaps.set(key, gap);
        continue;
      }
      for (const item of rule.items) {
        const name = normalized(item.name);
        if (conflicts.has(name)) continue;
        const previous = lines.get(name);
        if (
          previous &&
          (normalized(previous.unit) !== normalized(item.unit) ||
            previous.consumed !== item.consumed)
        ) {
          warnings.add(
            `Review ${previous.name}: approved lists use different units or reusable/consumable settings. No combined quantity is shown.`,
          );
          conflicts.add(name);
          lines.delete(name);
          continue;
        }
        if (previous) {
          previous.quantity = item.consumed
            ? previous.quantity + item.quantity
            : Math.max(previous.quantity, item.quantity);
          if (!previous.callIds.includes(call.id))
            previous.callIds.push(call.id);
        } else lines.set(name, { ...item, callIds: [call.id] });
      }
    }
  }
  const items = [...lines.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return {
    items,
    unmapped: [...gaps.values()].sort((a, b) =>
      workKey(a).localeCompare(workKey(b)),
    ),
    warnings: [...warnings],
    complete: gaps.size === 0 && warnings.size === 0,
  };
}
