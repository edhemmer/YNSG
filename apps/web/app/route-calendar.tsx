'use client';
import {useEffect,useState} from 'react';
import {monthCells,shiftMonth} from '../lib/month-calendar';
import {localDate} from '../lib/day-plan';
import {sessionFetch} from '../lib/session-fetch';
export default function RouteCalendar({organization,date,timezone,onSelect,revision}:{organization:string;date:string;timezone:string;onSelect:(date:string)=>void;revision:number}){
 const [month,setMonth]=useState(date.slice(0,7)),[counts,setCounts]=useState<Record<string,number>|null>(null),[error,setError]=useState('');
 useEffect(()=>setMonth(date.slice(0,7)),[date]);
 useEffect(()=>{let live=true;const controller=new AbortController();setCounts(null);setError('');
 void sessionFetch('/api/calendar-month?'+new URLSearchParams({organization,month}),{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error();const counts:Record<string,number>={};for(const a of d.appointments)if(['reserved','needs_review'].includes(a.status)){const day=localDate(new Date(a.arrival_at),timezone);counts[day]=(counts[day]||0)+1;}if(live)setCounts(counts);}).catch(()=>{if(live&&!controller.signal.aborted)setError('Calendar visits could not load. Refresh to try again.');});return()=>{live=false;controller.abort();};
 },[organization,month,timezone,revision]);
 const cells=monthCells(month),title=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(month+'-01T12:00Z'));
 return <section className="route-month" aria-label="Choose a route day"><div className="route-month-heading"><button className="secondary" disabled={month<='2000-01'} aria-label="Previous month" onClick={()=>setMonth(shiftMonth(month,-1))}>←</button><h3>{title}</h3><button className="secondary" disabled={month>='2100-12'} aria-label="Next month" onClick={()=>setMonth(shiftMonth(month,1))}>→</button></div>{error&&<p role="alert">{error}</p>}<div className="route-month-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span className="tiny" key={d}>{d}</span>)}{cells.map((day,i)=>day?<button key={day} className={'route-date secondary'+(date===day?' is-selected':'')} aria-pressed={date===day} aria-label={day+(counts?', '+(counts[day]||0)+' visits':', loading visits')} onClick={()=>onSelect(day)}><strong>{Number(day.slice(-2))}</strong>{counts&&counts[day]>0&&<span>{counts[day]} <span className="route-visit-word">visits</span></span>}</button>:<span key={i}/>)}</div></section>;
}
