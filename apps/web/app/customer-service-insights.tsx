'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {serviceHistory,type ServiceHistory} from '../lib/customer-service-history-contract';
export default function CustomerServiceInsights({organization,customer,timezone,onCustomer}:{organization:string;customer?:string;timezone:string;onCustomer?:(id:string)=>void}){
 const [query,setQuery]=useState(''),[entry,setEntry]=useState(''),[page,setPage]=useState(0),[retry,setRetry]=useState(0);
 const scope=JSON.stringify([organization,customer||'',query,page]);
 const [stored,setStored]=useState<{scope:string;data:ServiceHistory|null;error:string}|null>(null);
 const current=stored?.scope===scope?stored:null,data=current?.data;
 useEffect(()=>{const controller=new AbortController();let live=true;setStored(null);
  void sessionFetch('/api/customer-service-history?'+new URLSearchParams({organization,...(customer?{customer}:{}),query,page:String(page)}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(typeof value.error==='string'?value.error:'Service history could not load.');const parsed=serviceHistory.parse(value);if(live)setStored({scope,data:parsed,error:''});}).catch(e=>{if(live&&!controller.signal.aborted)setStored({scope,data:null,error:e instanceof Error&&['Owner access is required.','Sign in to continue.','This customer is no longer available.'].includes(e.message)?e.message:'Service history could not be verified. Please retry.'});});
  return()=>{live=false;controller.abort();};
 },[organization,customer,query,page,retry,scope]);
 const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium'}).format(new Date(value)):'No requests yet';
 return <section className="card customer-service-insights" aria-label="Customer service insights"><h3>{customer?'Requested service history':'Customer service insights'}</h3>{data&&<button className="secondary" onClick={()=>setRetry(v=>v+1)}>Refresh service history</button>}
 {!customer&&<><p>Find customers by name or a service they requested. Use saved interests and repeat-request history to plan relevant follow-ups.</p><form className="customer-search" onSubmit={e=>{e.preventDefault();setPage(0);setQuery(entry.trim());}}><label>Customer or requested service<input type="search" maxLength={100} value={entry} onChange={e=>setEntry(e.target.value)} placeholder="Customer name, mowing, leaf management…"/></label><button>Search history</button></form></>}
 {current?.error?<div role="alert"><p>{current.error}</p><button className="secondary" onClick={()=>setRetry(v=>v+1)}>Retry service history</button></div>:!data?<p role="status">Loading saved service history…</p>:<>
 {!customer&&<><p>{data.matchingCustomers} matching {data.matchingCustomers===1?'customer':'customers'}. Company totals: {data.linkedRequests} linked customer requests · {data.generatedVisits} generated recurring visits</p>{data.unlinkedRequests>0&&<p className="note">{data.unlinkedRequests} guest requests await customer linking. Choose the correct customer during request review to include them in individual customer totals.</p>}</>}
 {data.items.map(item=><article className="customer-item" key={item.customerId}>{!customer&&<h4>{item.name}{item.archived?' · Archived':''}</h4>}<p><strong>{item.requestCount} customer {item.requestCount===1?'request':'requests'}</strong> · {item.generatedVisits} generated recurring visits</p><p>First: {date(item.firstRequestedAt)} · Latest: {date(item.lastRequestedAt)}</p>
 {item.categories.length>0&&<ul className="service-history-list" aria-label="Service request counts">{item.categories.map(c=><li key={c.service}><strong>{c.service}</strong><span>{c.requestCount} {c.requestCount===1?'request':'requests'}</span></li>)}</ul>}
 {item.services.length>0?<details open={Boolean(customer)}><summary>Job details ({item.services.length}{item.servicesMore?'+':''})</summary><ul className="service-history-list">{item.services.map(s=><li key={JSON.stringify([s.service,s.task])}><div><strong>{s.task}</strong><span>{s.service}</span></div><div><strong>{s.requestCount} {s.requestCount===1?'request':'requests'}</strong><span>Latest {date(s.lastRequestedAt)}</span></div></li>)}</ul>{item.servicesMore&&<p>Showing the 200 most frequently requested service/task combinations. Original requests retain the full history.</p>}</details>:<p>No linked service choices have been recorded yet.</p>}
 {!customer&&onCustomer&&<button className="secondary" onClick={()=>onCustomer(item.customerId)}>Open customer record</button>}</article>)}
 {!data.items.length&&<p>No customers match this service history search.</p>}
 {!customer&&<div className="actions"><button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Previous history results</button><button className="secondary" disabled={!data.hasMore} onClick={()=>setPage(v=>v+1)}>More history results</button></div>}
 <p className="tiny">Each service is counted once per customer request, including declined or canceled requests. Generated recurring visits are separate. Service history does not record campaign permission; verify marketing preferences before email campaigns.</p>
 </>}
 </section>;
}
