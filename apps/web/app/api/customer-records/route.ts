import {NextResponse} from 'next/server';
import {authenticated,sameOrigin} from '../../../lib/session';
import {customerCommand,customerQuery,customerList,customerDetail,customerSaved} from '../../../lib/customer-record-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const errors:Record<string,string>={FORBIDDEN:'Owner access is required.',SETUP_REQUIRED:'Customer management is not enabled for this company.',NOT_FOUND:'This customer or related record is no longer available.',STALE_REVISION:'This customer changed elsewhere. Your entries are kept; reload and review before saving.',IDEMPOTENCY_CONFLICT:'This saved attempt has different details. Review the customer before making another change.',VALIDATION:'Check the customer fields and try again.',CUSTOMER_ARCHIVED:'Restore this customer before editing their current details.',DETAIL_LIMIT:'This customer has too many contacts or addresses for this editor. No records were hidden or changed.',CUSTOMER_HAS_OPEN_WORK:'Finish or resolve this customer’s requests, visits, work and unpaid invoices before archiving.',ADDRESS_HAS_OPEN_WORK:'This address is linked to booked or unfinished work. Review the appointment instead, or add a separate service address.'};
function failed(error:unknown){const code=error instanceof Error?error.message:'FAILED';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':errors[code]||'The saved result could not be verified. Keep your entries and check the same saved attempt.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:errors[code]?409:503,headers});}
export async function GET(request:Request){
 const parsed=customerQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:'Check the customer search or selection.'},{status:400,headers});
 try{const q=parsed.data,{db}=await authenticated();const r=await db.rpc('owner_customer_records',{p_org:q.organization,p_customer:q.customer||null,p_query:q.query,p_filter:q.filter,p_page:q.page,p_requests_page:q.requestsPage,p_history_page:q.historyPage});if(r.error)throw Error(r.error.message);const value=(q.customer?customerDetail:customerList).safeParse(r.data);if(!value.success)throw Error('UNVERIFIED');return NextResponse.json(value.data,{headers});}catch(e){return failed(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let input:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>8192)return NextResponse.json({error:'Customer details are too long.'},{status:413,headers});input=JSON.parse(text);}catch{return NextResponse.json({error:'Check the customer fields.'},{status:400,headers});}
 const parsed=customerCommand.safeParse(input);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the customer fields.'},{status:400,headers});
 try{const {organization,key,...command}=parsed.data,{db}=await authenticated();const r=await db.rpc('manage_customer_record',{p_org:organization,p_input:command,p_key:key});if(r.error)throw Error(r.error.message);const result=customerSaved.safeParse(r.data);if(!result.success)throw Error('UNVERIFIED');return NextResponse.json(result.data,{headers});}catch(e){return failed(e);}
}
