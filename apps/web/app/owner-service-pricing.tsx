'use client';
import type {OwnerPricing} from '../lib/owner-invoice-pricing';
import {allocateActualCents,ownerPricingSchema,pricingTotals} from '../lib/owner-invoice-pricing';
import {invoiceChargeCents} from '../lib/invoice-charge';
import {hourlyCharge} from '../lib/invoice-billing';

export type PriceDraftLine={description:string;method:'fixed'|'hourly';standard:string;billed:string;minutes:string;rate:string};
export type PriceDraft={services:PriceDraftLine[];reason:string;finalTotal:string};
const amount=(cents:number)=>(cents/100).toFixed(2);
const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export function initialPriceDraft(labels:string[],saved:OwnerPricing|null,approvedTotalCents:number,existingChargeCents:number):PriceDraft{
 if(saved)return {reason:saved.reason,finalTotal:amount(pricingTotals(saved).billedCents),services:saved.services.map(s=>({description:s.description,method:s.method,standard:amount(s.standardCents),billed:amount(s.billedCents),minutes:String(s.minutes??''),rate:s.hourlyRateCents===undefined?'':amount(s.hourlyRateCents)}))};
 const services=labels.slice(0,25).map(description=>({description:description.trim().slice(0,160)||'Service performed',method:'fixed' as const,standard:labels.length===1?amount(approvedTotalCents):'',billed:labels.length===1?amount(existingChargeCents):'',minutes:'',rate:''}));
 return {services,reason:'Owner-authorized discretionary pricing',finalTotal:amount(existingChargeCents)};
}
export function parsePriceDraft(draft:PriceDraft):OwnerPricing|null{
 const services=draft.services.map(line=>{
  const billedCents=invoiceChargeCents(line.billed);
  const minutes=Number(line.minutes),hourlyRateCents=invoiceChargeCents(line.rate);
  const standardCents=line.method==='hourly'&&Number.isInteger(minutes)&&minutes>=1&&minutes<=1440&&hourlyRateCents!==null?hourlyCharge(minutes,hourlyRateCents):invoiceChargeCents(line.standard);
  return {description:line.description.trim(),method:line.method,standardCents,billedCents,...(line.method==='hourly'?{minutes,hourlyRateCents}:{})};
 });
 const result=ownerPricingSchema.safeParse({services,reason:draft.reason});
 return result.success?result.data:null;
}
export default function OwnerServicePricing({value,onChange,approvedTotalCents,disabled=false}:{value:PriceDraft;onChange:(next:PriceDraft)=>void;approvedTotalCents:number;disabled?:boolean}){
 const change=(i:number,patch:Partial<PriceDraftLine>)=>onChange({...value,services:value.services.map((s,j)=>j===i?{...s,...patch}:s)});
 const priced=parsePriceDraft(value);
 const standards=value.services.map(l=>l.method==='hourly'&&l.minutes!==''&&l.rate!==''?(()=>{try{return hourlyCharge(Number(l.minutes),invoiceChargeCents(l.rate)??0)}catch{return null}})():invoiceChargeCents(l.standard));
 const standardTotal=standards.every(n=>n!==null)?standards.reduce<number>((s,n)=>s+(n??0),0):null;
 const actualTotal=value.services.map(l=>invoiceChargeCents(l.billed)).every(n=>n!==null)?value.services.reduce((s,l)=>s+(invoiceChargeCents(l.billed)??0),0):null;
 const update=(patch:Partial<PriceDraft>)=>onChange({...value,...patch});
 function distribute(){
  const target=invoiceChargeCents(value.finalTotal);
  if(target===null||standards.some(n=>n===null))return;
  const allocated=allocateActualCents(standards as number[],target);
  if(allocated)update({services:value.services.map((s,i)=>({...s,billed:amount(allocated[i])}))});
 }
 return <section className="owner-invoice-pricing" aria-label="Owner-only service pricing">
  <h3>Services & final charges</h3>
  <p>Only the final service description and agreed amount go on the customer invoice. Standard prices, calculations and your pricing decision stay in the owner record.</p>
  <p className="tiny">Original agreed labor estimate: {money(approvedTotalCents)}. Enter the normal value of each requested service; no prices are guessed.</p>
  {value.services.map((line,i)=><fieldset key={i} className="owner-price-service">
   <legend>{line.description}</legend>
   <label>Service description<input maxLength={160} required value={line.description} onChange={e=>change(i,{description:e.target.value})}/></label>
   <label>Normal pricing method<select value={line.method} onChange={e=>change(i,{method:e.target.value as PriceDraftLine['method']})}><option value="fixed">Fixed price</option><option value="hourly">Hourly calculation</option></select></label>
   {line.method==='hourly'?<div className="owner-price-hourly">
    <label>Hours worked (minutes)<input inputMode="numeric" type="number" min={1} max={1440} value={line.minutes} onChange={e=>change(i,{minutes:e.target.value})}/></label>
    <label>Normal hourly rate ($)<input inputMode="decimal" value={line.rate} onChange={e=>change(i,{rate:e.target.value})}/></label>
    <p>Normal charge: {standards[i]!==null?money(standards[i]!):'Enter time and rate'}</p>
   </div>:<label>Standard charge ($)<input inputMode="decimal" placeholder="0.00" required value={line.standard} onChange={e=>change(i,{standard:e.target.value})}/></label>}
   <label>Actual billed ($)<input inputMode="decimal" placeholder="0.00" required value={line.billed} onChange={e=>change(i,{billed:e.target.value})}/></label>
  </fieldset>)}
  <div className="owner-price-summary">
   <p>Normal service value: <strong>{standardTotal===null?'Enter the standard charges':money(standardTotal)}</strong></p>
   <label>Final invoice total ($)<input inputMode="decimal" value={value.finalTotal} onChange={e=>update({finalTotal:e.target.value})}/></label>
   <button type="button" className="secondary" disabled={disabled||standardTotal===null||invoiceChargeCents(value.finalTotal)===null||invoiceChargeCents(value.finalTotal)!>standardTotal} onClick={distribute}>Apply total across services</button>
   <p>Actual billed from service rows: <strong>{actualTotal===null?'Complete each service':money(actualTotal)}</strong></p>
   {priced&&<p>Owner-only discretionary reduction: <strong>{money(pricingTotals(priced).reductionCents)}</strong></p>}
   <label>Private pricing note<input maxLength={500} value={value.reason} onChange={e=>update({reason:e.target.value})}/></label>
   {!priced&&<p role="status">Complete normal and actual charges for each service. Actual charges cannot exceed their standard charge, and a reduced total needs a private reason.</p>}
  </div>
 </section>;
}
