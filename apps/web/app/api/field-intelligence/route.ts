import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {prepareAgentPlan,prepareCustomerFollowUp} from '../../../lib/field-agent-plan';
import {completeInvoicePayments} from '../../../lib/complete-invoice-payments';
import type {InboxRequest,LinkedQuote,LinkedJob} from '../../../lib/request-inbox';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const params=z.object({organization:z.uuid(),request:z.uuid()});
/** Owner-only, read-only preparation from current saved records.
 * No model-generated actions, outbound email, payments or database mutations. */
export async function GET(request:Request){
 try{
  const {organization,request:requestId}=params.parse(Object.fromEntries(new URL(request.url).searchParams));
  const {db,user}=await authenticated();
  const membership=await db.from('memberships').select('role').eq('organization_id',organization).eq('user_id',user.id).is('revoked_at',null).in('role',['owner','admin']).maybeSingle();
  if(membership.error)throw Error('FAILED');
  if(!membership.data)return NextResponse.json({error:'Owner access is required.'},{status:403,headers});
  const record=await db.from('service_requests').select('id,customer_id,status,revision,created_at,original_submission,appointments!appointments_organization_id_request_id_fkey(id,request_id,job_id,status,revision,start_at,end_at,arrival_at,expires_at,replaces_id,customer_response)').eq('organization_id',organization).eq('id',requestId).maybeSingle();
  if(record.error)throw Error('FAILED');
  if(!record.data)return NextResponse.json({error:'Request not found.'},{status:404,headers});
  const quotes=await db.from('quotes').select('id,request_id,status,current_version,quote_versions(version,scope,labor_cents,duration_minutes)').eq('organization_id',organization).eq('request_id',requestId).limit(101);
  if(quotes.error||!quotes.data||quotes.data.length>100)throw Error('FAILED');
  const quoteIds=quotes.data.map(q=>q.id);
  const jobs=quoteIds.length?await db.from('jobs').select('id,quote_id,approved_version,status,revision').eq('organization_id',organization).in('quote_id',quoteIds).limit(101):{data:[],error:null};
  if(jobs.error||!jobs.data||jobs.data.length>100)throw Error('FAILED');
  const jobIds=jobs.data.map(j=>j.id);
  const invoices=jobIds.length?await db.from('invoices').select('id,job_id,number,total_cents').eq('organization_id',organization).in('job_id',jobIds).limit(101):{data:[],error:null};
  if(invoices.error||!invoices.data||invoices.data.length>100)throw Error('FAILED');
  const verified=await completeInvoicePayments(db,organization,invoices.data);
  const savedRequest=record.data as unknown as InboxRequest;
  const tasks=prepareAgentPlan(savedRequest,quotes.data as LinkedQuote[],jobs.data as LinkedJob[],verified);
  const followUp=tasks[0]?.kind==='schedule'?prepareCustomerFollowUp(savedRequest):null;
  return NextResponse.json({requestId,requestRevision:savedRequest.revision,checkedAt:new Date().toISOString(),tasks,followUp,execution:'owner_review_only'},{headers});
 }catch(e){return failure(e);}
}
