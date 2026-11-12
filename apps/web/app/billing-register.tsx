'use client';

import {useState} from 'react';
import type {InvoiceCredit} from '../lib/invoice-credit-contract';
import {creditTotal} from '../lib/invoice-credit-contract';
import {invoiceNumber} from '../lib/invoice-number';
import InvoiceDelivery from './invoice-delivery';
import InvoicePayments from './invoice-payments';
import RelatedCustomerFiles from './related-customer-files';
import Icon from './crm-icons';

type Invoice={id:string;customer_id?:string;job_id:string;number:number;total_cents:number;issued_at:string;snapshot?:{recipient?:{name?:string;street?:string;city?:string};scope?:string};credits?:InvoiceCredit[];payments:{cents:number}[]};
type Link={request?:string;customer?:string};
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const balance=(invoice:Invoice)=>invoice.total_cents-creditTotal(invoice.credits)-invoice.payments.reduce((total,payment)=>total+payment.cents,0);

export default function BillingRegister({organization,timezone,invoices,links,admin,canManage,canFinance,blocked,onOpen,onCustomer,onChanged}:{organization:string;timezone:string;invoices:Invoice[];links:Record<string,Link>;admin:Record<string,{archived:boolean;cardPending:boolean}>;canManage:boolean;canFinance:boolean;blocked:boolean;onOpen:(request:string)=>void;onCustomer:(customer:string)=>void;onChanged:()=>void}){
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all');
  const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const shown=invoices.filter(invoice=>{
    const text=[invoiceNumber(invoice.number),invoice.snapshot?.recipient?.name,invoice.snapshot?.recipient?.street,invoice.snapshot?.scope].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term))&&(filter==='all'||(filter==='due'?balance(invoice)>0:balance(invoice)===0));
  });
  return <section className="billing-register" aria-label="Invoice register">
    {invoices.length>0&&(()=>{const open=invoices.filter(i=>balance(i)>0),owed=open.reduce((n,i)=>n+balance(i),0);return <p className="register-owed" role="status"><strong>{owed>0?money(owed)+' still owed':'Everything is paid'}</strong>{owed>0&&' across '+open.length+(open.length===1?' invoice':' invoices')}</p>;})()}
    <div className="register-toolbar"><label><span>Find an invoice</span><div className="register-search"><Icon name="search"/><input type="search" maxLength={200} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Customer, invoice or address"/></div></label><label><span>Show</span><select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All invoices</option><option value="due">Balance due</option><option value="settled">Settled</option></select></label></div>
    <p className="register-count" role="status">{shown.length} {shown.length===1?'invoice':'invoices'}</p>
    <div className="register-columns" aria-hidden="true"><span>Invoice / customer</span><span>Issued</span><span>Balance</span></div>
    {invoices.map(invoice=><InvoiceRow key={invoice.id} invoice={invoice} hidden={!shown.includes(invoice)} organization={organization} timezone={timezone} link={links[invoice.id]||{}} admin={admin[invoice.id]} canManage={canManage} canFinance={canFinance} blocked={blocked} onOpen={onOpen} onCustomer={onCustomer} onChanged={onChanged}/>)}
    {!shown.length&&<div className="register-empty"><h2>{invoices.length?'No matching invoices':'No issued invoices'}</h2><p>{invoices.length?'Try another customer, invoice number or status.':'Completed visits appear here when their invoices are issued.'}</p>{(query||filter!=='all')&&<button type="button" className="secondary" onClick={()=>{setQuery('');setFilter('all');}}>Clear filters</button>}</div>}
  </section>;
}

function InvoiceRow({invoice,hidden,organization,timezone,link,admin,canManage,canFinance,blocked,onOpen,onCustomer,onChanged}:{invoice:Invoice;hidden:boolean;organization:string;timezone:string;link:Link;admin?:{archived:boolean;cardPending:boolean};canManage:boolean;canFinance:boolean;blocked:boolean;onOpen:(request:string)=>void;onCustomer:(customer:string)=>void;onChanged:()=>void}){
  // Read payment/delivery/files only after the invoice is opened; keep mounted drafts when collapsed.
  const [opened,setOpened]=useState(false);
  const remaining=balance(invoice);
  const issued=Number.isFinite(Date.parse(invoice.issued_at));
  const state=invoice.total_cents===0?'No charge':remaining===0?creditTotal(invoice.credits)>0?'Paid (credit applied)':'Paid':remaining<invoice.total_cents?'Partly paid':'Not paid yet';
  return <details className="money-invoice" hidden={hidden} onToggle={event=>{if(event.currentTarget.open)setOpened(true);}}>
    <summary><span><strong>Invoice {invoiceNumber(invoice.number)}</strong><span>{invoice.snapshot?.recipient?.name||'Customer on issued invoice'}</span></span><time dateTime={issued?invoice.issued_at:undefined}>{issued?new Intl.DateTimeFormat('en-US',{timeZone:timezone,month:'short',day:'numeric',year:'numeric'}).format(new Date(invoice.issued_at)):'Date unavailable'}</time><span className="money-invoice-balance"><strong>{money(remaining)}</strong><span>{state}</span></span></summary>
    {opened&&<div className="money-invoice-actions">
      <div className="register-record-heading"><div><p>{[invoice.snapshot?.recipient?.street,invoice.snapshot?.recipient?.city].filter(Boolean).join(', ')}</p><p>{invoice.snapshot?.scope}</p></div>{canManage&&link.request&&<button type="button" className="secondary" disabled={blocked} onClick={()=>onOpen(link.request!)}>Open job<Icon name="arrow"/></button>}</div>
      {admin?.archived&&<span className="badge">Archived</span>}{admin?.cardPending&&<span className="badge">Card payment pending</span>}
      <a className="register-document-link" href={'/invoice?'+new URLSearchParams({organization,invoice:invoice.id,...(link.request?{request:link.request}:{})})}>View / print invoice</a>
      {canManage&&<details><summary>Email invoice</summary><InvoiceDelivery organization={organization} invoice={invoice.id}/></details>}
      {canManage&&link.customer&&<RelatedCustomerFiles organization={organization} customer={link.customer} targets={[{kind:'invoice',id:invoice.id},{kind:'job',id:invoice.job_id}]} disabled={blocked} onManage={()=>onCustomer(link.customer!)}/>}
      {canFinance&&<InvoicePayments streamlined organization={organization} invoice={invoice.id} totalCents={invoice.total_cents} timezone={timezone} onChanged={onChanged}/>}
    </div>}
  </details>;
}
