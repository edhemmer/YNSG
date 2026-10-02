import { companySettings, DomainError, type CompanySettings } from '../contracts/index.ts';
import { feasible, type Interval } from './scheduling.ts';

type Resource = { id: string; kind: string; status: string };
export type AvailabilityInput = {
  clock: number; timezone: string; durationMinutes: number;
  rules: CompanySettings['scheduling']; resources: readonly Resource[]; selectedResources: readonly string[];
  reservations: readonly (Interval & { resourceId: string })[];
  blocks: readonly Interval[]; externalBusy: readonly Interval[]; externalBusyVerifiedUntil: number;
  windowEnd: number;
};
// This is a capacity/calendar screen, not travel evidence or a reservation.
// Iterate UTC instants, then validate local hours: DST never shifts a requested local time.
export function openTimesToReview(input: AvailabilityInput): { start: number; end: number }[] {
  const { clock, rules } = input;
  if (!companySettings.shape.scheduling.safeParse(rules).success ||
      !companySettings.shape.timezone.safeParse(input.timezone).success ||
      rules.earliestStart > rules.latestStart || rules.latestStart + 120 > rules.endOfDay)
    throw new DomainError('SETUP_REQUIRED', 'Review operating hours and scheduling settings');
  if (!Number.isSafeInteger(clock) || !Number.isSafeInteger(input.windowEnd) ||
      input.windowEnd <= clock || input.windowEnd > clock + 7 * 24 * 60 * 60_000 ||
      rules.bufferMinutes === null || !Number.isSafeInteger(input.durationMinutes) ||
      input.durationMinutes < 120 || input.durationMinutes > 1440 || input.durationMinutes % 30 !== 0 ||
      !Number.isSafeInteger(rules.leadMinutes) || !Number.isSafeInteger(rules.horizonMinutes) ||
      rules.leadMinutes < 0 || rules.horizonMinutes <= rules.leadMinutes ||
      !Number.isSafeInteger(input.externalBusyVerifiedUntil) || input.externalBusyVerifiedUntil <= clock)
    throw new DomainError('SETUP_REQUIRED', 'Current calendar facts and a complete scheduling policy are required');
  const selected = new Set(input.selectedResources);
  if (!selected.size || selected.size !== input.selectedResources.length ||
      [...selected].some(id => !input.resources.some(r => r.id === id && r.status === 'available')) ||
      !input.resources.some(r => selected.has(r.id) && r.kind === 'operator'))
    throw new DomainError('VALIDATION', 'Select an available operator and every required resource');
  const intervals = [...input.blocks, ...input.externalBusy,
    ...input.reservations.filter(r => selected.has(r.resourceId))];
  if (intervals.some(i => !Number.isSafeInteger(i.start) || !Number.isSafeInteger(i.end) || i.end <= i.start))
    throw new DomainError('PROVIDER_UNAVAILABLE', 'Calendar intervals are invalid');
  const buffer = rules.bufferMinutes * 60_000;
  const busy = intervals.map(i => ({ start: i.start - buffer, end: i.end + buffer }));
  const earliest = clock + rules.leadMinutes * 60_000;
  const latest = Math.min(clock + rules.horizonMinutes * 60_000, input.windowEnd);
  const result: { start: number; end: number }[] = [];
  // Minute iteration also supports IANA timezones whose UTC offset is not a multiple of 30 minutes.
  for (let start = Math.ceil(earliest / 60_000) * 60_000; start <= latest; start += 60_000) {
    try {
      result.push(feasible({ start, clock, durationMinutes: input.durationMinutes,
        timezone: input.timezone, rules, busy,
        externalBusyVerifiedUntil: input.externalBusyVerifiedUntil }));
    } catch (error) {
      if (!(error instanceof DomainError) || !['CAPACITY_CONFLICT','VALIDATION'].includes(error.code)) throw error;
    }
  }
  return result;
}
