'use client';
import {useEffect,useState} from 'react';
import {localInstant,localMinute} from '../../../packages/domain/timezone';
import {sessionFetch} from '../lib/session-fetch';
import {useFieldCommand} from './use-field-command';
import {useUnsavedEntry} from './entry-safety';
type Submit=(v:Record<string,unknown>)=>Promise<unknown>;
type WorkRecord={started_at:string;ended_at:string;description:string;charged_cents:number|null;agreement:string|null;job_id:string|null};
export function CompletedWorkEntry({organization,request,revision,timezone,description,submit,blocked,onBusy,onRecorded}:{organization:string;request:string;revision:number;timezone:string;description:string;submit:Submit;blocked:boolean;onBusy:(v:boolean)=>void;onRecorded:(record:WorkRecord|null)=>void}){
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState(false),[record,setRecord]=useState<WorkRecord|null>(null),[dirty,setDirty]=useState(false),[agreed,setAgreed]=useState(false);
 const action=useFieldCommand('completed-work:'+request,submit);
 useUnsavedEntry('completed-work:'+request,dirty);
 useEffect(()=>{onBusy(action.busy||action.unknown);return()=>onBusy(false);},[action.busy,action.unknown,onBusy]);
 useEffect(()=>{let active=true;setLoading(true);void sessionFetch('/api/owner-recorded-work?'+new URLSearchParams({organization,request}),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error('Completed work could not be loaded.');if(active){setRecord(d.record);onRecorded(d.record);if(d.record&&!d.record.job_id)setOpen(true);}}).catch(()=>{if(active)setError('Saved completed work could not be checked. Reload before entering it again.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[organization,request,revision,onRecorded]);
 if(record?.job_id)return null;
 return <section className="workflow-section"><button type="button" className="secondary" disabled={blocked||loading||action.unknown} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{record?'Completed work recorded · finish billing':'Record completed work'}</button>
 {error&&<p role="alert">{error}</p>}{saved&&<p role="status">Actual work saved. No invoice was issued or payment recorded.</p>}
 {action.unknown&&<button type="button" disabled={action.busy} onClick={()=>void action.run()}>Check saved work</button>}
 {open&&!loading&&<form key={record?.ended_at||'new'} onChange={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();setError('');const f=new FormData(e.currentTarget);try{
 const startAt=new Date(localInstant(String(f.get('start')),timezone)).toISOString(),endAt=new Date(localInstant(String(f.get('end')),timezone)).toISOString();
 if(Date.parse(endAt)>Date.now()||Date.parse(endAt)<=Date.parse(startAt))throw Error('Enter when the work actually started and ended. End time must be in the past.');
 const total=f.get('total');void action.run({command:'RecordOwnerWork',id:request,revision,startAt,endAt,description:f.get('description'),totalCents:total===''?null:Math.round(Number(total)*100),agreement:agreed?f.get('agreement'):null}).then(ok=>{if(ok){setDirty(false);setSaved(true);}});
 }catch(e){setError(e instanceof Error?e.message:'Check the work times.');}}}>
 <fieldset disabled={blocked||action.busy||action.unknown}><legend>Actual work completed</legend><p className="tiny">Record the real times. No appointment or timer is required.</p>
 <label>Started · {timezone}<input name="start" type="datetime-local" required defaultValue={record?localMinute(Date.parse(record.started_at),timezone):undefined}/></label>
 <label>Finished · {timezone}<input name="end" type="datetime-local" required defaultValue={record?localMinute(Date.parse(record.ended_at),timezone):undefined}/></label>
 <label>Work performed<textarea name="description" minLength={10} maxLength={1000} required defaultValue={record?.description||description}/></label>
 <label>Labor charge ($, optional)<input name="total" type="number" min="0" max="9999999.99" step="0.01" required={agreed} defaultValue={record?.charged_cents==null?'':String(record.charged_cents/100)}/></label>
 <label><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>The customer already agreed to this work and charge</label>
 {agreed&&<label>How and when did they agree?<textarea name="agreement" required minLength={10} maxLength={2000} placeholder="For example: agreed in person today before work began."/></label>}
 <button>{action.busy?'Saving…':agreed?'Save completed work & prepare invoice':'Save completed work'}</button>
 <p className="tiny">{agreed?'Saves the actual agreement and work together. Review tax and issue the invoice next.':'Save work now. Add billing and the actual agreement later.'}</p></fieldset></form>}
 </section>;
}
export function OwnerRequestEntry({organization,submit,blocked,onCreated,onBusy}:{organization:string;submit:Submit;blocked:boolean;onCreated:(id:string)=>void;onBusy:(v:boolean)=>void}){
 const [open,setOpen]=useState(false),[catalog,setCatalog]=useState<{id:string;name:string}[]>([]),[error,setError]=useState(''),[dirty,setDirty]=useState(false);
 const action=useFieldCommand('new-owner-job:'+organization,async value=>{const r=await submit(value) as {ok?:boolean;result?:{id?:string}};if(r?.ok&&r.result?.id){setDirty(false);setOpen(false);onCreated(r.result.id);}return r;});
 useUnsavedEntry('new-owner-job:'+organization,dirty);
 useEffect(()=>{onBusy(action.busy||action.unknown);return()=>onBusy(false);},[action.busy,action.unknown,onBusy]);
 useEffect(()=>{if(!open)return;let active=true;void sessionFetch('/api/owner-catalog?'+new URLSearchParams({organization}),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error();if(active)setCatalog(d.services);}).catch(()=>{if(active)setError('Services could not be loaded. Close and reopen this form to retry.');});return()=>{active=false;};},[open,organization]);
 return <section className="owner-job-entry"><button type="button" disabled={blocked||action.unknown} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>New job</button>{error&&<p role="alert">{error}</p>}{action.unknown&&<button type="button" disabled={action.busy} onClick={()=>void action.run()}>Check saved job</button>}
 {open&&<form className="card" onChange={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void action.run({command:'CreateOwnerRequest',input:Object.fromEntries(f)});}}><fieldset disabled={blocked||action.busy||action.unknown}><legend>Add a job</legend>
 <label>Customer name<input name="name" required minLength={2} maxLength={160}/></label><label>Phone (optional)<input name="phone" type="tel" maxLength={35}/></label><label>Email (optional)<input name="email" type="email" maxLength={254}/></label>
 <label>Street / work location<input name="street" required minLength={2} maxLength={200}/></label><label>City<input name="city" required minLength={2} maxLength={80}/></label><label>State / region<input name="state" required minLength={2} maxLength={80} defaultValue="IL"/></label><label>ZIP / postal code (optional)<input name="postalCode" maxLength={30}/></label>
 <label>Service<select name="serviceId" required><option value="">Choose service</option>{catalog.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Work needed<textarea name="description" minLength={10} maxLength={1000} required/></label><button disabled={!catalog.length}>{action.busy?'Saving…':'Add job'}</button><p className="tiny">Any work location. Schedule it, start work, or record work already completed next.</p></fieldset></form>}
 </section>;
}
