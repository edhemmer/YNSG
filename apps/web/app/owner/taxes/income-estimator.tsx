'use client';
import {useState} from 'react';
import {invoiceChargeCents} from '../../../lib/invoice-charge';
import {basicDeduction2026,ownerIncomeEstimate,type FilingStatus,type IncomeTaxInput} from '../../../lib/income-tax';
import {taxSources} from '../../../lib/taxes';
export type EstimateDraft={federalAnnualPaymentCents:number;stateAnnualPaymentCents:number;reviewNote:string;state:'IL'};
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
const fields=[
 ['taxableIncomeCents','Federal taxable income after all deductions ($)',undefined],
 ['netProfitCents','Your net self-employment profit after business expenses ($)',undefined],
 ['socialSecurityWagesCents','Your wages subject to Social Security ($)','0'],
 ['medicareWagesCents','Medicare wages — include both spouses if filing jointly ($)','0'],
 ['federalNonrefundableCreditsCents','Federal nonrefundable income-tax credits ($)','0'],
 ['federalWithholdingAndRefundableCreditsCents','Federal withholding and refundable credits ($)','0'],
 ['otherFederalTaxesCents','Other federal taxes from your worksheet ($)','0'],
 ['stateBaseIncomeCents','Illinois base income before state exemptions ($)',undefined],
 ['stateExemptionsCents','Illinois exemption amount from your worksheet ($)',undefined],
 ['stateSurchargesCents','Illinois applicable surcharges ($)','0'],
 ['stateWithholdingAndCreditsCents','Illinois withholding and all applicable credits ($)','0'],
] as const;
export default function IncomeEstimator({year,state,canEdit,onUse}:{year:number;state:string;canEdit:boolean;onUse:(draft:EstimateDraft)=>void}){
 const [status,setStatus]=useState<FilingStatus|''>(''),[error,setError]=useState(''),[calculation,setCalculation]=useState<{input:IncomeTaxInput;result:ReturnType<typeof ownerIncomeEstimate>}|null>(null);
 const supported=year===2026&&state==='IL';
 return <section className="card" aria-labelledby="income-estimate-title"><h2 id="income-estimate-title">Owner income tax review</h2>
 <p>Owner state: <strong>{state||'Not set'}</strong> · tax year {year}. Rules checked October 13, 2026.</p>
 {!supported?<p className="note">{!state?'Set the owner’s state in reviewed tax setup below.':`Automatic income estimates are not verified for ${state} ${year}.`} Use a completed state worksheet; no Illinois rate or prior-year federal rate is substituted.</p>:<>
 <p>Illinois income tax: <strong>4.95%</strong> of Illinois net income after exemptions. Federal income tax: <strong>10%–37% progressive brackets</strong>, based on filing status. Self-employment tax is calculated separately: 12.4% Social Security up to the remaining $184,500 wage base, plus 2.9% Medicare on 92.35% of net profit; applicable 0.9% Additional Medicare is included.</p>
 <p>Use projected full-year income, including income outside this CRM. Federal taxable income must already include your applicable deductions, including the deductible half of self-employment tax and any qualified business income deduction. Illinois starts with its own base income; federal taxable income is not substituted.</p>
 <form onChange={()=>{setCalculation(null);setError('');}} onSubmit={e=>{e.preventDefault();setCalculation(null);setError('');try{
  const f=new FormData(e.currentTarget);const amounts=Object.fromEntries(fields.map(([key])=>{const value=invoiceChargeCents(String(f.get(key)||''));if(value===null)throw Error('Enter each amount in dollars with up to two decimal places.');return [key,value];}));
  const input={...amounts,year:2026,state,status} as IncomeTaxInput;const result=ownerIncomeEstimate(input);setCalculation({input,result});
 }catch{setError('Check your filing status and every amount. Use zero only where it applies.');}}}>
 <label>Federal filing status<select required value={status} onChange={e=>setStatus(e.target.value as FilingStatus)}><option value="">Choose filing status</option><option value="single">Single</option><option value="joint">Married filing jointly</option><option value="separate">Married filing separately</option><option value="head">Head of household</option><option value="surviving">Qualifying surviving spouse</option></select></label>
 {status!==''&&<p className="note">Basic 2026 standard deduction: {money(basicDeduction2026[status]*100)}. Age, blindness, dependent status and other rules can change this. It is a reference amount; it is not subtracted again from the taxable income you enter.</p>}
 {fields.map(([key,label,initial])=><label key={key}>{label}<input name={key} required inputMode="decimal" defaultValue={initial}/></label>)}
 <label><input type="checkbox" required/>This is an individual calendar-year return for a full-year Illinois resident with ordinary taxable income and one person’s self-employment profit. I have no spouse self-employment, capital gains, qualified dividends, railroad income, foreign income or special SE exemptions requiring a different calculation.</label>
 <button>Calculate income tax estimate</button></form>
 {error&&<p role="alert" className="note">{error}</p>}
 {calculation&&<div role="status" className="card"><h3>Your {year} income tax estimate</h3><dl>
 <dt>Federal ordinary income tax before credits</dt><dd>{money(calculation.result.income.taxCents)}</dd>
 <dt>Self-employment tax</dt><dd>{money(calculation.result.selfEmploymentCents)}</dd>
 <dt>Deductible half of self-employment tax — include in your income worksheet</dt><dd>{money(calculation.result.halfSeDeductionCents)}</dd>
 <dt>Additional Medicare tax</dt><dd>{money(calculation.result.additionalMedicareCents)}</dd>
 <dt>Federal projected balance after supplied taxes, credits and withholding</dt><dd>{money(calculation.result.federalNetCents)}</dd>
 <dt>Illinois net income after supplied exemptions</dt><dd>{money(calculation.result.stateNetIncomeCents)}</dd>
 <dt>Illinois projected balance after supplied surcharges, credits and withholding</dt><dd>{money(calculation.result.stateNetCents)}</dd></dl>
 <p>Federal bands used: {calculation.result.income.bands.map(b=>`${b.rate}% on ${money(b.baseCents)}`).join(' · ')||'No taxable income'}.</p>
 <p>Suggested full-balance payment plan: federal {money(calculation.result.federalAnnualPaymentCents)}; Illinois {money(calculation.result.stateAnnualPaymentCents)}. This plans the full projected balance, not the minimum safe-harbor amount. IRS 90% current-year / 100% prior-year rules (110% for certain higher incomes), exceptions and uneven-income installments require the completed worksheet. Already recorded estimated payments are allocated separately in the payment calendar.</p>
 {canEdit&&<button type="button" onClick={()=>onUse({state:'IL',federalAnnualPaymentCents:calculation.result.federalAnnualPaymentCents,stateAnnualPaymentCents:calculation.result.stateAnnualPaymentCents,reviewNote:`2026 IL ordinary-income projection; verified 2026-10-13; ${calculation.input.status}; cents: `+fields.map(([key],i)=>`${['federalTaxable','netProfit','ssWages','medicareWages','nonrefundCredits','fedWithholdingRefund','otherFedTax','ilBase','ilExemptions','ilSurcharges','ilWithholdingCredits'][i]}=${calculation.input[key]}`).join('; ')})}>Use estimate in setup for review</button>}
 <p>Review and publish the setup below to save a payment plan. This calculation does not approve customer invoice sales tax or record a payment.</p></div>}
 </>}
 <p><a href={taxSources.federal} target="_blank" rel="noopener noreferrer">IRS 2026 worksheet and brackets</a> · <a href={taxSources.illinois} target="_blank" rel="noopener noreferrer">Illinois 2026 worksheet</a></p>
 </section>;
}
