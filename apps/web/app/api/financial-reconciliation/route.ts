import {NextResponse} from 'next/server';
import {authenticated} from '../../../lib/session';
import {reconciliationQuery,verifiedReconciliation} from '../../../lib/financial-reconciliation-contract';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const parsed=reconciliationQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:'Choose a valid date range of up to 366 days.'},{status:400,headers});
 try{const {db}=await authenticated(),q=parsed.data;const r=await db.rpc('financial_reconciliation',{p_org:q.organization,p_from:q.from,p_to:q.to});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);return NextResponse.json(verifiedReconciliation(r.data,q).data,{headers});}
 catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='FORBIDDEN'?'Your account cannot open this reconciliation.':code==='EXPORT_RANGE_TOO_LARGE'?'More than 10,000 transactions match. Choose a smaller date range; no partial report was made.':'The complete reconciliation could not be verified. Refresh to try again.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:code==='EXPORT_RANGE_TOO_LARGE'?409:503,headers});}
}
