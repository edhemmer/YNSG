import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {readInvoiceCredits} from '../../../lib/read-invoice-credits';
import {invoiceCreditCommand,verifyCreditSaved} from '../../../lib/invoice-credit-contract';
const headers={'Cache-Control':'private, no-store'};
const creditQuery=z.object({organization:z.uuid(),invoice:z.uuid()}).strict();
const known:Record<string,string>={STALE_REVISION:'Credit history changed. Refresh and review your kept entries before saving.',CREDIT_COMPONENT_EXCEEDED:'A charge or tax credit exceeds the uncredited original amount.',CREDIT_EXCEEDS_BALANCE:'The credit exceeds the unpaid invoice balance.',ALREADY_REVERSED:'This credit was already corrected. Refresh its history.',INVOICE_TAX_REVIEW_REQUIRED:'The original invoice tax evidence needs review before a credit can be issued.',IDEMPOTENCY_CONFLICT:'This attempt has different details. Check the original saved attempt.',CARD_PAYMENT_PENDING:'Resolve the pending card checkout before adjusting the invoice.',VALIDATION:'Review the credit amounts, reason and confirmation.',NOT_FOUND:'This invoice or credit is unavailable.',SETUP_REQUIRED:'Company finance setup is required.'};
function failed(e:unknown){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='FORBIDDEN'?'Your account cannot perform this invoice credit action.':known[code]||'The credit result could not be verified. Check the same saved attempt before another change.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:known[code]?409:503,headers});}
export async function GET(request:Request){const p=creditQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!p.success)return NextResponse.json({error:'Select a valid invoice.'},{status:400,headers});try{const {db}=await authenticated();const rows=await readInvoiceCredits(db,p.data.organization,[p.data.invoice]);return NextResponse.json({organization:p.data.organization,...rows.get(p.data.invoice)!},{headers});}catch(e){return failed(e);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let raw:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>8192)return NextResponse.json({error:'Credit details are too long.'},{status:413,headers});raw=JSON.parse(text);}catch{return NextResponse.json({error:'Check the credit fields.'},{status:400,headers});}
 const p=invoiceCreditCommand.safeParse(raw);if(!p.success)return NextResponse.json({error:'Review the credit amounts, reason and confirmation.'},{status:400,headers});
 try{const {organization,invoice,revision,key,...data}=p.data,{db}=await authenticated();const r=await db.rpc('invoice_credit_command',{p_org:organization,p_invoice:invoice,p_revision:revision,p_data:data,p_key:key});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);return NextResponse.json(verifyCreditSaved(r.data,p.data),{headers});}catch(e){return failed(e);}
}
