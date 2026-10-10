"use client";
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../../../lib/session-fetch';
import {publicError} from '../../../lib/public-errors';
import type {SampleSuite} from '../../../lib/production-samples';
import InvoiceView from '../../invoice-view';
type RecordData={run:string|null;recipient:string;suite?:SampleSuite;results?:{template:string;status:string}[]};
export default function ProductionCheck(){
 const [data,setData]=useState<RecordData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[view,setView]=useState<'owner'|'customer'>('owner');
 const sending=useRef(false),createKey=useRef(''),mounted=useRef(true),[progress,setProgress]=useState('');
 const [organization,setOrganization]=useState('');
 const [paymentStatus,setPaymentStatus]=useState(''),[checkingPayment,setCheckingPayment]=useState(false);
 async function checkPayments(){
  setCheckingPayment(true);setPaymentStatus('');
  try{
   const r=await sessionFetch('/api/production-check?'+new URLSearchParams({organization,check:'payments'}));
   const d=await r.json();if(!r.ok)throw Error('verification unavailable');
   if(mounted.current)setPaymentStatus((d.workspaceOriginMatches?'Workspace address verified. ':'Workspace address does not match the configured sign-in and save address. ')+(d.status==='merchant_verified'?'Live card merchant verified. A signed-webhook and actual-payment check are still required.':d.status==='connection_required'?'The live card connection is not configured.':'The card merchant could not be verified.'));
  }catch{if(mounted.current)setPaymentStatus('Connection verification is unavailable. No charge was created.');}
  finally{if(mounted.current)setCheckingPayment(false);}
 }
 async function load(org:string,run?:string){
 const q=new URLSearchParams({organization:org,...(run?{run}:{})});
 const r=await sessionFetch('/api/production-check?'+q),d=await r.json();if(!r.ok){if(r.status===401&&run){location.replace('/sample/request');return;}throw Error(d.error);}if(mounted.current)setData(d);
 }
 useEffect(()=>{mounted.current=true;const q=new URLSearchParams(location.search),org=q.get('organization')||'';setOrganization(org);void load(org,q.get('run')||undefined).catch(e=>{if(mounted.current)setError(publicError(e))});return()=>{mounted.current=false;};},[]);
 async function post(body:Record<string,unknown>){const r=await sessionFetch('/api/production-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization,...body})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 async function create(){if(sending.current)return;sending.current=true;setBusy(true);setError('');try{createKey.current ||= crypto.randomUUID();const d=await post({action:'create',key:createKey.current});await load(organization,d.run);history.replaceState(null,'','?'+new URLSearchParams({organization,run:d.run}));}catch(e){setError(publicError(e));}finally{sending.current=false;if(mounted.current)setBusy(false);}}
 async function send(){if(!data?.suite||!data.run||sending.current)return;sending.current=true;setBusy(true);setError('');
 try{for(const [index,m] of data.suite.messages.entries()){
 if(!mounted.current)break;
 const existing=data.results?.find(r=>r.template===m.id);if(existing){if(!['accepted','pending'].includes(existing.status)){setProgress('Stopped: '+m.label+' is '+existing.status.replaceAll('_',' ')+'. Review its saved result before any resend.');return;}continue;}
 setProgress('Sending sample '+(index+1)+' of '+data.suite.messages.length+': '+m.label);
 const d=await post({action:'send',run:data.run,template:m.id,reviewed:true});
 await load(organization,data.run);
 if(!['accepted','pending'].includes(d.status)){setProgress('Stopped: '+m.label+' is '+d.status.replaceAll('_',' ')+'. Review before sending again.');return;}
 }if(mounted.current)setProgress('Samples queued for background delivery. You can close this page. Refresh results to check acceptance, then check your inbox for receipt.');
 }catch(e){if(mounted.current)setError(publicError(e));}finally{sending.current=false;if(mounted.current)setBusy(false);}}
 const message=data?.suite?.messages.find(m=>m.id===selected);
 return <main id="main" className="shell invoice-document">
 <div className="invoice-actions"><a href="/owner">Back to workspace</a><button disabled={busy} onClick={()=>void load(organization,data?.run||undefined).catch(e=>setError(publicError(e)))}>Refresh results</button></div>
 <h1>Production checks</h1><p>Review the customer and owner messages, then send one sample of each to your approved owner inbox. These samples use the production templates. They do not book visits, issue bills or record payments.</p>
 <section className="card"><h2>Card payment connection</h2><p>This check verifies the live merchant without creating a charge.</p><button disabled={!organization||checkingPayment} onClick={()=>void checkPayments()}>{checkingPayment?'Checking connection…':'Check card connection'}</button>{paymentStatus&&<p role="status">{paymentStatus}</p>}</section>
 {error&&<p role="alert" className="note">{error}</p>}
 {!data&&!error&&<p role="status">Loading checks…</p>}
 {data&&<><p>Sample recipient: <strong>{data.recipient}</strong></p>{!data.run?<button disabled={busy} onClick={()=>void create()}>Create sample invoice and emails</button>:<>
 {data.suite?.settingsWarnings.map(w=><p className="note" key={w}>{w}</p>)}
 <div className="actions"><button disabled={busy} className="secondary" onClick={()=>void create()}>Create updated sample set</button><button disabled={busy} onClick={()=>void send()}>Email the sample set to me ({data.suite?.messages.length})</button><a href={'/api/production-check?'+new URLSearchParams({organization,run:data.run,format:'pdf'})}>Download sample invoice PDF</a></div>
 {progress&&<p role="status">{progress}</p>}
 <h2>Email checklist</h2><p>Each message is clearly marked SAMPLE. Appointment buttons open this screen and cannot change a customer record. The review button opens the actual Google review page; do not submit a review for a sample. Account verification and password-reset emails are sent separately by the authentication provider.</p>
 <table className="invoice-lines"><caption>Production message templates and sample results</caption><thead><tr><th>Task</th><th>Recipient</th><th>Send result</th><th>Preview</th></tr></thead><tbody>{data.suite?.messages.map(m=><tr key={m.id}><td>{m.label}</td><td>{m.audience}</td><td>{(data.results?.find(r=>r.template===m.id)?.status||'not sent').replaceAll('_',' ')}</td><td><button className="secondary" onClick={()=>setSelected(m.id)}>View email</button></td></tr>)}</tbody></table>
 {message&&<section className="card"><h2>{message.label}</h2><p>{message.subject}</p><iframe title={message.label+' email preview'} srcDoc={message.html} sandbox="allow-popups allow-popups-to-escape-sandbox" style={{width:'100%',height:650,border:'1px solid #d6dfd7',background:'#fff'}}/><button className="secondary" onClick={()=>setSelected('')}>Close preview</button></section>}
 <h2>Sample invoice in the CRM</h2><div className="actions"><button className={view==='owner'?'':'secondary'} aria-pressed={view==='owner'} onClick={()=>setView('owner')}>Owner view</button><button className={view==='customer'?'':'secondary'} aria-pressed={view==='customer'} onClick={()=>setView('customer')}>Customer view</button></div>
 <p>{view==='owner'?'Owner context: review the document before issuing and emailing a real invoice.':'Customer context: this is the same invoice document shown in the customer account, with the same work, amounts and terms. This preview does not test customer sign-in or permissions.'}</p>
 {data.suite&&<InvoiceView invoice={data.suite.invoice}/>}</> }</>}
 </main>;
}
