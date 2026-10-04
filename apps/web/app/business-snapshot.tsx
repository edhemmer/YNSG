'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {chartPercent,type BusinessSnapshot} from '../lib/business-snapshot';
import {localMinute} from '../../../packages/domain/timezone';
const usd=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function Snapshot({organization,timezone,onOpen,revision}:{organization:string;timezone:string;onOpen:(section:string)=>void;revision:number}){
 const today=localMinute(Date.now(),timezone).slice(0,10);
 const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today),[reload,setReload]=useState(0),[data,setData]=useState<BusinessSnapshot|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const controller=new AbortController();setData(null);setError('');
  void sessionFetch('/api/business-snapshot?'+new URLSearchParams({organization,from,to}),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setData(d);}).catch(e=>{if(active&&!controller.signal.aborted)setError(publicError(e));});
  return()=>{active=false;controller.abort();};
 },[organization,from,to,reload,revision]);
 const cash=data?[['Payments received',data.finance.cashReceivedCents],['Expenses paid',data.finance.expenseCents],['Invoices issued',data.finance.issuedInvoicesCents]] as [string,number][]:[];
 const work=data?[['Working',data.counts.working],['Paused',data.counts.paused],['Completed — all time',data.counts.completed]] as [string,number][]:[];
 const bars=(items:[string,number][],money=false)=>{const max=Math.max(0,...items.map(x=>x[1]));return <dl className="snapshot-bars">{items.map(([label,value],index)=><div key={label}><dt>{label}</dt><dd>{money?usd(value):value.toLocaleString()}<span aria-hidden="true" className="snapshot-bar-track"><i className={'snapshot-bar tone-'+index} style={{width:chartPercent(value,max)+'%'}}/></span></dd></div>)}</dl>};
 return <section aria-label="Business snapshot"><p className="eyebrow">Your business at a glance</p><p>Money and new requests use the dates below. Your work, upcoming visits and messages show the current position.</p>
 <div className="actions snapshot-controls"><label>From<input type="date" required value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>Through<input type="date" required value={to} min={from} onChange={e=>setTo(e.target.value)}/></label><button type="button" className="secondary" onClick={()=>{setFrom(today.slice(0,7)+'-01');setTo(today);}}>This month</button><button type="button" onClick={()=>setReload(n=>n+1)}>Refresh snapshot</button><button type="button" className="secondary" onClick={()=>window.print()}>Print snapshot</button></div>
 {error&&<p role="alert">{error} Press Refresh snapshot to try again.</p>}{!data&&!error&&<p role="status">Gathering your business totals…</p>}
 {data&&<><p className="tiny">{data.from} through {data.to} · {data.timezone} · Updated {new Date(data.checkedAt).toLocaleTimeString('en-US',{timeZone:data.timezone,timeStyle:'short'})}</p>
 <div className="snapshot-grid">{[
 ['Payments received',usd(data.finance.cashReceivedCents),'Confirmed payments within these dates.','Money'],
 ['Expenses paid',usd(data.finance.expenseCents),'Recorded expenses, excluding corrected entries.','Money'],
 ['Cash after expenses',usd(data.finance.cashAfterExpensesCents),'Payments less expenses; excludes taxes and owner draws.','Money'],
 ['Unpaid invoice balance',usd(data.finance.outstandingAsOfEndCents),'Invoices issued and payments received through the end date.','Money'],
 ['New requests',String(data.counts.requestsInPeriod),'Requests received within these dates.','Work'],
 ['Customers',String(data.counts.customers),'Customer records in your business.','Customers'],
 ['Upcoming visits',String(data.counts.upcomingVisits),'Confirmed visits that have not ended.','Calendar'],
 ['Requests to review',String(data.counts.requestsToReview),'New requests and requests under review.','Work'],
 ].map(([label,value,note,section])=><article className="card snapshot-tile" key={label}><h2>{label}</h2><strong>{value}</strong><p>{note}</p><button className="secondary" type="button" onClick={()=>onOpen(section)}>Open {section.toLowerCase()}</button></article>)}</div>
 <div className="snapshot-chart-grid"><section className="card"><h2>Money within these dates</h2>{bars(cash,true)}<p className="tiny">Invoices issued are billed amounts, not payments received. {data.finance.paymentCount} payment entries · {data.finance.expenseCount} expense entries.</p></section><section className="card"><h2>Work status</h2>{bars(work)}<p className="tiny">Current working and paused jobs, plus all completed jobs.</p></section></div>
 <section className="card"><h2>Needs your attention</h2><div className="snapshot-attention"><button onClick={()=>onOpen('Work')}>{data.counts.proposals} appointment proposals</button><button onClick={()=>onOpen('Calendar')}>{data.counts.rescheduleRequests} rescheduling requests</button><button onClick={()=>onOpen('Work')}>{data.counts.quotes} published quotes</button><button onClick={()=>onOpen('Today')}>{data.counts.messagesToCheck} messages to check</button></div><p>Email notifications: {data.email.enabled&&data.email.automaticSending?'Enabled; delivery still depends on the sending schedule.':'Setup or activation needed.'}</p><p className="tiny">These totals cover all authorized records, not just the current list page. Refresh after making changes. Financial totals are records, not a tax estimate.</p></section></>}
 </section>;
}
