'use client';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {mileageEntry,mileageReport,verifiedMileageReceipt} from '../lib/mileage-contract';
import {useBlockedEntry,useUnsavedEntry} from './entry-safety';
import {localDate} from '../lib/day-plan';
type Trip={id:string;trip_date:string;purpose:string;origin:string;destination:string;vehicle_label:string;odometer_start:number;odometer_end:number;business_use:string;reversed_at:string|null;reversal_reason:string|null};
type Data={from:string;to:string;page:number;businessMiles:number;activeTrips:number;trips:Trip[];hasMore:boolean};
type Draft={tripDate:string;purpose:string;origin:string;destination:string;vehicleLabel:string;odometerStart:string;odometerEnd:string;businessUse:'business'|'personal'|'mixed-review';notes:string};
const blank=(day:string):Draft=>({tripDate:day,purpose:'',origin:'',destination:'',vehicleLabel:'',odometerStart:'',odometerEnd:'',businessUse:'business',notes:''});
export default function MileageActivity({organization,timezone}:{organization:string;timezone:string}){
 const day=localDate(new Date(),timezone);
 const [draft,setDraft]=useState(()=>blank(day)),[data,setData]=useState<Data|null>(null),[from,setFrom]=useState(day.slice(0,4)+'-01-01'),[to,setTo]=useState(day),[page,setPage]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[stale,setStale]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reason,setReason]=useState(''),[selected,setSelected]=useState('');
 const attempt=useRef<string|null>(null),sending=useRef(false),writingOrg=useRef<string|null>(null),revision=useRef(0);
 const identity=useRef(organization);identity.current=organization;
 useEffect(()=>{attempt.current=null;setData(null);setDraft(blank(day));setReason('');setSelected('');setUnknown(false);setBusy(false);setNotice('');},[organization]);
 const dirty=JSON.stringify(draft)!==JSON.stringify(blank(day))||Boolean(reason);
 useUnsavedEntry('mileage:'+organization,dirty);
 useBlockedEntry('mileage:'+organization,busy||unknown);
 async function reload(){
  if(sending.current&&writingOrg.current===organization)return;
  const target=organization,n=++revision.current;setLoading(true);setError('');setStale(true);
  try{
   const r=await sessionFetch('/api/mileage?'+new URLSearchParams({organization,from,to,page:String(page)}),{cache:'no-store'}),v=await r.json();
   if(!r.ok){if((r.status===401||r.status===403)&&target===identity.current&&n===revision.current)setData(null);throw Error('unverified');}
   const report=mileageReport.parse(v);
   if(report.from!==from||report.to!==to||report.page!==page||new Set(report.trips.map(t=>t.id)).size!==report.trips.length)throw Error('unverified');
   if(n!==revision.current)return;
   setData(report);setStale(false);
   // Reading a list cannot prove the outcome of a particular command.
   // Retain the frozen attempt until its exact receipt is recovered.
  }catch{if(n===revision.current)setError('Trip records could not be confirmed. Refresh before another change or export.');}
  finally{if(n===revision.current)setLoading(false);}
 }
 useEffect(()=>{void reload();return()=>{revision.current++;};},[organization,from,to,page]);
 async function send(){
  if(sending.current||!attempt.current)return;
  sending.current=true;writingOrg.current=organization;setBusy(true);setError('');setNotice('');setStale(true);
  const payload=attempt.current,target=organization,generation=revision.current;
  try{
   const r=await sessionFetch('/api/mileage',{method:'POST',headers:{'Content-Type':'application/json'},body:payload}),v=await r.json();
   if(target!==identity.current||generation!==revision.current)return;
   if(!r.ok&&r.status>=400&&r.status<500&&!unknown){attempt.current=null;setError(typeof v.error==='string'?v.error:'Trip change was rejected.');return;}
   if(!r.ok)throw Error('uncertain');
   verifiedMileageReceipt(v,payload);
   attempt.current=null;setUnknown(false);setDraft(blank(day));setReason('');setSelected('');setNotice('Mileage record saved. No tax deduction or customer charge was created.');
   sending.current=false;await reload();
  }catch{if(target===identity.current&&generation===revision.current){setUnknown(true);setError('Save result uncertain. Check the same saved attempt instead of creating another trip.');}}
  finally{sending.current=false;writingOrg.current=null;if(target===identity.current)setBusy(false);}
 }
 function record(e:React.FormEvent){e.preventDefault();if(sending.current||busy||unknown||stale||loading||selected)return;
  const v=mileageEntry.safeParse({organizationId:organization,id:crypto.randomUUID(),tripDate:draft.tripDate,purpose:draft.purpose,origin:draft.origin,destination:draft.destination,vehicleLabel:draft.vehicleLabel,odometerStart:Number(draft.odometerStart),odometerEnd:Number(draft.odometerEnd),businessUse:draft.businessUse,recordedSource:'manual-odometer',jobId:null,notes:draft.notes});
  if(!v.success||!draft.odometerStart||!draft.odometerEnd){setError('Review the date, purpose, places, vehicle and both odometer readings.');return;}
  attempt.current=JSON.stringify({action:'record',key:crypto.randomUUID(),entry:v.data});void send();
 }
 function reverse(e:React.FormEvent){e.preventDefault();if(sending.current||!selected||reason.trim().length<10||busy||unknown||loading||stale)return;
  if(!window.confirm('Reverse this trip from your totals? Its original record remains retained.'))return;
  attempt.current=JSON.stringify({action:'reverse',organization,id:selected,key:crypto.randomUUID(),reason:reason.trim()});void send();
 }
 function csv(){
  if(!data||stale||loading||busy||unknown)return;
  const quote=(v:string)=>'"'+(/^[=+\-@\t\r]/.test(v)?"'":"")+v.replaceAll('"','""')+'"';
  const lines=[['Date','Trip','Vehicle','Miles','Use','Status'],...data.trips.map(t=>[t.trip_date,t.purpose,t.vehicle_label,String(t.odometer_end-t.odometer_start),t.business_use,t.reversed_at?'Reversed':'Recorded'])];
  const blob=new Blob(['\uFEFF'+lines.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mileage-'+from+'-to-'+to+'-page-'+page+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const change=(key:keyof Draft,value:string)=>setDraft(current=>({...current,[key]:value}));
 return <section className="card mileage-activity" aria-label="Business trip mileage"><h2>Recorded vehicle mileage</h2>
  <p>Enter actual odometer readings, not map estimates. Business classification is not a tax deduction or customer bill. Mixed trips require review.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="actions"><label>From<input type="date" disabled={busy||unknown||dirty} value={from} onChange={e=>{setPage(0);setFrom(e.target.value);}}/></label><label>Through<input type="date" disabled={busy||unknown||dirty} value={to} onChange={e=>{setPage(0);setTo(e.target.value);}}/></label><button type="button" className="secondary" disabled={loading||busy} onClick={()=>void reload()}>{loading?'Checking…':'Refresh trips'}</button></div>
  {data&&!stale&&<p><strong>{data.businessMiles} recorded business miles</strong> across {data.activeTrips} active trips. No deduction calculation.</p>}
  <form onSubmit={record}><fieldset disabled={loading||busy||unknown||stale||Boolean(selected)}><legend>Record an actual trip</legend>
   <label>Trip date<input type="date" required value={draft.tripDate} onChange={e=>change('tripDate',e.target.value)}/></label>
   <label>Purpose<input required minLength={5} maxLength={300} value={draft.purpose} onChange={e=>change('purpose',e.target.value)}/></label>
   <label>Starting location<input required value={draft.origin} onChange={e=>change('origin',e.target.value)}/></label>
   <label>Destination or last stop<input required value={draft.destination} onChange={e=>change('destination',e.target.value)}/></label>
   <label>Vehicle<input required value={draft.vehicleLabel} onChange={e=>change('vehicleLabel',e.target.value)}/></label>
   <label>Odometer start<input required type="number" min={0} max={9999999} step={1} value={draft.odometerStart} onChange={e=>change('odometerStart',e.target.value)}/></label>
   <label>Odometer end<input required type="number" min={1} max={9999999} step={1} value={draft.odometerEnd} onChange={e=>change('odometerEnd',e.target.value)}/></label>
   <label>Trip classification<select value={draft.businessUse} onChange={e=>change('businessUse',e.target.value)}><option value="business">Business use, review tax treatment separately</option><option value="personal">Personal</option><option value="mixed-review">Mixed, needs review</option></select></label>
   <label>Optional notes<textarea maxLength={500} value={draft.notes} onChange={e=>change('notes',e.target.value)}/></label>
   <button type="submit">Save recorded trip</button>
  </fieldset></form>
  {unknown&&<button type="button" onClick={()=>void send()} disabled={busy}>Check same saved trip attempt</button>}
  <h3>Trip history</h3>{data&&!stale&&data.trips.map(t=><article className="customer-item" key={t.id}><strong>{t.trip_date} · {t.purpose}</strong><p>{t.origin} → {t.destination} · {t.vehicle_label} · {t.odometer_end-t.odometer_start} miles · {t.business_use}</p><p>{t.reversed_at?'Reversed: '+(t.reversal_reason||''): 'Recorded, no tax claim'}</p>{!t.reversed_at&&<button type="button" className="secondary" disabled={busy||unknown||loading||stale||dirty} onClick={()=>{setSelected(t.id);setReason('');}}>Review reversal</button>}</article>)}
  {selected&&<form onSubmit={reverse}><label>Reason to reverse this trip<input required minLength={10} maxLength={300} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="actions"><button type="submit" disabled={busy||unknown||loading||stale}>Reverse selected trip</button><button type="button" className="secondary" disabled={busy||unknown} onClick={()=>{setSelected('');setReason('');}}>Cancel</button></div></form>}
  <div className="actions"><button type="button" disabled={stale||busy||unknown||loading||!data} onClick={csv}>Export visible trip page (CSV)</button><button type="button" className="secondary" disabled={page===0||busy||unknown||dirty} onClick={()=>setPage(v=>v-1)}>Newer</button><button type="button" className="secondary" disabled={!data?.hasMore||busy||unknown||dirty} onClick={()=>setPage(v=>v+1)}>Older</button></div>
 </section>;
}
