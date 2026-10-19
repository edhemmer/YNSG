import {NextResponse} from 'next/server';
import {authenticated} from '../../../lib/session';
import {accountingQuery,verifiedAccountingExport} from '../../../lib/accounting-export-contract';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const parsed=accountingQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:'Choose a date range of up to 366 days.'},{status:400,headers});
 try{const {db}=await authenticated(),q=parsed.data;const r=await db.rpc('accounting_journal_export',{p_org:q.organization,p_from:q.from,p_to:q.to});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);return NextResponse.json(verifiedAccountingExport(r.data,q),{headers});}
 catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({code:code==='REAUTHENTICATION_REQUIRED'?code:undefined,error:code==='REAUTHENTICATION_REQUIRED'?'Confirm your sign-in before downloading the journal.':code==='UNAUTHORIZED'?'Sign in to continue.':code==='FORBIDDEN'?'Your account cannot export this journal.':code==='EXPORT_RANGE_TOO_LARGE'?'More than 10,000 journal lines match. Choose a smaller range; no partial export was made.':'The complete balanced journal could not be verified. No partial export was made.'},{status:code==='REAUTHENTICATION_REQUIRED'?428:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:code==='EXPORT_RANGE_TOO_LARGE'?409:503,headers});}
}
