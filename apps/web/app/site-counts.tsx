'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {publicError} from '../lib/public-errors';
import {chartPercent} from '../lib/business-snapshot';
import type {SiteCounts as Counts} from '../lib/call-leads-contract';

type Payload=({installed:true}&Counts)|{installed:false};
const sourceLabel:Record<string,string>={direct:'Typed in or bookmarked',google:'Google',bing:'Bing',facebook:'Facebook or Instagram',nextdoor:'Nextdoor',other_search:'Other search engines',other_site:'Other websites',email:'Email'};
const pageLabel=(p:string)=>p==='/'?'Home page':p.replace(/^\//,'').replace(/-/g,' ');

// Anonymous website totals: visits, call taps and requests, by where people came from and which page.
export default function SiteCounts({organization,revision}:{organization:string;revision:number}){
 const [days,setDays]=useState(30),[data,setData]=useState<Payload|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const controller=new AbortController();setError('');
  void sessionFetch('/api/site-counts?'+new URLSearchParams({organization,days:String(days)}),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setData(d);}).catch(e=>{if(active&&!controller.signal.aborted)setError(publicError(e));});
  return()=>{active=false;controller.abort();};
 },[organization,revision,days]);
 if(error)return <section className="card site-counts" aria-label="Website visits"><p role="alert">{error}</p></section>;
 if(!data)return <section className="card site-counts" aria-label="Website visits" aria-busy="true"><p>Loading website visits…</p></section>;
 if(!data.installed)return <section className="card site-counts" aria-label="Website visits"><p className="eyebrow">Website visits</p><p>Visit counts turn on after the database update for site counts is applied.</p></section>;
 const t=data.totals,views=t.view||0,actions=(t.call_tap||0)+(t.request_sent||0)+(t.callback_sent||0),maxSource=Math.max(0,...data.sources.map(s=>s.views||0));
 return <section className="card site-counts" aria-label="Website visits">
  <p className="eyebrow">Website visits</p>
  <h2>{views.toLocaleString()} page views, {actions.toLocaleString()} calls or requests</h2>
  <label className="scorecard-note">Show the last <select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(d=><option key={d} value={d}>{d} days</option>)}</select></label>
  <dl className="growth-results"><div><dt>Call taps</dt><dd>{(t.call_tap||0).toLocaleString()}</dd></div><div><dt>Requests started</dt><dd>{(t.request_start||0).toLocaleString()}</dd></div><div><dt>Requests sent</dt><dd>{(t.request_sent||0).toLocaleString()}</dd></div><div><dt>Call-backs asked</dt><dd>{(t.callback_sent||0).toLocaleString()}</dd></div></dl>
  {(t.request_start||0)>0&&<p className="scorecard-note">{Math.round(100*(t.request_sent||0)/(t.request_start||1))}% of people who start the request form send it.</p>}
  <h3>Where visitors came from</h3>
  {data.sources.length?<dl className="snapshot-bars" aria-label="Page views by where visitors came from">{data.sources.map((s,i)=><div key={s.source}><dt>{sourceLabel[s.source]||s.source}</dt><dd>{(s.views||0).toLocaleString()} views · {(s.actions||0).toLocaleString()} calls or requests<span aria-hidden="true" className="snapshot-bar-track"><i className={'snapshot-bar tone-'+(i%3)} style={{width:chartPercent(s.views||0,maxSource)+'%'}}/></span></dd></div>)}</dl>:<p>No visits counted yet.</p>}
  {data.pages.length>0&&<><h3>Top pages</h3><table className="source-outcomes"><thead><tr><th scope="col">Page</th><th scope="col">Views</th><th scope="col">Calls or requests</th></tr></thead><tbody>{data.pages.map(p=><tr key={p.page}><th scope="row">{pageLabel(p.page)}</th><td>{(p.views||0).toLocaleString()}</td><td>{(p.actions||0).toLocaleString()}</td></tr>)}</tbody></table></>}
  <p className="scorecard-note">Counted without cookies or visitor ids. Search engines and bots are skipped where they say who they are, so totals run a little low.</p>
 </section>;
}
