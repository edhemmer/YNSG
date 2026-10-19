import {z} from 'zod';
export const accountingQuery=z.object({organization:z.uuid(),from:z.iso.date().regex(/^(?!0000-)/),to:z.iso.date().regex(/^(?!0000-)/)}).strict().refine(v=>v.from<=v.to&&(Date.parse(v.to)-Date.parse(v.from))/86400000<=366);
const cents=z.number().int().min(0).max(2147483647);
export const accountingExport=z.object({organization:z.uuid(),from:z.iso.date(),to:z.iso.date(),timezone:z.string().min(1).max(80),complete:z.literal(true),rows:z.array(z.object({lineId:z.uuid(),entryId:z.uuid(),postedAt:z.iso.datetime({offset:true}),businessDate:z.iso.date(),sourceKind:z.enum(['invoice','payment','reversal','expense','credit']),sourceId:z.uuid(),account:z.enum(['receivable','labor_revenue','cash','reimbursements','expenses','tax_payable','stripe_clearing']),debitCents:cents,creditCents:cents}).strict().refine(v=>(v.debitCents>0&&v.creditCents===0)||(v.creditCents>0&&v.debitCents===0))).max(10000)}).strict();
export function verifiedAccountingExport(raw:unknown,query:z.infer<typeof accountingQuery>){
 const data=accountingExport.parse(raw);if(data.organization!==query.organization||data.from!==query.from||data.to!==query.to)throw Error('UNVERIFIED');
 const seen=new Set<string>(),entries=new Map<string,{sum:number;count:number;source:string}>();
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:data.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
 for(const r of data.rows){const parts=Object.fromEntries(date.formatToParts(new Date(r.postedAt)).map(p=>[p.type,p.value]));const businessDate=`${parts.year}-${parts.month}-${parts.day}`;if(seen.has(r.lineId)||r.businessDate<data.from||r.businessDate>data.to||businessDate!==r.businessDate)throw Error('UNVERIFIED');seen.add(r.lineId);const source=[r.sourceKind,r.sourceId,r.postedAt].join(':');const entry=entries.get(r.entryId)||{sum:0,count:0,source};if(entry.source!==source)throw Error('UNVERIFIED');entry.sum+=r.debitCents-r.creditCents;entry.count++;if(!Number.isSafeInteger(entry.sum))throw Error('UNVERIFIED');entries.set(r.entryId,entry);}

 if([...entries.values()].some(e=>e.sum!==0||e.count<2))throw Error('UNBALANCED_EXPORT');return data;
}
const cell=(s:string)=>'"'+(/^[=+\-@\t\r]/.test(s)?"'":"")+s.replaceAll('"','""')+'"';
const dollars=(c:number)=>Math.floor(c/100)+'.'+String(c%100).padStart(2,'0');
export function accountingCsv(raw:unknown,query:z.infer<typeof accountingQuery>){const data=verifiedAccountingExport(raw,query);return '\uFEFF'+[['Business date','Posted at (UTC offset)','Entry ID','Line ID','Source','Source ID','Account','Debit USD','Credit USD','Debit cents','Credit cents'],...data.rows.map(r=>[r.businessDate,r.postedAt,r.entryId,r.lineId,r.sourceKind,r.sourceId,r.account,dollars(r.debitCents),dollars(r.creditCents),String(r.debitCents),String(r.creditCents)])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
