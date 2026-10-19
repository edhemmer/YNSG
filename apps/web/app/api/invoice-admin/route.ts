import {readInvoiceCredits} from '../../../lib/read-invoice-credits';
import {NextResponse} from 'next/server';
import {invoicePaymentQuery,verifiedPaymentContext} from '../../../lib/invoice-payment-context';
import {authenticated,sameOrigin} from '../../../lib/session';
import {invoiceRecordCommand,invoiceRecordSaved,MAX_INVOICE_RECORD_BYTES} from '../../../lib/invoice-record-contract';
import {stripeConfigured} from '../../../lib/stripe-server';
export async function GET(request:Request){
 const parsed=invoicePaymentQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:'Choose a valid invoice.'},{status:400,headers:{'Cache-Control':'private, no-store'}});
 try{const {organization,invoice}=parsed.data,{db}=await authenticated();const r=await db.rpc('invoice_payment_context',{p_org:organization,p_invoice:invoice});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);const data=verifiedPaymentContext(r.data);const contexts=await readInvoiceCredits(db,organization,[invoice]),creditContext=contexts.get(invoice)!;if(creditContext.paidCents!==data.payments.reduce((n,p)=>n+p.cents,0))throw Error('UNVERIFIED');return NextResponse.json({...data,creditContext,organization,invoice,cardConfigured:stripeConfigured(organization)},{headers:{'Cache-Control':'private, no-store'}});}
 catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='FORBIDDEN'?'Your account cannot open this payment history.':'The complete payment history could not be verified. Refresh before recording another change.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:503,headers:{'Cache-Control':'private, no-store'}});}
}
const headers={'Cache-Control':'private, no-store'};
const messages:Record<string,string>={STALE_REVISION:'This invoice record changed elsewhere. Your entries are kept; reload the saved details before continuing.',IDEMPOTENCY_CONFLICT:'This saved attempt has different details. Review the invoice record before making another change.',VALIDATION:'Check the due date, archive choice and reason.',NOT_FOUND:'This invoice is no longer available to your account.',FORBIDDEN:'Your account cannot update this invoice record.',UNAUTHORIZED:'Sign in to continue.'};
function recordFailure(error:unknown){const code=error instanceof Error?error.message:'';return NextResponse.json({error:messages[code]||'The saved invoice record could not be verified. Check the same saved attempt before changing it.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:messages[code]?409:503,headers});}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>MAX_INVOICE_RECORD_BYTES)return NextResponse.json({error:'Invoice record details are too long.'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the invoice record fields.'},{status:400,headers});}
 const parsed=invoiceRecordCommand.safeParse(raw);if(!parsed.success)return NextResponse.json({error:'Check the due date, archive choice and reason.'},{status:400,headers});
 try{const v=parsed.data,{db}=await authenticated();const r=await db.rpc('manage_invoice',{p_org:v.organization,p_invoice:v.invoice,p_revision:v.revision,p_due:v.dueDate,p_archived:v.archived,p_reason:v.reason,p_key:v.key});if(r.error)throw Error(r.error.message);const result=invoiceRecordSaved.safeParse(r.data);if(!result.success||result.data.revision!==v.revision+1||result.data.dueDate!==v.dueDate||result.data.archived!==v.archived||result.data.reason!==v.reason)throw Error('UNVERIFIED');return NextResponse.json(result.data,{headers});}catch(e){return recordFailure(e);}
}
