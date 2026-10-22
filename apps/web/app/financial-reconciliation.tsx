'use client';
import ProtectedDownload from './protected-download';
import {useEffect,useRef,useState} from 'react';
import {sessionFetch} from '../lib/session-fetch';
import {reconciliationQuery,verifiedReconciliation,reconciliationCsv} from '../lib/financial-reconciliation-contract';
const usd=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
const labels={invoice:'Invoice issued',invoice_credit:'Invoice credit',credit_correction:'Credit correction',receipt:'Payment received',receipt_correction:'Receipt correction / refund',expense:'Expense paid',expense_correction:'Expense correction',processor_fee:'Processor fee'};
type Result=ReturnType<typeof verifiedReconciliation>;
export default function FinancialReconciliation(props:{organization:string;from:string;to:string;disabled:boolean}){return <Report key={props.organization+':'+props.from+':'+props.to} {...props}/>;}
function Report({organization,from,to,disabled}:{organization:string;from:string;to:string;disabled:boolean}){
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(0);
 const mounted=useRef(true),sending=useRef(false),generation=useRef(0),controller=useRef<AbortController|null>(null);
 useEffect(()=>{
 // Capture ref containers so teardown invalidates the latest in-flight generation.
 const teardownMounted=mounted;const teardownGeneration=generation;const teardownController=controller;
 mounted.current=true;return()=>{teardownMounted.current=false;teardownGeneration.current++;teardownController.current?.abort();};},[]);
 useEffect(()=>{if(disabled){generation.current++;controller.current?.abort();sending.current=false;setBusy(false);setResult(null);setError('');}},[disabled]);
 async function load(){if(disabled||sending.current)return;const q=reconciliationQuery.safeParse({organization,from,to});if(!q.success){setError('Choose a valid date range of up to 366 days.');return;}
  const current=++generation.current;const active=new AbortController(),timer=setTimeout(()=>active.abort(),45000);controller.current=active;sending.current=true;setBusy(true);setResult(null);setError('');
  try{const r=await sessionFetch('/api/financial-reconciliation?'+new URLSearchParams(q.data),{cache:'no-store',signal:active.signal}),data=await r.json();if(!mounted.current||current!==generation.current)return;if(!r.ok){setError(typeof data.error==='string'&&data.error.length<=500?data.error:'Reconciliation unavailable.');return;}
   const verified=verifiedReconciliation(data,q.data);setResult(verified);setPage(0);
  }catch{if(mounted.current&&current===generation.current)setError('The complete reconciliation could not be verified. No partial totals are shown.');}
  finally{clearTimeout(timer);if(mounted.current&&current===generation.current){sending.current=false;setBusy(false);}}
 }
 function download(){if(!result||busy||disabled)return;const csv=reconciliationCsv(result.data,{organization,from,to}),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));try{const a=document.createElement('a');a.href=url;a.download=`invoice-receipt-reconciliation-${from}-to-${to}.csv`;a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}}
 const rows=result?.data.rows.slice(page*50,page*50+50)||[];
 return <details className="card"><summary>Reconcile invoices and receipts</summary><p>See why billed amounts and received payments differ, with every saved transaction for the selected dates.</p><button type="button" className="secondary" disabled={disabled||busy} onClick={()=>void load()}>{busy?'Checking complete reconciliation…':'Load reconciliation'}</button>
  {disabled&&<p role="status">Refresh the money report and confirm any pending save before loading this reconciliation.</p>}{error&&<p role="alert">{error}</p>}
  {!disabled&&result&&<><p>Business dates {from} through {to} ({result.data.timezone}). Current saved records, using invoice issue dates, payment received dates and expense dates. Corrections appear on their correction date.</p><dl className="finance-totals">
   <div><dt>Opening amount owed</dt><dd>{usd(result.data.openingReceivableCents)}</dd></div><div><dt>Plus net invoices after credits</dt><dd>{usd(result.totals.invoices)}</dd></div><div><dt>Less net payments received</dt><dd>{usd(result.totals.receipts)}</dd></div><div><dt>Equals closing amount owed</dt><dd>{usd(result.data.closingReceivableCents)}</dd></div><div><dt>Paid expenses after corrections</dt><dd>{usd(result.totals.expenses)}</dd></div><div><dt>Recorded processor fees</dt><dd>{usd(result.totals.fees)}</dd></div><div><dt>Receipts less paid expenses and fees</dt><dd>{usd(result.totals.cashActivity)}</dd></div><div><dt>Billed less paid expenses and fees</dt><dd>{usd(result.totals.billedActivity)}</dd></div>
  </dl><p>Gross invoices and receipts include applicable sales tax and reimbursements. These amounts are not taxable profit. Unpaid bills, depreciation, owner draws, owner tax payments and unrecorded transactions are outside this report. Processor funds are not confirmation of bank payouts.</p><ProtectedDownload organization={organization} filename={`invoice-receipt-reconciliation-${from}-to-${to}.csv`} label="Download complete reconciliation CSV" disabled={busy||disabled} download={download}/>
  {result.data.rows.length===0?<p>No recorded transactions in this range. Opening and closing amounts may still include earlier invoices.</p>:<><p>{result.data.rows.length} transactions · page {page+1} of {Math.ceil(result.data.rows.length/50)}</p><div style={{overflowX:'auto'}}><table><caption>Invoice, receipt and expense detail in USD</caption><thead><tr><th scope="col">Business date</th><th scope="col">Activity</th><th scope="col">Reference</th><th scope="col">Billed</th><th scope="col">Received</th><th scope="col">Expense</th><th scope="col">Fee</th></tr></thead><tbody>{rows.map(r=><tr key={r.kind+':'+r.id}><td>{r.businessDate}</td><th scope="row">{labels[r.kind]}</th><td>{r.kind==='expense'||r.kind==='expense_correction'?r.reference:<a href={'/invoice?'+new URLSearchParams({organization,invoice:r.relatedId})}>{r.reference}</a>}<details><summary>Record reference</summary><p>{r.id}</p></details></td>{[r.invoiceCents,r.receiptCents,r.expenseCents,r.feeCents].map((n,i)=><td key={i} style={{whiteSpace:'nowrap'}}>{usd(n)}</td>)}</tr>)}</tbody></table></div><div className="actions"><button type="button" className="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous transactions</button><button type="button" className="secondary" disabled={(page+1)*50>=result.data.rows.length} onClick={()=>setPage(p=>p+1)}>Next transactions</button></div></>}
  <p>This reconciles saved business activity. It does not file taxes, reconcile a bank statement or connect to QuickBooks.</p></>}
 </details>;
}
