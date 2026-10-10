"use client";
import type {InvoiceDocument} from "../lib/invoice-document";
const money=(c:number)=>(c/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
export default function InvoiceView({invoice}:{invoice:InvoiceDocument}) {return <article>
 {invoice.sample&&<p role="note" className="note"><strong>SAMPLE — NOT A BILL.</strong> No work, payment or amount due has been recorded.</p>}
 <p className="eyebrow">{invoice.businessName}</p>{invoice.businessEmail&&<p>{invoice.businessEmail}</p>}<h1>Invoice {invoice.number}</h1><p>Issued {new Date(invoice.issuedAt).toLocaleDateString('en-US',{timeZone:invoice.timezone})} ({invoice.timezone})</p>
 <section aria-labelledby="invoice-customer"><h2 id="invoice-customer">Customer and service address</h2>{invoice.recipient?<address style={{fontStyle:"normal",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{invoice.recipient.name}<br/>{invoice.recipient.street}<br/>{[invoice.recipient.city,invoice.recipient.region,invoice.recipient.postalCode].filter(Boolean).join(", ")}<br/>{invoice.recipient.email}<br/>{invoice.recipient.phone}</address>:<p className="note">Customer details were not recorded on this older invoice. Contact the business if you need the missing details.</p>}</section>
 <table className="invoice-lines"><caption>Recorded work and approved charges</caption><thead><tr><th scope="col">Work</th><th scope="col">Charge</th></tr></thead><tbody>{invoice.lines.map((line,i)=><tr key={i}><td style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{line.description}</td><td>{line.chargedCents?money(line.chargedCents):'No charge'}</td></tr>)}</tbody></table>
 <p>Invoice total: <strong>{money(invoice.totalCents)}</strong></p><p>Confirmed payments: {money(invoice.paidCents)}</p><p>Remaining balance: <strong>{money(invoice.balanceCents)}</strong></p><h2>Invoice terms</h2><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{invoice.terms}</p>
 </article>;}
