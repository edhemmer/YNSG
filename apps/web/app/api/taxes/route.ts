import {invoiceNumber} from "../../../lib/invoice-number";
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {taxProfileSchema,taxCsv,estimatedInstallments} from '../../../lib/taxes';
import {MAX_TAX_ENTRY_BYTES,taxEntryCommand,taxWorkspaceData,validateTaxReceipt,taxEntryFailure} from '../../../lib/tax-entry-contract';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,query=z.object({organization:z.uuid(),year:z.coerce.number().int().min(2026).max(2100)}).safeParse({organization:q.get('organization'),year:q.get('year')});if(!query.success)return NextResponse.json({error:'Choose a valid company and tax year.'},{status:400,headers});const {organization,year}=query.data;
 const {db}=await authenticated();const r=await db.rpc('tax_workspace',{p_org:organization,p_year:year});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);
 if(q.get('format')==='csv'){
  const d=taxWorkspaceData.parse(r.data),rows:Record<string,string|number|null>[]=[];
  for(const i of d.invoices){const snapshot=i.tax,components=snapshot?.components||[];
   if(!snapshot||!('rule' in snapshot)||!components.length)rows.push({record_type:'invoice',id:i.id,invoice_number:invoiceNumber(i.number),tax_year:year,date:i.issuedAt,subtotal_cents:i.subtotalCents,tax_cents:i.taxCents,total_cents:i.totalCents,paid_cents:i.paidCents,balance_cents:i.totalCents-i.paidCents-i.creditedCents,treatment:'Legacy reviewed non-taxable labor; see invoice configuration'});
   else {rows.push({record_type:"invoice",id:i.id,invoice_number:invoiceNumber(i.number),tax_year:year,date:i.issuedAt,subtotal_cents:i.subtotalCents,tax_cents:i.taxCents,total_cents:i.totalCents,paid_cents:i.paidCents,balance_cents:i.totalCents-i.paidCents-i.creditedCents});for(const c of components)rows.push({record_type:'invoice_tax_component',id:i.id,invoice_number:invoiceNumber(i.number),tax_year:year,date:i.issuedAt,tax_kind:c.kind,jurisdiction:c.label,rate_ppm:c.ratePpm,tax_base_cents:c.baseCents,component_tax_cents:c.taxCents,source_url:snapshot.rule.sourceUrl,rule_id:snapshot.rule.id,profile_version:snapshot.profileVersion,treatment:snapshot.rule.scope});}
  }
  for(const c of d.credits){rows.push({record_type:c.reversesId?'invoice_credit_correction':'invoice_credit',id:c.id,invoice_number:invoiceNumber(c.invoiceNumber),tax_year:year,date:c.issuedAt,subtotal_cents:-c.subtotalCents,tax_cents:-c.taxComponents.reduce((n,t)=>n+t.taxCents,0),total_cents:-c.totalCents,reverses_id:c.reversesId,notes:c.reason});for(const t of c.taxComponents)rows.push({record_type:'credit_tax_component',id:c.id,invoice_number:invoiceNumber(c.invoiceNumber),tax_year:year,date:c.issuedAt,tax_kind:t.kind,jurisdiction:t.label,rate_ppm:t.ratePpm,component_tax_cents:-t.taxCents});}
  for(const r of d.records)rows.push({record_type:r.recordType,id:r.id,tax_year:year,date:r.data.date||r.recordedAt,tax_kind:r.data.kind||'',jurisdiction:r.data.label||'',period:r.data.period||'',amount_cents:r.data.amountCents??null,reference:r.data.reference||'',source_url:r.data.sourceUrl||'',payment_url:r.data.paymentUrl||'',reverses_id:r.data.recordId||'',deadline_id:r.data.deadlineId||'',notes:r.data.reason||''});
  if(d.profile?.data.year===year)for(const p of estimatedInstallments(taxProfileSchema.parse(d.profile.data)))rows.push({record_type:'planned_installment',id:p.id,tax_year:year,date:p.dueDate,tax_kind:p.kind,jurisdiction:p.label,period:p.period,amount_cents:p.amountCents,source_url:p.sourceUrl,payment_url:p.paymentUrl,profile_version:d.profile.version});
  const columns=['record_type','id','invoice_number','tax_year','date','tax_kind','jurisdiction','period','subtotal_cents','tax_cents','total_cents','paid_cents','balance_cents','rate_ppm','tax_base_cents','component_tax_cents','amount_cents','reference','deadline_id','reverses_id','rule_id','profile_version','treatment','source_url','payment_url','notes'];
  return new NextResponse(taxCsv(rows,columns),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="tax-records-${year}.csv"`,'Cache-Control':'private, no-store'}});
 }
 return NextResponse.json(taxWorkspaceData.parse(r.data),{headers});
}catch(e){const result=taxEntryFailure(e);return NextResponse.json({error:result.error},{status:result.status,headers});}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>MAX_TAX_ENTRY_BYTES)return NextResponse.json({error:'Request too large.'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the tax entry fields.'},{status:400,headers});}
 const parsed=taxEntryCommand.safeParse(raw);if(!parsed.success)return NextResponse.json({error:'Check the tax amounts, dates, source links and review fields.'},{status:400,headers});
 try{const v=parsed.data,{db}=await authenticated(),r=await db.rpc('tax_command',{p_org:v.organization,p_action:v.action,p_version:v.version,p_data:v.data,p_key:v.key});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);return NextResponse.json({result:validateTaxReceipt(v,r.data)},{headers});}
 catch(e){const result=taxEntryFailure(e);return NextResponse.json({error:result.error},{status:result.status,headers});}
}
