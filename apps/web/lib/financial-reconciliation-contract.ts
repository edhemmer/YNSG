import {z} from 'zod';
import {accountingQuery} from './accounting-export-contract.ts';
export const reconciliationQuery=accountingQuery.refine(q=>q.to<'9999-12-31');
const integer=z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
export const reconciliationRow=z.object({kind:z.enum(['invoice','receipt','receipt_correction','expense','expense_correction','processor_fee']),id:z.string().min(1).max(500),relatedId:z.uuid(),reference:z.string().min(1).max(160),businessDate:z.iso.date(),invoiceCents:integer,receiptCents:integer,expenseCents:integer,feeCents:integer}).strict().superRefine((r,c)=>{
 const values=[r.invoiceCents,r.receiptCents,r.expenseCents,r.feeCents];let valid=false;
 if(r.kind==='invoice')valid=r.invoiceCents>=0&&values.slice(1).every(v=>v===0)&&r.id===r.relatedId;
 if(r.kind==='receipt'||r.kind==='receipt_correction')valid=r.invoiceCents===0&&r.expenseCents===0&&r.feeCents===0&&(r.kind==='receipt'?r.receiptCents>0:r.receiptCents<0);
 if(r.kind==='expense'||r.kind==='expense_correction')valid=r.invoiceCents===0&&r.receiptCents===0&&r.feeCents===0&&(r.kind==='expense'?r.expenseCents>0:r.expenseCents<0)&&r.id===r.relatedId;
 if(r.kind==='processor_fee')valid=r.invoiceCents===0&&r.receiptCents===0&&r.expenseCents===0&&r.feeCents!==0;
 if(r.kind!=='processor_fee'&&!z.uuid().safeParse(r.id).success)valid=false;
 if(!valid)c.addIssue({code:'custom',message:'Inconsistent financial row'});
});
export const reconciliationReport=z.object({organization:z.uuid(),from:z.iso.date(),to:z.iso.date(),timezone:z.string().min(1).max(80),complete:z.literal(true),openingReceivableCents:integer,closingReceivableCents:integer,rows:z.array(reconciliationRow).max(10000)}).strict();
export type ReconciliationReport=z.infer<typeof reconciliationReport>;
const sum=(a:number,b:number)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error('UNVERIFIED');return n;};
export function verifiedReconciliation(raw:unknown,q:z.infer<typeof reconciliationQuery>){
 const data=reconciliationReport.parse(raw);if(data.organization!==q.organization||data.from!==q.from||data.to!==q.to)throw Error('UNVERIFIED');
 new Intl.DateTimeFormat('en-US',{timeZone:data.timezone});const seen=new Set<string>();let invoices=0,receipts=0,expenses=0,fees=0;
 for(const r of data.rows){const key=r.kind+':'+r.id;if(seen.has(key)||r.businessDate<q.from||r.businessDate>q.to)throw Error('UNVERIFIED');seen.add(key);invoices=sum(invoices,r.invoiceCents);receipts=sum(receipts,r.receiptCents);expenses=sum(expenses,r.expenseCents);fees=sum(fees,r.feeCents);}
 if(sum(sum(data.openingReceivableCents,invoices),-receipts)!==data.closingReceivableCents)throw Error('UNRECONCILED');
 return {data,totals:{invoices,receipts,expenses,fees,cashActivity:sum(sum(receipts,-expenses),-fees),billedActivity:sum(sum(invoices,-expenses),-fees)}};
}
const cell=(s:string)=>'"'+(/^[=+\-@\t\r]/.test(s)?"'":"")+s.replaceAll('"','""')+'"';
export function reconciliationCsv(raw:unknown,q:z.infer<typeof reconciliationQuery>){const {data:d,totals:t}=verifiedReconciliation(raw,q);return '\uFEFF'+[
 ['Invoice and receipt reconciliation — cents USD'],['From',d.from,'Through',d.to,'Timezone',d.timezone],['Opening receivable cents',String(d.openingReceivableCents)],['Invoices issued cents',String(t.invoices)],['Net receipts cents',String(t.receipts)],['Closing receivable cents',String(d.closingReceivableCents)],['Net paid expenses cents',String(t.expenses)],['Processor fees cents',String(t.fees)],['Receipts less expenses and fees cents',String(t.cashActivity)],['Billed less expenses and fees cents',String(t.billedActivity)],
 ['Business date','Activity','Record ID','Related invoice or expense ID','Reference','Invoice cents','Receipt cents','Expense cents','Fee cents'],...d.rows.map(r=>[r.businessDate,r.kind,r.id,r.relatedId,r.reference,String(r.invoiceCents),String(r.receiptCents),String(r.expenseCents),String(r.feeCents)]),
 ['Scope','Current saved records by effective business date. Gross invoices and receipts include applicable sales tax and reimbursements. Paid expenses only; no unpaid bills, depreciation, owner draws/tax payments or unrecorded transactions. Not taxable profit, a tax return, bank reconciliation or QuickBooks connection.']
 ].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
