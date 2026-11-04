'use client';
import {useEffect,useState} from 'react';
import {sessionFetch} from '../../../lib/session-fetch';
import {financeResult,type FinanceResult} from '../../../lib/expense-contract';
const usd=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
type Mileage={businessMiles:number;activeTrips:number;from:string;to:string;page:number};
const yearSpan=(year:number)=>({from:year+'-01-01',to:year+'-12-31'});
/** Reconciled income-tax preparation inputs. These are records, NOT a tax return or profit certification. */
export default function BusinessIncomeRecords({organization,year}:{organization:string;year:number}){
 const [current,setCurrent]=useState<{data:FinanceResult;mileage:Mileage|null}|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let live=true;const abort=new AbortController();setCurrent(null);setLoading(true);setError('');
  const {from,to}=yearSpan(year);
  const qs=new URLSearchParams({organization,from,to,page:'0'});
  async function read(){
   try{
    const [financeResponse,milesResponse]=await Promise.all([
     sessionFetch('/api/finance-activity?'+qs,{signal:abort.signal,cache:'no-store'}),
     sessionFetch('/api/mileage?'+qs,{signal:abort.signal,cache:'no-store'})
    ]);
    if(!financeResponse.ok)throw Error('Financial report unavailable');
    const finance=financeResult.parse(await financeResponse.json());
    const raw=milesResponse.ok?await milesResponse.json():null;
    const mileage=raw&&raw.from===from&&raw.to===to&&raw.page===0&&Number.isInteger(raw.businessMiles)&&raw.businessMiles>=0&&Number.isInteger(raw.activeTrips)&&raw.activeTrips>=0?{businessMiles:raw.businessMiles,activeTrips:raw.activeTrips,from,to,page:0}:null;
    if(finance.report.from!==from||finance.report.to!==to)throw Error('Period mismatch');
    if(live){setCurrent({data:finance,mileage});setError('');}
   }catch{if(live&&!abort.signal.aborted){setCurrent(null);setError('Business income records could not be verified. Refresh before relying on these figures.');}}
   finally{if(live)setLoading(false);}
  }
  void read();return()=>{live=false;abort.abort();};
 },[organization,year,reload]);
 const report=current?.data.report;
 return <section className="card" aria-labelledby="tax-income-records-title">
  <div className="section-heading"><div><h2 id="tax-income-records-title">{year} business income records</h2><p>Read-only figures from YNSG's saved payment, expense and mileage records.</p></div><button type="button" disabled={loading} onClick={()=>setReload(v=>v+1)}>Refresh records</button></div>
  {loading&&<p role="status">Checking recorded income, expenses and miles…</p>}
  {error&&<p role="alert">{error}</p>}
  {report&&current&&<><div className="metric-grid">
    <p>Customer payments recorded<br/><strong>{usd(report.cashReceivedCents)}</strong></p>
    <p>Recorded business expenses<br/><strong>{usd(report.expenseCents)}</strong></p>
    <p>Cash after recorded fees and expenses<br/><strong>{usd(report.cashAfterExpensesCents)}</strong></p>
    <p>Business miles recorded<br/><strong>{current.mileage?current.mileage.businessMiles.toLocaleString('en-US'):'Unavailable'}</strong></p>
   </div>
   <p className="note">These are bookkeeping inputs, <strong>not taxable profit or a tax-due calculation</strong>. Cash records may omit unentered transactions and adjustments. Expense categories are not automatically deductible; miles are not automatically a deduction. Reconcile bank deposits, receipts, vehicle method, equipment purchases, owner contributions and draws, and your accounting method before filing. Do not deduct mileage and actual vehicle costs for the same vehicle without checking the applicable rules.</p>
   <p>{report.paymentCount} recorded customer payments · {report.expenseCount} active expense entries · {current.mileage?current.mileage.activeTrips+' business trips':'Mileage could not be verified; review the saved trips separately.'} Invoice amounts and unpaid balances are not added to cash receipts.</p>
  </>}
  <div className="actions"><a href={'/owner?'+new URLSearchParams({organization,section:'Money'})}>Review income, expenses and receipts</a><a href={'/owner?'+new URLSearchParams({organization,section:'Money'})}>Review mileage records</a></div>
 </section>;
}
