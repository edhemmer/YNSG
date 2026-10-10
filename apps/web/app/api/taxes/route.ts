import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
import {taxProfileSchema,taxKind,sourceUrl,taxCsv,estimatedInstallments} from '../../../lib/taxes';
const base={organization:z.uuid(),version:z.number().int().min(0),key:z.string().min(16).max(110)};
const record=z.object({year:z.number().int().min(2026).max(2100),kind:taxKind,label:z.string().trim().min(2).max(500),period:z.string().trim().min(2).max(500),date:z.iso.date(),amountCents:z.number().int().min(0).max(999999999),sourceUrl,paymentUrl:sourceUrl,reference:z.string().trim().max(500).optional(),reviewed:z.literal(true),deadlineId:z.string().max(100).optional()}).strict();
const input=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('profile'),data:taxProfileSchema}).strict(),
 z.object({...base,action:z.literal('deadline'),data:record}).strict(),
 z.object({...base,action:z.literal('payment'),data:record.refine(d=>d.amountCents>0&&Boolean(d.reference?.length&&d.reference.length>=2))}).strict(),
 z.object({...base,action:z.literal('reversal'),data:z.object({year:z.number().int().min(2026).max(2100),recordId:z.uuid(),reason:z.string().trim().min(2).max(500)}).strict()}).strict(),
]);
const taxErrors:Record<string,string>={TAX_REVIEW_REQUIRED:'Review the applicable tax rule and customer-approved total before issuing this invoice.',TAX_PROFILE_CHANGED:'Tax setup changed. Refresh and review before saving.',TAX_JURISDICTION_MISMATCH:'This tax rule does not match the service location. Review its jurisdiction.',ALREADY_REVERSED:'This tax record has already been reversed.',VALIDATION:'Check the amounts, dates, sources and required review fields.',FORBIDDEN:'Your account cannot manage these tax records.'};
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,organization=z.uuid().parse(q.get('organization')),year=z.coerce.number().int().min(2026).max(2100).parse(q.get('year'));
 const {db}=await authenticated();const r=await db.rpc('tax_workspace',{p_org:organization,p_year:year});if(r.error)throw Error(r.error.message);
 if(q.get('format')==='csv'){
  const d=r.data,rows:Record<string,string|number|null>[]=[];
  for(const i of d.invoices){const components=i.tax?.components||[];
   if(!components.length)rows.push({record_type:'invoice',id:i.id,invoice_number:i.number,tax_year:year,date:i.issuedAt,subtotal_cents:i.subtotalCents,tax_cents:i.taxCents,total_cents:i.totalCents,paid_cents:i.paidCents,balance_cents:i.totalCents-i.paidCents,treatment:'Legacy reviewed non-taxable labor; see invoice configuration'});
   else {rows.push({record_type:"invoice",id:i.id,invoice_number:i.number,tax_year:year,date:i.issuedAt,subtotal_cents:i.subtotalCents,tax_cents:i.taxCents,total_cents:i.totalCents,paid_cents:i.paidCents,balance_cents:i.totalCents-i.paidCents});for(const c of components)rows.push({record_type:'invoice_tax_component',id:i.id,invoice_number:i.number,tax_year:year,date:i.issuedAt,tax_kind:c.kind,jurisdiction:c.label,rate_ppm:c.ratePpm,tax_base_cents:c.baseCents,component_tax_cents:c.taxCents,source_url:i.tax.rule.sourceUrl,rule_id:i.tax.rule.id,profile_version:i.tax.profileVersion,treatment:i.tax.rule.scope});}
  }
  for(const r of d.records)rows.push({record_type:r.recordType,id:r.id,tax_year:year,date:r.data.date||r.recordedAt,tax_kind:r.data.kind||'',jurisdiction:r.data.label||'',period:r.data.period||'',amount_cents:r.data.amountCents??null,reference:r.data.reference||'',source_url:r.data.sourceUrl||'',payment_url:r.data.paymentUrl||'',reverses_id:r.data.recordId||'',deadline_id:r.data.deadlineId||'',notes:r.data.reason||''});
  if(d.profile?.data.year===year)for(const p of estimatedInstallments(taxProfileSchema.parse(d.profile.data)))rows.push({record_type:'planned_installment',id:p.id,tax_year:year,date:p.dueDate,tax_kind:p.kind,jurisdiction:p.label,period:p.period,amount_cents:p.amountCents,source_url:p.sourceUrl,payment_url:p.paymentUrl,profile_version:d.profile.version});
  const columns=['record_type','id','invoice_number','tax_year','date','tax_kind','jurisdiction','period','subtotal_cents','tax_cents','total_cents','paid_cents','balance_cents','rate_ppm','tax_base_cents','component_tax_cents','amount_cents','reference','deadline_id','reverses_id','rule_id','profile_version','treatment','source_url','payment_url','notes'];
  return new NextResponse(taxCsv(rows,columns),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="tax-records-${year}.csv"`,'Cache-Control':'no-store'}});
 }
 return NextResponse.json(r.data,{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});
 try{const raw=await request.text();if(Buffer.byteLength(raw)>100000)return NextResponse.json({error:'Request too large.'},{status:413});const v=input.parse(JSON.parse(raw));const {db}=await authenticated();
 const r=await db.rpc('tax_command',{p_org:v.organization,p_action:v.action,p_version:v.version,p_data:v.data,p_key:v.key});
 if(r.error)return NextResponse.json({error:taxErrors[r.error.message]||'The tax record was not saved. Refresh and check the review fields.'},{status:409,headers:{'Cache-Control':'no-store'}});
 return NextResponse.json({result:r.data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'Check the tax amounts, dates, source links and review fields.'},{status:400});return failure(e);}
}
