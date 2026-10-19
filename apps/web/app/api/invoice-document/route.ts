import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated} from '../../../lib/session';
import {invoicePdf} from '../../../lib/invoice-pdf';
import {invoiceDocument} from '../../../lib/invoice-document';
import {completeInvoicePayments} from '../../../lib/complete-invoice-payments';
import {verifiedPaymentContext} from '../../../lib/invoice-payment-context';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const query=z.object({organization:z.uuid(),invoice:z.uuid(),format:z.enum(['json','pdf']).optional()}).strict();
export async function GET(request:Request){
 const parsed=query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success)return NextResponse.json({error:'Select a valid invoice and document format.'},{status:400,headers});
 try{
  const {organization,invoice:id,format}=parsed.data,{db}=await authenticated();
  const r=await db.from('invoices').select('id,number,issued_at,total_cents,snapshot').eq('organization_id',organization).eq('id',id).maybeSingle();
  if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':'UNAVAILABLE');
  if(!r.data)return NextResponse.json({error:'This invoice is unavailable to your account.'},{status:404,headers});
  const [complete]=await completeInvoicePayments(db,organization,[r.data]);
  const context=await db.rpc('invoice_payment_context',{p_org:organization,p_invoice:id});
  if(context.error)throw Error(context.error.code==='42501'?'FORBIDDEN':'UNAVAILABLE');
  const verified=verifiedPaymentContext(context.data);
  const signature=(payments:{cents:number}[])=>payments.map(p=>p.cents).sort((a,b)=>a-b).join(',');
  if(!complete||complete.id!==id||signature(complete.payments)!==signature(verified.payments))throw Error('UNVERIFIED');
  const document=invoiceDocument(complete);document.dueDate=verified.admin.dueDate;
  if(format==='pdf'){const bytes=await invoicePdf(document);return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="invoice-${document.number}.pdf"`}});}
  return NextResponse.json({invoice:document},{headers});
 }catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='FORBIDDEN'?'Your account cannot open this invoice.':'The complete invoice could not be verified. Refresh and try again before using this document.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:503,headers});}
}
