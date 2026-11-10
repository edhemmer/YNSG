'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {ownerPricingSchema,pricingTotals,type OwnerPricing} from '../lib/owner-invoice-pricing';

const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function OwnerInvoicePricingSummary({organization,job}:{organization:string;job:string}){
 const [pricing,setPricing]=useState<OwnerPricing|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'missing'|'error'>('loading');
 useEffect(()=>{
  const controller=new AbortController();let active=true;setStatus('loading');setPricing(null);
  void sessionFetch('/api/invoice-owner-pricing?'+new URLSearchParams({organization,job}),{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error('Unable to retrieve the private pricing record.');
   const data=await response.json();const result=data.pricing?ownerPricingSchema.parse(data.pricing):null;
   if(active){setPricing(result);setStatus(result?'ready':'missing');}
  }).catch(()=>{if(active&&!controller.signal.aborted)setStatus('error');});
  return()=>{active=false;controller.abort();};
 },[organization,job]);
 if(status==='missing')return null;
 return <details className="owner-invoice-pricing-summary">
  <summary>Owner-only service value & pricing history</summary>
  {status==='loading'&&<p role="status">Loading private invoice calculation…</p>}
  {status==='error'&&<p role="alert">Private pricing history could not be loaded. This does not change the issued invoice.</p>}
  {pricing&&<><table><thead><tr><th scope="col">Service</th><th scope="col">Standard</th><th scope="col">Billed</th></tr></thead><tbody>{pricing.services.map((line,i)=><tr key={i}><td>{line.description}<small>{line.method==='hourly'?`Hourly · ${line.minutes} minutes at ${money(line.hourlyRateCents||0)}/hour`:'Fixed rate'}</small></td><td>{money(line.standardCents)}</td><td>{money(line.billedCents)}</td></tr>)}</tbody></table>
  <p>Normal value: <strong>{money(pricingTotals(pricing).standardCents)}</strong></p>
  <p>Actual billed: <strong>{money(pricingTotals(pricing).billedCents)}</strong></p>
  <p>Internal discretionary reduction: <strong>{money(pricingTotals(pricing).reductionCents)}</strong></p>
  <p>Private note: {pricing.reason||'Standard pricing used'}</p>
  <p className="tiny">This information is never included in the customer invoice, email, or PDF.</p></>}
 </details>;
}
