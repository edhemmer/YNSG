export type BackgroundHealth={checkedAt:string;workers:{kind:'mail'|'calendar';lastRequestedAt:string|null;lastSuccessfulAt:string|null;lastOutcome:'success'|'failed'|null}[];queue:{needsReview:number;overdue:number;waiting:number;pausedMailWaiting?:number;pausedCalendarWaiting?:number}};
export function workerHealth(health:BackgroundHealth|null|undefined,kind:'mail'|'calendar',active:boolean,enabled:boolean,now=Date.now()):'Running'|'Paused'|'Needs attention'{
 if(!active||!enabled)return 'Paused';
 if(!health)return 'Needs attention';
 const checked=Date.parse(health.checkedAt),worker=health.workers.find(w=>w.kind===kind);
 const recent=(time:string|null|undefined)=>{const parsed=Date.parse(time??'');return Number.isFinite(parsed)&&parsed<=now+30000&&now-parsed<=180000;};
 if(!recent(health.checkedAt)||!Number.isFinite(checked)||!worker||worker.lastOutcome!=='success'||!recent(worker.lastRequestedAt)||!recent(worker.lastSuccessfulAt))return 'Needs attention';
 return 'Running';
}
export type QueueCounts={needsReview:number;overdue:number;waiting:number};
export function visibleBackgroundQueue(mail:QueueCounts,calendar:QueueCounts,enabled:{mail:boolean;calendar:boolean}){
 for(const counts of [mail,calendar])for(const value of Object.values(counts))if(!Number.isSafeInteger(value)||value<0)throw Error('QUEUE_COUNTS_UNAVAILABLE');
 return {needsReview:mail.needsReview+calendar.needsReview,overdue:(enabled.mail?mail.overdue:0)+(enabled.calendar?calendar.overdue:0),waiting:(enabled.mail?mail.waiting:0)+(enabled.calendar?calendar.waiting:0),pausedMailWaiting:enabled.mail?0:mail.waiting,pausedCalendarWaiting:enabled.calendar?0:calendar.waiting};
}
