"use client";
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../../../lib/session-fetch';
import {publicError} from '../../../lib/public-errors';
import type {SampleSuite} from '../../../lib/production-samples';
import InvoiceView from '../../invoice-view';
type RecordData={run:string|null;recipient:string;suite?:SampleSuite;results?:{template:string;status:string}[]};
export default function ProductionCheck(){
 const [data,setData]=useState<RecordData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[view,setView]=useState<'owner'|'customer'>('owner');
 const [audience,setAudience]=useState<'all'|'owner'|'customer'>('all');
 const preview=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(selected)preview.current?.focus();},[selected]);
 const sending=useRef(false),createKey=useRef(''),mounted=useRef(true),[progress,setProgress]=useState('');
 const [organization,setOrganization]=useState('');
 const [paymentStatus,setPaymentStatus]=useState(''),[checkingPayment,setCheckingPayment]=useState(false);
 async function checkPayments(){
  setCheckingPayment(true);setPaymentStatus('');
  try{
   const r=await sessionFetch('/api/production-check?'+new URLSearchParams({organization,check:'payments'}));
   const d=await r.json();if(!r.ok)throw Error('verification unavailable');
   const labels:Record<string,string>={apiKey:'Payment credential',webhook:'Payment notification signing',merchant:'Business payment account',workspace:'Workspace connection'};
   const setup=Object.entries(labels).map(([key,label])=>`${label}: ${d.configurationChecks?.[key]==='configured'?'configured':d.configurationChecks?.[key]==='unassigned'?'not assigned to this business':d.configurationChecks?.[key]==='invalid'?'needs correction':'not configured'}.`).join(' ');
   if(mounted.current)setPaymentStatus((d.workspaceOriginMatches?'Workspace address verified. ':'Workspace address does not match the configured sign-in and save address. ')+(d.status==='merchant_verified'?'Live card merchant verified. A signed-webhook and actual-payment check are still required.':d.status==='connection_required'?'The live card connection is not configured. '+setup:'The card merchant could not be verified.'));
  }catch{if(mounted.current)setPaymentStatus('Connection verification is unavailable. No charge was created.');}
  finally{if(mounted.current)setCheckingPayment(false);}
 }
 async function load(org:string,run?:string){
 const q=new URLSearchParams({organization:org,...(run?{run}:{})});
 const r=await sessionFetch('/api/production-check?'+q),d=await r.json();if(!r.ok){if(r.status===401&&run){location.replace('/sample/request');return;}throw Error(d.error);}if(mounted.current)setData(d);
 }
 useEffect(()=>{mounted.current=true;const q=new URLSearchParams(location.search),org=q.get('organization')||'';setOrganization(org);void load(org,q.get('run')||undefined).catch(e=>{if(mounted.current)setError(publicError(e))});return()=>{mounted.current=false;};},[]);
 async function post(body:Record<string,unknown>){const r=await sessionFetch('/api/production-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,...body})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 async function create(){if(sending.current)return;sending.current=true;setBusy(true);setError('');try{createKey.current ||= crypto.randomUUID();const d=await post({action:'create',key:createKey.current});await load(organization,d.run);createKey.current='';setSelected('');setProgress('');history.replaceState(null,'','?'+new URLSearchParams({organization,run:d.run}));}catch(e){setError(publicError(e));}finally{sending.current=false;if(mounted.current)setBusy(false);}}
 async function send(template:string){
 if(!data?.suite||data.suite.templateVersion!=='2026-10-13-email-ux'||!data.run||sending.current||data.results?.some(r=>r.template===template))return;
 const sample=data.suite.messages.find(m=>m.id===template);if(!sample)return;
 sending.current=true;setBusy(true);setError('');setProgress('Preparing '+sample.label.toLowerCase()+'…');
 try{
  const d=await post({action:'send',run:data.run,template,reviewed:true});
  await load(organization,data.run);
  if(mounted.current)setProgress(d.status==='accepted'?'The email service accepted this sample. Check your inbox to confirm it arrived.':d.status==='pending'?'This sample is queued. You can close this page and check your inbox shortly.':'This sample needs review. Check its saved result before sending again.');
 }catch(e){if(mounted.current){setError(publicError(e));setProgress('The result could not be confirmed. Refresh results before trying again.');await load(organization,data.run).catch(()=>{});}}
 finally{sending.current=false;if(mounted.current)setBusy(false);}
 }
 const currentPreviews=data?.suite?.templateVersion==='2026-10-13-email-ux';
 const messages=data?.suite?.messages.filter(m=>m.id!=='appointment.owner_confirmation')||[];
 const visibleMessages=messages.filter(m=>audience==='all'||m.audience===audience);
 const message=messages.find(m=>m.id===selected);
 const result=message?data?.results?.find(r=>r.template===message.id):undefined;
 return <main id="main" className="shell invoice-document">
 <div className="invoice-actions"><a href="/owner">Back to workspace</a><button disabled={busy} onClick={()=>void load(organization,data?.run||undefined).catch(e=>setError(publicError(e)))}>Refresh results</button></div>
 <h1>Invoice & email previews</h1><p>See exactly what your customers receive. Preview any email here, then send just the sample you want to check. Samples never book visits, issue bills or record payments.</p>
 <section className="card"><h2>Card payment connection</h2><p>This check verifies the live merchant without creating a charge.</p><button disabled={!organization||checkingPayment} onClick={()=>void checkPayments()}>{checkingPayment?'Checking connection…':'Check card connection'}</button>{paymentStatus&&<p role="status">{paymentStatus}</p>}</section>
 {error&&<p role="alert" className="note">{error}</p>}
 {!data&&!error&&<p role="status">Loading checks…</p>}
 {data&&<><p>Sample recipient: <strong>{data.recipient}</strong></p>{!data.run?<button disabled={busy} onClick={()=>void create()}>Create sample invoice and emails</button>:<>
 {!currentPreviews&&<p className="note">These previews were saved before the latest email update. Choose “Create updated sample set” to see the current wording. Nothing will be emailed.</p>}
 {data.suite?.settingsWarnings.map(w=><p className="note" key={w}>{w}</p>)}
 <div className="actions"><button disabled={busy} className="secondary" onClick={()=>void create()}>Create updated sample set</button><a href={'/api/production-check?'+new URLSearchParams({organization,run:data.run,format:'pdf'})}>Download sample invoice PDF</a></div>
 {progress&&<p role="status">{progress}</p>}
 <h2>Email previews</h2><p>Customer updates cover the request, appointment and invoice. You receive new requests, schedule changes and a visit reminder. Confirming a booking in the app does not send you another confirmation email.</p>
 <div className="actions" aria-label="Filter email previews">{(['all','customer','owner'] as const).map(value=><button key={value} className={audience===value?'':'secondary'} aria-pressed={audience===value} onClick={()=>{setAudience(value);setSelected('');}}>{value==='all'?'All emails':value==='customer'?'Customer emails':'Your emails'}</button>)}</div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:16,margin:'20px 0'}}>{visibleMessages.map(m=>{const status=data.results?.find(r=>r.template===m.id)?.status;return <article className="card" key={m.id}><p className="tiny">{m.audience==='customer'?'To your customer':'To you'}</p><h3>{m.label}</h3><p>{m.subject.replace(/^\[SAMPLE [A-Z]+\] /,'')}</p><p>{status==='accepted'?'Accepted by the email service':status==='pending'?'Queued for delivery':status?'Saved result: '+status.replaceAll('_',' '):'Preview available · sample not sent'}</p><button className="secondary" aria-expanded={selected===m.id} onClick={()=>setSelected(m.id)}>Preview email</button></article>})}</div>
 {message&&<section ref={preview} tabIndex={-1} className="card" aria-label="Selected email preview"><div className="actions"><h2>{message.label}</h2><button className="secondary" onClick={()=>setSelected('')}>Close preview</button></div><p>Sample only. All test emails go to <strong>{data.recipient}</strong>.</p><iframe title={message.label+' email preview'} srcDoc={message.html} sandbox="allow-popups allow-popups-to-escape-sandbox" style={{width:'100%',height:650,border:'1px solid #d6dfd7',background:'#fff'}}/><div className="actions"><button disabled={busy||!!result||!currentPreviews} onClick={()=>void send(message.id)}>{busy?'Preparing sample…':result?'Sample already recorded':'Email this sample to me'}</button></div>{result&&<p>Refresh results to check delivery. A saved or uncertain result will not be sent again.</p>}<p className="tiny">Customer buttons open a demonstration; they cannot change a real request. Review links open your actual review page—please do not submit a review for a sample. Account and password emails are checked separately.</p></section>}

 <h2>Sample invoice in the CRM</h2><div className="actions"><button className={view==='owner'?'':'secondary'} aria-pressed={view==='owner'} onClick={()=>setView('owner')}>Owner view</button><button className={view==='customer'?'':'secondary'} aria-pressed={view==='customer'} onClick={()=>setView('customer')}>Customer view</button></div>
 <p>{view==='owner'?'Owner context: review the document before issuing and emailing a real invoice.':'Customer context: this is the same invoice document shown in the customer account, with the same work, amounts and terms. This preview does not test customer sign-in or permissions.'}</p>
 {data.suite&&<InvoiceView invoice={data.suite.invoice}/>}</> }</>}
 </main>;
}
