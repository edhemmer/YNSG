import {NextResponse} from 'next/server';
import {authenticated} from '../../../lib/session';
import {serviceHistoryQuery,serviceHistory} from '../../../lib/customer-service-history-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const input=serviceHistoryQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!input.success)return NextResponse.json({error:'Check the customer or service search.'},{status:400,headers});
 try{const q=input.data,{db}=await authenticated();const r=await db.rpc('owner_customer_service_history',{p_org:q.organization,p_customer:q.customer||null,p_query:q.query,p_page:q.page});if(r.error)throw Error(r.error.message);const result=serviceHistory.safeParse(r.data);if(!result.success)throw Error('UNVERIFIED');return NextResponse.json(result.data,{headers});}
 catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='FORBIDDEN'?'Owner access is required.':code==='UNAUTHORIZED'?'Sign in to continue.':code==='NOT_FOUND'?'This customer is no longer available.':'Service history could not be verified. Please retry.'},{status:code==='FORBIDDEN'?403:code==='UNAUTHORIZED'?401:code==='NOT_FOUND'?404:503,headers});}
}
