import {NextResponse} from 'next/server';
import {authenticated,sameOrigin} from '../../../lib/session';
import {fileLinkQuery,fileLinkCommand,fileLinkWorkspace,fileLinkHistory,fileLinkTargets,verifyFileLinkSaved} from '../../../lib/customer-file-link-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function failed(error:unknown){const code=error instanceof Error?error.message:'';const denied=['FORBIDDEN','NOT_FOUND','TARGET_NOT_AVAILABLE'].includes(code),conflict=['STALE_REVISION','IDEMPOTENCY_CONFLICT','VALIDATION','CUSTOMER_ARCHIVED','RECEIPT_REQUIRED','ALREADY_LINKED','FILE_LIST_TOO_LARGE','SETUP_REQUIRED'].includes(code);return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':denied?'This file or record is unavailable to your account.':conflict?'This link could not be saved. Refresh the file history and review the selected record.':'The file result could not be verified. Keep your entries and check the same attempt before another change.'},{status:code==='UNAUTHORIZED'?401:denied?403:conflict?409:503,headers});}
export async function GET(request:Request){
 const q=fileLinkQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!q.success)return NextResponse.json({error:'Choose a valid customer and file search.'},{status:400,headers});
 try{const {db}=await authenticated(),v=q.data;
  const r=v.kind?await db.rpc('customer_file_targets',{p_org:v.organization,p_customer:v.customer,p_kind:v.kind,p_search:v.search||'',p_page:v.page||0}):await db.rpc('customer_file_workspace',{p_org:v.organization,p_customer:v.customer,p_file:v.file||null});
  if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);
  const data=v.kind?fileLinkTargets.parse(r.data):v.file?fileLinkHistory.parse(r.data):fileLinkWorkspace.parse(r.data);
  if(data.organization!==v.organization||data.customer!==v.customer||('file' in data&&data.file!==v.file)||('kind' in data&&(data.kind!==v.kind||data.page!==(v.page||0)||data.search!==(v.search||''))))throw Error('UNVERIFIED');
  return NextResponse.json(data,{headers});
 }catch(e){return failed(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{const text=await request.text();if(text.length>4096)return NextResponse.json({error:'Link details are too long.'},{status:413,headers});let value:unknown;try{value=JSON.parse(text);}catch{return NextResponse.json({error:'Check the file link details.'},{status:400,headers});}const input=fileLinkCommand.safeParse(value);if(!input.success)return NextResponse.json({error:'Choose a file and record, review the association and enter a reason of 10–300 characters.'},{status:400,headers});
  const v=input.data,{db}=await authenticated();const r=await db.rpc('link_customer_file',{p_org:v.organization,p_customer:v.customer,p_file:v.file,p_revision:v.revision,p_kind:v.kind,p_target:v.target,p_reason:v.reason,p_reviewed:v.reviewed,p_key:v.key});if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message);
  return NextResponse.json({result:verifyFileLinkSaved(v,r.data)},{headers});
 }catch(e){return failed(e);}
}
