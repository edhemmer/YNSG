'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sessionFetch } from '../lib/session-fetch';
import { monthCells, shiftMonth, groupCalendarDays, serviceTone, activeCalendarVisit } from '../lib/month-calendar';
import { localMinute } from '../../../packages/domain/timezone';
type Customer={name:string;street:string;city:string;phone:string;service?:string;task?:string;services?:{service:string;task:string}[]};
type Visit={id:string;request_id:string|null;status:string;start_at:string;end_at:string;arrival_at:string;expires_at:string|null;customer:Customer|null};
type Block={id:string;startsAt:string;endsAt:string};
type Month={month:string;timezone:string;checkedAt:string;appointments:Visit[];blocks:Block[]};
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const status=(v:Visit)=>['held','proposal'].includes(v.status)&&v.expires_at&&Date.parse(v.expires_at)<=Date.now()?'Time hold expired':v.status==='reserved'?'Confirmed':v.status==='proposal'?'Awaiting approval':v.status==='held'?'Temporarily held':v.status==='needs_review'?'Needs review':v.status==='canceled'?'Canceled':v.status.replaceAll('_',' ');
const services=(v:Visit)=>v.customer?.services?.length?v.customer.services:[{service:v.customer?.service||'Other',task:v.customer?.task||'Service visit'}];
export default function MonthCalendar({organization,timezone,revision}:{organization:string;timezone:string;revision:number}) {
 const today=localMinute(Date.now(),timezone).slice(0,10);
 const [month,setMonth]=useState(today.slice(0,7)),[day,setDay]=useState(today),[data,setData]=useState<Month|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const sequence=useRef(0),detail=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const seq=++sequence.current;const controller=new AbortController();setBusy(true);setError('');setData(null);
  void (async()=>{
   try {
    const response=await sessionFetch('/api/calendar-month?'+new URLSearchParams({organization,month}),{cache:'no-store',signal:controller.signal});
    const value=await response.json();if(!response.ok)throw Error(value.error||'Calendar could not be loaded.');
    if(seq===sequence.current)setData(value);
   }catch(e){if(seq===sequence.current&&!controller.signal.aborted)setError((e as Error).message);}
   finally{if(seq===sequence.current)setBusy(false);}
  })();
  return()=>{controller.abort();sequence.current++;};
 },[organization,month,reload,revision]);
 const label=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
 const dayLabel=(date:string)=>new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const time=(date:string)=>new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeStyle:'short'}).format(new Date(date));
 const cells=useMemo(()=>monthCells(month),[month]);
 const visitDays=useMemo(()=>groupCalendarDays(data?.appointments||[],cells,v=>v.start_at,v=>v.end_at,timezone),[data,cells,timezone]);
 const blockedDays=useMemo(()=>groupCalendarDays(data?.blocks||[],cells,b=>b.startsAt,b=>b.endsAt,timezone),[data,cells,timezone]);
 const visits=(date:string)=>visitDays[date]||[];
 const blocks=(date:string)=>blockedDays[date]||[];
 function move(offset:number){const next=shiftMonth(month,offset);setMonth(next);setDay(next+'-01');}
 return <section className="card month-calendar" aria-labelledby="month-heading">
  <div className="month-toolbar"><div><p className="eyebrow">Your schedule</p><h2 id="month-heading" aria-live="polite">{label}</h2></div><div className="actions">
   <button type="button" className="secondary" disabled={month==='2000-01'} onClick={()=>move(-1)} aria-label="Previous month">← Previous</button>
   <button type="button" className="secondary" onClick={()=>{setMonth(today.slice(0,7));setDay(today);}}>Today</button>
   <button type="button" className="secondary" disabled={month==='2100-12'} onClick={()=>move(1)} aria-label="Next month">Next →</button>
   <button type="button" className="secondary" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh calendar</button>
  </div></div>
  <p>Press a day to see the visits and blocked time. Times use {timezone}. An empty day does not guarantee a booking is available.</p>
  <div className="calendar-key" aria-label="Service colors">{[['home','Home'],['lawn','Lawn'],['garden','Yard & garden'],['snow','Snow'],['wash','Pressure washing'],['other','Other / mixed']].map(([tone,text])=><span className={'calendar-tone-'+tone} key={tone}>{text}</span>)}</div>
  {busy&&<p role="status">Loading this month…</p>}{error&&<p role="alert">{error} Press Refresh calendar to try again.</p>}
  <table className="month-grid" aria-label={label} aria-busy={busy}><thead><tr>{weekdays.map(w=><th key={w} scope="col"><abbr title={w}>{w.slice(0,2)}</abbr></th>)}</tr></thead><tbody>
   {Array.from({length:cells.length/7},(_,week)=><tr key={week}>{cells.slice(week*7,week*7+7).map((date,i)=>{
    if(!date)return <td key={i} className="calendar-empty"/>;
    const entries=visits(date),blocked=blocks(date),active=entries.filter(v=>activeCalendarVisit(v,Date.now()));
    return <td key={date}><button type="button" className={'calendar-day'+(date===today?' is-today':'')+(date===day?' is-selected':'')} aria-pressed={date===day} aria-current={date===today?'date':undefined} aria-label={dayLabel(date)+(data?`, ${active.length} visit${active.length===1?'':'s'}${blocked.length?', blocked time':''}`:', schedule not loaded')} onClick={()=>{setDay(date);detail.current?.scrollIntoView({behavior:'instant',block:'nearest'});}}>
     <span className="calendar-day-number">{Number(date.slice(-2))}</span>
     {data&&<><span className="calendar-dots" aria-hidden="true">{active.slice(0,3).map(v=><i key={v.id} className={'calendar-tone-'+serviceTone(services(v).map(s=>s.service))}/>)}</span>{active.length>0&&<span className="calendar-count">{active.length} <span className="calendar-count-word">visit{active.length===1?'':'s'}</span></span>}{blocked.length>0&&<span className="calendar-block-label">Blocked</span>}</>}
    </button></td>;
   })}</tr>)}
  </tbody></table>
  <div ref={detail} className="calendar-day-detail" aria-live="polite"><h3>{dayLabel(day)}</h3>
   {!busy&&!error&&data&&!visits(day).length&&!blocks(day).length&&<p>No CRM appointments or blocked time recorded for this day.</p>}
   {visits(day).map(v=><article className={'calendar-visit calendar-tone-'+serviceTone(services(v).map(s=>s.service))} key={v.id}>
    <p><strong>{time(v.arrival_at||v.start_at)} · {v.customer?.name||'Service visit'}</strong><br/><span className="badge">{status(v)}</span></p>
    <p>{services(v).map(s=>s.service+': '+s.task).join(' · ')}</p>
    {v.customer&&<p>{v.customer.street}, {v.customer.city}</p>}
    <p>Reserved time: {time(v.start_at)} – {time(v.end_at)}</p>
    {v.request_id&&<a className="button" href={'/?request='+encodeURIComponent(v.request_id)}>Open service request</a>}
   </article>)}
   {blocks(day).map(b=><article className="calendar-visit calendar-blocked" key={b.id}><h4>Blocked time</h4><p>{new Date(b.startsAt).toLocaleString('en-US',{timeZone:timezone})} – {new Date(b.endsAt).toLocaleString('en-US',{timeZone:timezone})}</p><p>Customers see only that this time is unavailable.</p></article>)}
  </div>
  {data&&<p className="tiny">CRM schedule checked at {time(data.checkedAt)}. Google event changes need review; this view does not display your personal Google calendar.</p>}
 </section>;
}
