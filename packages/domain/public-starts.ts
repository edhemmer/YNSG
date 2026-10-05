import type {CompanySettings} from '../contracts/index.ts';
import {addDays} from '../../lib/appointment-window.js';

// Candidate starts are not reservations. Canonical feasibility still checks
// current provider facts, lead time, travel buffers, blocks and conflicts.
export function publicStartMinutes(day:string,rules:Pick<CompanySettings['scheduling'],'weekdays'|'earliestStart'|'latestStart'|'endOfDay'>):number[]{
 addDays(day,0);
 const weekday=new Date(day+'T12:00:00Z').getUTCDay()||7;
 if(!rules.weekdays.includes(weekday))return [];
 const last=Math.min(rules.latestStart,rules.endOfDay-120),minutes=[];
 for(let minute=Math.ceil(rules.earliestStart/30)*30;minute<=last;minute+=30)minutes.push(minute);
 return minutes;
}
