'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {chartPercent} from '../lib/business-snapshot';
import {growthScorecard,scorecardTargets,type WeekHours,type SourceCount} from '../lib/growth-scorecard';

type Payload={checkedAt:string;completedJobs:number;weeks:WeekHours[];sources:SourceCount[];sourceWindowDays:number;month:{collectedCents:number;bookedHours:number};truncated:boolean};
const usd=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const weekLabel=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const reviewKey=(org:string)=>'ynsg:google-reviews:'+org;
function readReviews(org:string):number|null{try{const v=window.localStorage.getItem(reviewKey(org));const n=v===null?NaN:Number(v);return Number.isSafeInteger(n)&&n>=0?n:null;}catch{return null;}}
function saveReviews(org:string,n:number|null){try{if(n===null)window.localStorage.removeItem(reviewKey(org));else window.localStorage.setItem(reviewKey(org),String(n));}catch{}}

export default function GrowthScorecard({organization,revision}:{organization:string;revision:number}){
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[reviews,setReviews]=useState<number|null>(null);
 useEffect(()=>{setReviews(readReviews(organization));},[organization]);
 useEffect(()=>{let active=true;const controller=new AbortController();setError('');
  void sessionFetch('/api/growth-scorecard?'+new URLSearchParams({organization}),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setData(d);}).catch(e=>{if(active&&!controller.signal.aborted)setError(publicError(e));});
  return()=>{active=false;controller.abort();};
 },[organization,revision]);
 if(error)return <section className="card growth-scorecard" aria-label="Growth scorecard"><p role="alert">{error}</p></section>;
 if(!data)return <section className="card growth-scorecard" aria-label="Growth scorecard" aria-busy="true"><p>Loading your growth scorecard…</p></section>;
 const card=growthScorecard({completedJobs:data.completedJobs,reviews,weeks:data.weeks});
 const maxHours=Math.max(scorecardTargets.buildWeeklyHours,...data.weeks.map(w=>w.hours)),maxSource=Math.max(0,...data.sources.map(s=>s.count));
 const perHour=data.month.bookedHours>0?Math.round(data.month.collectedCents/data.month.bookedHours):null;
 return <section className="card growth-scorecard" aria-label="Growth scorecard">
  <p className="eyebrow">Growth scorecard</p>
  <h2>Phase: {card.phase}</h2>
  <p>{card.nextStep}</p>
  <ol className="scorecard-gates">{card.gates.map(g=><li key={g.key} className={g.met?'is-met':''}><strong>{g.met?'✓ ':''}{g.title}</strong><span>{g.target}</span><span className="scorecard-progress">{g.progress}</span></li>)}</ol>
  <div className="scorecard-reviews"><label>Google reviews right now<input type="number" inputMode="numeric" min="0" step="1" value={reviews??''} placeholder="Enter count" onChange={e=>{const v=e.target.value.trim();const n=v===''?null:Number(v);const next=n!==null&&Number.isSafeInteger(n)&&n>=0?n:null;setReviews(next);saveReviews(organization,next);}}/></label><span>Goal: {scorecardTargets.reviewGoal} by spring. Check your Google Business Profile and update this number; it’s saved on this device.</span></div>
  <h3>Booked hours by week</h3>
  <dl className="snapshot-bars" aria-label={`Booked visit hours per week; the hiring gate is ${scorecardTargets.buildWeeklyHours} hours`}>{data.weeks.map((w,i)=><div key={w.week}><dt>{i===data.weeks.length-1?'This week':'Week of '+weekLabel(w.week)}</dt><dd>{w.hours.toLocaleString()} hrs<span aria-hidden="true" className="snapshot-bar-track"><i className={'snapshot-bar '+(w.hours>=scorecardTargets.buildWeeklyHours?'tone-0':'tone-1')} style={{width:chartPercent(w.hours,maxHours)+'%'}}/></span></dd></div>)}</dl>
  <p className="scorecard-note">Hiring gate: {scorecardTargets.buildWeeklyHours}+ booked hours for {scorecardTargets.buildWeeks} straight complete weeks. Booked hours count confirmed visits only, not drive or office time.</p>
  <h3>This month</h3>
  <dl className="growth-results"><div><dt>Payments received</dt><dd>{usd(data.month.collectedCents)}</dd></div><div><dt>Booked visit hours</dt><dd>{data.month.bookedHours.toLocaleString()}</dd></div><div><dt>Collected per booked hour</dt><dd>{perHour===null?'—':usd(perHour)}</dd></div></dl>
  <p className="scorecard-note">Your real hourly is lower once drive time is counted. Aim to keep this well above $55.</p>
  <h3>Where requests came from <span className="scorecard-note">(last {data.sourceWindowDays} days)</span></h3>
  {data.sources.length?<dl className="snapshot-bars" aria-label="Requests by how the customer found us">{data.sources.map((s,i)=><div key={s.source}><dt>{s.source}</dt><dd>{s.count.toLocaleString()}<span aria-hidden="true" className="snapshot-bar-track"><i className={'snapshot-bar tone-'+(i%3)} style={{width:chartPercent(s.count,maxSource)+'%'}}/></span></dd></div>)}</dl>:<p>No requests yet. Answers to “How did you hear about us?” will show here.</p>}
  {data.truncated&&<p className="scorecard-note">Showing the most recent records only.</p>}
 </section>;
}
