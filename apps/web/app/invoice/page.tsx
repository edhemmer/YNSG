"use client";
import {useEffect,useState} from 'react';
import {sessionFetch} from '../../lib/session-fetch';
import type {InvoiceDocument} from '../../lib/invoice-document';
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function InvoicePage(){
 const [invoice,setInvoice]=useState<InvoiceDocument|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const q=new URLSearchParams(window.location.search);
 sessionFetch('/api/invoice-document?'+new URLSearchParams({organization:q.get('organization')||'',invoice:q.get('invoice')||''})).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setInvoice(d.invoice)}).catch(e=>{if(active)setError(e.message)});
 return()=>{active=false};},[]);
 return <main className="shell" id="main"><style>{'@media print {.invoice-actions,.skip{display:none!important} .shell{max-width:none;margin:0;padding:0} .invoice-lines tr{break-inside:avoid} body{background:white;color:black}}'}</style>
 <div className="invoice-actions"><a href="/owner">Back to workspace</a>{invoice&&<button onClick={()=>window.print()}>Print / save as PDF</button>}</div>
 {error?<p role="alert">{error}</p>:!invoice?<p role="status">Loading invoice…</p>:<article>
 <p>{invoice.businessName}</p><h1>Invoice {invoice.number}</h1><p>Issued {new Date(invoice.issuedAt).toLocaleDateString('en-US',{timeZone:invoice.timezone})} ({invoice.timezone})</p>
 <table className="invoice-lines"><caption>Recorded work and approved charges</caption><thead><tr><th scope="col">Work</th><th scope="col">Charge</th></tr></thead><tbody>{invoice.lines.map((line,i)=><tr key={i}><td style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{line.description}</td><td>{line.chargedCents?money(line.chargedCents):'No charge'}</td></tr>)}</tbody></table>
 <p>Invoice total: <strong>{money(invoice.totalCents)}</strong></p><p>Confirmed payments: {money(invoice.paidCents)}</p><p>Remaining balance: <strong>{money(invoice.balanceCents)}</strong></p><h2>Invoice terms</h2><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{invoice.terms}</p>
 </article>}</main>;
}
