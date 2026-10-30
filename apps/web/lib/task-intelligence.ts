import type {TaskTimeReport} from './task-time-contract.ts';
export type TaskInsight={id:string;title:string;detail:string;kind:'review'|'allocation'|'allowance'|'data';};
/** Free, deterministic evidence checks. Proposals only; never changes time, prices or invoices. */
export function taskInsights(report:TaskTimeReport):TaskInsight[]{
 const items:TaskInsight[]=[];
 if(report.more)return [{id:'partial',kind:'data',title:'Complete the report before making decisions',detail:'More than 500 job types match this month. Displayed task totals and comparisons are partial.'}];
 if(report.activeSessions)items.push({id:'running',kind:'review',title:`Check ${report.activeSessions} running timer${report.activeSessions===1?'':'s'}`,detail:'If work stopped, pause the task and review the actual end time. A running timer is not verified worked time.'});
 if(report.unreviewedSessions)items.push({id:'review',kind:'review',title:`Verify ${report.unreviewedSessions} stopped interval${report.unreviewedSessions===1?'':'s'}`,detail:'Use the review queue below. Unreviewed intervals stay outside measured hours and time-menu suggestions.'});
 if(report.unallocatedCents)items.push({id:'allocation',kind:'allocation',title:'Finish assigning issued labor',detail:`${(report.unallocatedCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})} of gross issued labor is unallocated. Assign it to the actual tasks before comparing job-type earnings. This is not unpaid cash.`});
 const comparisons=report.items.filter(i=>i.samples>=5&&i.plannedMinutes>0&&i.medianMinutes!==null).map(i=>({item:i,variance:(i.completedSeconds/60-i.plannedMinutes)/i.plannedMinutes})).filter(i=>Math.abs(i.variance)>=.2).sort((a,b)=>Math.abs(b.variance)-Math.abs(a.variance)||a.item.name.localeCompare(b.item.name));
 for(const {item:i,variance} of comparisons.slice(0,3))items.push({id:i.service+':'+i.name,kind:'allowance',title:i.name+': '+(variance>0?'allow more time':'review the time allowance'),detail:`${i.samples} fully reviewed completed tasks took ${Math.round(Math.abs(variance)*100)}% ${variance>0?'longer':'less time'} than their combined plan. Median: ${Math.ceil(i.medianMinutes!/5)*5} minutes per task, rounded up. Compare job size, quantity and access before adopting an allowance; the agreed price is unchanged.`});
 const learning=report.items.filter(i=>i.samples>0&&i.samples<5).length;
 if(learning)items.push({id:'learning',kind:'data',title:'Keep building your time menu',detail:`${learning} job type${learning===1?' has':'s have'} fewer than five reviewed completed samples this month. Suggestions stay withheld while evidence is limited.`});
 return items;
}
