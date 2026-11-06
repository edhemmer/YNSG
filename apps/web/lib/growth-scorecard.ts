import {localMinute} from '../../../packages/domain/timezone.ts';
import {leadSourceOptions} from '../../../packages/contracts/index.ts';

// Growth Playbook gates. Targets, not limits: nothing here blocks requests or bookings.
export const scorecardTargets=Object.freeze({launchJobs:10,launchReviews:5,buildWeeklyHours:40,buildWeeks:4,reviewGoal:50});

export type BookedVisit={start_at:string;end_at:string};
export type WeekHours={week:string;hours:number};
export type SourceCount={source:string;count:number};
export type Gate={key:'launch'|'build'|'hire';title:string;target:string;progress:string;met:boolean};
export type Scorecard={phase:'Launch'|'Build'|'First hire';gates:Gate[];nextStep:string};

const dayMs=86400000;
const isoDay=(ms:number)=>new Date(ms).toISOString().slice(0,10);
// Monday of the local calendar week that contains this instant, as YYYY-MM-DD.
export function localWeekStart(instant:number,timezone:string){
 const day=localMinute(instant,timezone).slice(0,10),ms=Date.parse(day+'T00:00:00Z'),weekday=(new Date(ms).getUTCDay()+6)%7;
 return isoDay(ms-weekday*dayMs);
}

// Booked hours per local week for the last `weeks` weeks, oldest first, current week last.
export function weeklyBookedHours(visits:BookedVisit[],now:number,timezone:string,weeks=8):WeekHours[]{
 if(!Number.isInteger(weeks)||weeks<1||weeks>26)throw Error('VALIDATION');
 const current=Date.parse(localWeekStart(now,timezone)+'T00:00:00Z');
 const keys=Array.from({length:weeks},(_,i)=>isoDay(current-(weeks-1-i)*7*dayMs)),totals=new Map(keys.map(k=>[k,0]));
 for(const v of visits){
  const start=Date.parse(v.start_at),end=Date.parse(v.end_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>16*3600000)continue;
  const key=localWeekStart(start,timezone);
  if(totals.has(key))totals.set(key,totals.get(key)!+(end-start)/3600000);
 }
 return keys.map(week=>({week,hours:Math.round(totals.get(week)!*10)/10}));
}

// Requests by the optional "How did you hear about us?" answer; unknown or missing values count as "Not given".
export function leadSourceCounts(values:(string|null|undefined)[]):SourceCount[]{
 const known=new Set<string>(leadSourceOptions),counts=new Map<string,number>();
 for(const v of values){const key=typeof v==='string'&&known.has(v)?v:'Not given';counts.set(key,(counts.get(key)||0)+1);}
 return [...counts].map(([source,count])=>({source,count})).sort((a,b)=>b.count-a.count||a.source.localeCompare(b.source));
}

export function growthScorecard({completedJobs,reviews,weeks}:{completedJobs:number;reviews:number|null;weeks:WeekHours[]}):Scorecard{
 if(!Number.isSafeInteger(completedJobs)||completedJobs<0||(reviews!==null&&(!Number.isSafeInteger(reviews)||reviews<0)))throw Error('VALIDATION');
 const t=scorecardTargets,reviewCount=reviews??0;
 // The current week is still filling up, so the build gate looks at the last complete weeks only.
 const complete=weeks.slice(0,-1).slice(-t.buildWeeks),fullWeeks=complete.filter(w=>w.hours>=t.buildWeeklyHours).length;
 const launch:Gate={key:'launch',title:'Launch → Build',target:`${t.launchJobs} completed jobs and ${t.launchReviews} Google reviews`,progress:`${completedJobs} of ${t.launchJobs} jobs · ${reviews===null?'reviews not entered':`${reviewCount} of ${t.launchReviews} reviews`}`,met:completedJobs>=t.launchJobs&&reviewCount>=t.launchReviews};
 const build:Gate={key:'build',title:'Build → First hire',target:`${t.buildWeeklyHours}+ booked hours a week for ${t.buildWeeks} straight weeks`,progress:`${fullWeeks} of the last ${t.buildWeeks} complete weeks at ${t.buildWeeklyHours}+ hours`,met:complete.length===t.buildWeeks&&fullWeeks===t.buildWeeks};
 const hire:Gate={key:'hire',title:'First hire → Crew',target:'Your helper is reliable for 6 straight weeks',progress:'Your call: on time, no complaints, customers happy',met:false};
 const phase=!launch.met?'Launch':!build.met?'Build':'First hire';
 const nextStep=phase==='Launch'?'Land paying jobs and ask every happy customer for a Google review.':phase==='Build'?'Fill your calendar and write a checklist for each job type before hiring.':'Start a part-time helper with payroll and workers’ comp in place.';
 return {phase,gates:[launch,build,hire],nextStep};
}
