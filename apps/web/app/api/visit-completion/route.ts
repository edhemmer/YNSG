import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {parseInvoiceDraft,MAX_INVOICE_DRAFT_BYTES} from '../../../lib/invoice-draft-input';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>MAX_INVOICE_DRAFT_BYTES)throw Error('DRAFT_TOO_LARGE');
  const {reviewed,...draft}=JSON.parse(raw);z.literal(true).parse(reviewed);
  const v=parseInvoiceDraft(JSON.stringify(draft));const {db}=await authenticated();
  const r=await db.rpc('complete_owner_visit',{p_org:v.organization,p_job:v.job,p_revision:v.revision,p_lines:v.lines,p_reviewed:true,p_key:v.key});
  if(r.error){
   const known=['FORBIDDEN','SETUP_REQUIRED','VALIDATION','WORK_REVIEW_REQUIRED','NOT_FOUND','STALE_REVISION','TRANSITION','APPROVAL_REQUIRED','CHANGE_ORDER_REQUIRED','IDEMPOTENCY_CONFLICT','INVOICE_ALREADY_ISSUED'].includes(r.error.message);
   return NextResponse.json({error:r.error.message==='CHANGE_ORDER_REQUIRED'?'Charges exceed the approved labor amount. Review a change order first.':known?'The work was not completed. Refresh the saved visit and review its work record.':'Completion could not be confirmed. Check the saved work before continuing.',uncertain:!known},{status:known?(r.error.message==='FORBIDDEN'?403:409):503,headers});
  }
  return NextResponse.json({result:r.data},{headers});
 }catch(e){
  if(e instanceof z.ZodError||e instanceof SyntaxError||(e instanceof Error&&e.message==='DRAFT_TOO_LARGE'))return NextResponse.json({error:'Review the work, minutes and charges before completing the visit.',uncertain:false},{status:400,headers});
  if(e instanceof Error&&e.message==='UNAUTHORIZED')return NextResponse.json({error:'Sign in to check the saved work.',uncertain:false},{status:401,headers});
  return NextResponse.json({error:'Completion could not be confirmed. Check the saved work before continuing.',uncertain:true},{status:503,headers});
 }
}
