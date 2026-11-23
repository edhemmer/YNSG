import {NextResponse} from 'next/server';
import {authenticated,sameOrigin} from '../../../lib/session';
import {businessAccountCommand,businessAccountQuery,businessAccountDetail,businessPipeline,businessAccountSaved} from '../../../lib/business-account-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const errors:Record<string,string>={FORBIDDEN:'Owner access is required.',SETUP_REQUIRED:'Customer management is not enabled for this company.',NOT_FOUND:'This customer is no longer available.',STALE_REVISION:'This business account changed elsewhere. Your entries are kept; reload and review before saving.',IDEMPOTENCY_CONFLICT:'This saved attempt has different details. Review the account before making another change.',VALIDATION:'Check the business account fields and try again.',CUSTOMER_ARCHIVED:'Restore this customer before editing their business account.'};
function failed(error:unknown){const code=error instanceof Error?error.message:'FAILED';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':errors[code]||'The saved result could not be verified. Keep your entries and check the same saved attempt.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:errors[code]?409:503,headers});}
export async function GET(request:Request){
 const parsed=businessAccountQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:'Check the business account selection.'},{status:400,headers});
 try{const q=parsed.data,{db}=await authenticated();const r=await db.rpc('owner_business_accounts',{p_org:q.organization,p_customer:q.customer||null,p_stage:q.stage||null,p_page:q.page});if(r.error)throw Error(r.error.message);const value=(q.customer?businessAccountDetail:businessPipeline).safeParse(r.data);if(!value.success)throw Error('UNVERIFIED');return NextResponse.json(value.data,{headers});}catch(e){return failed(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let input:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>6000)return NextResponse.json({error:'Business account details are too long.'},{status:413,headers});input=JSON.parse(text);}catch{return NextResponse.json({error:'Check the business account fields.'},{status:400,headers});}
 const parsed=businessAccountCommand.safeParse(input);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the business account fields.'},{status:400,headers});
 try{const {organization,key,...command}=parsed.data,{db}=await authenticated();const r=await db.rpc('save_business_account',{p_org:organization,p_input:command,p_key:key});if(r.error)throw Error(r.error.message);const result=businessAccountSaved.safeParse(r.data);if(!result.success)throw Error('UNVERIFIED');return NextResponse.json(result.data,{headers});}catch(e){return failed(e);}
}
