export const BUSINESS_TIMEZONE:string;
export function localDay(now?:number,timezone?:string):string;
export function addDays(day:string,days:number):string;
export function yearEnd(day:string):string;
export function weeklyDates(first:string):{end:string;dates:string[]};
export function appointmentSelection(input:unknown,now?:number):{mode:string;start:string|null;preferredTime:string;weekday?:string;localTime?:string;firstDate?:string;endExclusive?:string|null};
