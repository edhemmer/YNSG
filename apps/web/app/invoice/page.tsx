"use client";
import { publicError } from "../../lib/public-errors";
import {useEffect,useState} from 'react';
import {sessionFetch} from '../../lib/session-fetch';
import type {InvoiceDocument} from '../../lib/invoice-document';
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function InvoicePage(){
 const [accountReturn,setAccountReturn]=useState(false);
 const [invoice,setInvoice]=useState<InvoiceDocument|null>(null),[error,setError]=useState(''),[pdfError,setPdfError]=useState(''),[pdfBusy,setPdfBusy]=useState(false);
 useEffect(()=>{let active=true;const q=new URLSearchParams(window.location.search);setAccountReturn(q.get("return")==="account");
 sessionFetch('/api/invoice-document?'+new URLSearchParams({organization:q.get('organization')||'',invoice:q.get('invoice')||''})).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setInvoice(d.invoice)}).catch(e=>{if(active)setError(publicError(e))});
 return()=>{active=false};},[]);
 return <main className="shell invoice-document" id="main"><style>{'@media print {.invoice-actions,.skip{display:none!important} .shell{max-width:none;margin:0;padding:0} .invoice-lines tr{break-inside:avoid} body{background:white;color:black}}'}</style>
 <div className="invoice-actions"><a href={accountReturn?"/account":"/"}>{accountReturn?"Back to my account":"Back to workspace"}</a>{invoice&&<><button onClick={()=>window.print()}>Print / save as PDF</button><button disabled={pdfBusy||!invoice.recipient} onClick={async()=>{if(pdfBusy)return;setPdfBusy(true);setPdfError('');try{const q=new URLSearchParams(window.location.search);q.set("format","pdf");const r=await sessionFetch("/api/invoice-document?"+q.toString());if(!r.ok){const d=await r.json();throw Error(d.error||"PDF could not be created.");}const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download=`invoice-${invoice.number}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setPdfError(publicError(e))}finally{setPdfBusy(false)}}}>{pdfBusy?'Creating PDF…':'Download PDF'}</button></>}</div>
 {pdfError&&<p role="alert">{pdfError}</p>}
 {error?<p role="alert">{error}</p>:!invoice?<p role="status">Loading invoice…</p>:<article>
 <p className="eyebrow">{invoice.businessName}</p>{invoice.businessEmail&&<p>{invoice.businessEmail}</p>}<h1>Invoice {invoice.number}</h1><p>Issued {new Date(invoice.issuedAt).toLocaleDateString('en-US',{timeZone:invoice.timezone})} ({invoice.timezone})</p>
 <section aria-labelledby="invoice-customer"><h2 id="invoice-customer">Customer and service address</h2>{invoice.recipient?<address style={{fontStyle:"normal",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{invoice.recipient.name}<br/>{invoice.recipient.street}<br/>{[invoice.recipient.city,invoice.recipient.region,invoice.recipient.postalCode].filter(Boolean).join(", ")}<br/>{invoice.recipient.email}<br/>{invoice.recipient.phone}</address>:<p className="note">Customer details were not recorded on this older invoice. Contact the business if you need the missing details.</p>}</section>
 <table className="invoice-lines"><caption>Recorded work and approved charges</caption><thead><tr><th scope="col">Work</th><th scope="col">Charge</th></tr></thead><tbody>{invoice.lines.map((line,i)=><tr key={i}><td style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{line.description}</td><td>{line.chargedCents?money(line.chargedCents):'No charge'}</td></tr>)}</tbody></table>
 <p>Invoice total: <strong>{money(invoice.totalCents)}</strong></p><p>Confirmed payments: {money(invoice.paidCents)}</p><p>Remaining balance: <strong>{money(invoice.balanceCents)}</strong></p><h2>Invoice terms</h2><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{invoice.terms}</p>
 </article>}</main>;
}
