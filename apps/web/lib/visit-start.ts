import { publicStartMinutes } from '../../../packages/domain/public-starts.ts';
import type { CompanySettings } from '../../../packages/contracts/index.ts';

export type VisitHours = Pick<CompanySettings['scheduling'], 'weekdays' | 'earliestStart' | 'latestStart' | 'endOfDay'>;
export const visitDateError = 'Choose a valid visit date and an available start time.';
export function visitTimes(date: string, hours: VisitHours): string[] {
  try {
    return publicStartMinutes(date, hours).map(minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  } catch { return []; }
}
export function visitStart(date: FormDataEntryValue | null, time: FormDataEntryValue | null, hours: VisitHours): string {
  if (typeof date !== 'string' || typeof time !== 'string' || !visitTimes(date, hours).includes(time)) throw Error(visitDateError);
  return `${date}T${time}`;
}
export function preferredVisitStart(value = ''): {date: string; time: string} {
  const once = value.match(/^(\d{4}-\d{2}-\d{2})(?: at |T)(\d{2}:\d{2})/);
  const weekly = value.match(/^Weekly \w+ (\d{2}:\d{2}); (\d{4}-\d{2}-\d{2}) /);
  return {date: once?.[1] || weekly?.[2] || '', time: once?.[2] || weekly?.[1] || ''};
}
