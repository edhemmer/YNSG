import {NextResponse} from 'next/server';
import {authenticated} from '../../../lib/session';
import {emailHistoryQuery,emailHistory} from '../../../lib/customer-email-history-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
// Read-only: emails sent (or waiting to send) to one customer. Owner/admin only, enforced in the database.
export async function GET(request:Request){
 const input=emailHistoryQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!input.success)return NextResponse.json({error:'Check the customer.'},{status:400,headers});
 try{const {db}=await authenticated();const r=await db.rpc('owner_customer_email_history',{p_org:input.data.organization,p_customer:input.data.customer});if(r.error)throw Error(r.error.message);const result=emailHistory.safeParse(r.data);if(!result.success)throw Error('UNVERIFIED');return NextResponse.json(result.data,{headers});}
 catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='FORBIDDEN'?'Owner access is required.':code==='UNAUTHORIZED'?'Sign in to continue.':code==='NOT_FOUND'?'This customer is no longer available.':'Email history could not be verified. Please retry.'},{status:code==='FORBIDDEN'?403:code==='UNAUTHORIZED'?401:code==='NOT_FOUND'?404:503,headers});}
}
