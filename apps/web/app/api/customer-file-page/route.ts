import {NextResponse} from 'next/server';
import {authenticated} from '../../../lib/session';
import {filePageQuery,verifyFilePage} from '../../../lib/customer-file-page-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const parsed=filePageQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return NextResponse.json({error:'Choose a valid customer and attachment page.'},{status:400,headers});
 try{const {db}=await authenticated(),v=parsed.data,r=await db.rpc('customer_file_pages',{p_org:v.organization,p_customer:v.customer,p_after_created:v.afterCreatedAt||null,p_after_id:v.afterId||null,p_jobs:v.jobs?.split(',')||[],p_invoices:v.invoices?.split(',')||[]});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);return NextResponse.json(verifyFilePage(v,r.data),{headers});}
 catch(e){const code=e instanceof Error?e.message:'',status=code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:503;return NextResponse.json({error:status===401?'Sign in to continue.':status===403?'These attachments are unavailable to your account.':'Attachments could not be verified. Retry this page before using the list.'},{status,headers});}
}
