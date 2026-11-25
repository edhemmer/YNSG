import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {callLeadList,callLeadCommand,callLeadSaved,notInstalled} from '../../../lib/call-leads-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const errors:Record<string,string>={FORBIDDEN:'Owner access is required.',SETUP_REQUIRED:'Customer management is not enabled for this company.',NOT_FOUND:'This call is no longer on the list.',VALIDATION:'Check the call details and try again.'};
function failed(error:unknown){const code=error instanceof Error?error.message:'FAILED';if(code==='NOT_INSTALLED')return NextResponse.json({installed:false},{status:200,headers});return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':errors[code]||'The call list could not be loaded. Try again.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:errors[code]?409:503,headers});}
export async function GET(request:Request){
 const org=z.uuid().safeParse(new URL(request.url).searchParams.get('organization'));if(!org.success)return NextResponse.json({error:'Choose a company.'},{status:400,headers});
 try{const {db}=await authenticated();const r=await db.rpc('owner_call_leads',{p_org:org.data});if(r.error)throw Error(notInstalled(r.error.message)?'NOT_INSTALLED':r.error.message);const value=callLeadList.safeParse(r.data);if(!value.success)throw Error('UNVERIFIED');return NextResponse.json({installed:true,...value.data},{headers});}catch(e){return failed(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let input:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>4000)return NextResponse.json({error:'Call details are too long.'},{status:413,headers});input=JSON.parse(text);}catch{return NextResponse.json({error:'Check the call details.'},{status:400,headers});}
 const parsed=callLeadCommand.safeParse(input);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the call details.'},{status:400,headers});
 try{const {organization,...command}=parsed.data,{db}=await authenticated();const r=await db.rpc('owner_save_call_lead',{p_org:organization,p_input:command});if(r.error)throw Error(notInstalled(r.error.message)?'NOT_INSTALLED':r.error.message);const result=callLeadSaved.safeParse(r.data);if(!result.success)throw Error('UNVERIFIED');return NextResponse.json(result.data,{headers});}catch(e){return failed(e);}
}
