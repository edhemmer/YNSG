"use client";
import InvoicePayments from "../invoice-payments";
import InvoiceView from "../invoice-view";
import { publicError } from "../../lib/public-errors";
import {useEffect,useState} from 'react';
import {sessionFetch} from '../../lib/session-fetch';
import type {InvoiceDocument} from '../../lib/invoice-document';
export default function InvoicePage(){
 const [target,setTarget]=useState<{organization:string;invoice:string}|null>(null);
 const [accountReturn,setAccountReturn]=useState(false);
 const [invoice,setInvoice]=useState<InvoiceDocument|null>(null),[error,setError]=useState(''),[pdfError,setPdfError]=useState(''),[pdfBusy,setPdfBusy]=useState(false);
 useEffect(()=>{let active=true;const q=new URLSearchParams(window.location.search);setAccountReturn(q.get("return")==="account");setTarget({organization:q.get("organization")||"",invoice:q.get("invoice")||""});
 sessionFetch('/api/invoice-document?'+new URLSearchParams({organization:q.get('organization')||'',invoice:q.get('invoice')||''})).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setInvoice(d.invoice)}).catch(e=>{if(active)setError(publicError(e))});
 return()=>{active=false};},[]);
 return <main className="shell invoice-document" id="main"><style>{'@media print {.invoice-actions,.skip{display:none!important} .shell{max-width:none;margin:0;padding:0} .invoice-lines tr{break-inside:avoid} body{background:white;color:black}}'}</style>
 <div className="invoice-actions"><a href={accountReturn?"/account":"/"}>{accountReturn?"Back to my account":"Back to workspace"}</a>{invoice&&<><button onClick={()=>window.print()}>Print / save as PDF</button><button disabled={pdfBusy||!invoice.recipient} onClick={async()=>{if(pdfBusy)return;setPdfBusy(true);setPdfError('');try{const q=new URLSearchParams(window.location.search);q.set("format","pdf");const r=await sessionFetch("/api/invoice-document?"+q.toString());if(!r.ok){const d=await r.json();throw Error(d.error||"PDF could not be created.");}const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download=`invoice-${invoice.number}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setPdfError(publicError(e))}finally{setPdfBusy(false)}}}>{pdfBusy?'Creating PDF…':'Download PDF'}</button></>}</div>
 {pdfError&&<p role="alert">{pdfError}</p>}
 {error?<p role="alert">{error}</p>:!invoice?<p role="status">Loading invoice…</p>:<><InvoiceView invoice={invoice}/>{target&&<div className="invoice-actions"><InvoicePayments organization={target.organization} invoice={target.invoice} totalCents={invoice.totalCents} onChanged={()=>{void sessionFetch("/api/invoice-document?"+new URLSearchParams(target)).then(r=>r.json()).then(d=>{if(d.invoice)setInvoice(d.invoice)});}}/></div>}</>}</main>;
}
