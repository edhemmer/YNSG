export type BackgroundHealth={checkedAt:string;workers:{kind:'mail'|'calendar';lastRequestedAt:string|null;lastSuccessfulAt:string|null;lastOutcome:'success'|'failed'|null}[];queue:{needsReview:number;overdue:number;waiting:number}};
export function workerHealth(health:BackgroundHealth|null|undefined,kind:'mail'|'calendar',active:boolean,enabled:boolean,now=Date.now()):'Running'|'Paused'|'Needs attention'{
 if(!active||!enabled)return 'Paused';
 if(!health)return 'Needs attention';
 const checked=Date.parse(health.checkedAt),worker=health.workers.find(w=>w.kind===kind);
 const recent=(time:string|null|undefined)=>{const parsed=Date.parse(time??'');return Number.isFinite(parsed)&&parsed<=now+30000&&now-parsed<=180000;};
 if(!recent(health.checkedAt)||!Number.isFinite(checked)||!worker||worker.lastOutcome!=='success'||!recent(worker.lastRequestedAt)||!recent(worker.lastSuccessfulAt))return 'Needs attention';
 return 'Running';
}
