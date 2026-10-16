import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated} from '../../../lib/session';
import {customerDetail} from '../../../lib/customer-record-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="customer-record.json"'};
const query=z.object({organization:z.uuid(),customer:z.uuid()}).strict();
/** Owner-initiated portability snapshot. Bounded and revision-stable; incomplete
 * pages or a mid-export edit make the entire export fail, never silently truncate. */
export async function GET(request:Request){
 const parsed=query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success)return NextResponse.json({error:'Select a valid customer.'},{status:400,headers});
 try{
  const {db}=await authenticated(),{organization,customer}=parsed.data;
  const pages=async(requestsPage:number,historyPage:number)=>{
   const r=await db.rpc('owner_customer_records',{p_org:organization,p_customer:customer,p_query:'',p_filter:'all',p_page:0,p_requests_page:requestsPage,p_history_page:historyPage});
   if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':'UNAVAILABLE');
   const valid=customerDetail.safeParse(r.data);
   if(!valid.success||valid.data.customer.id!==customer)throw Error('UNVERIFIED');
   return valid.data;
  };
  const initial=await pages(0,0);
  const history=[...initial.history],requests=[...initial.requests],seenRequests=new Set(requests.map(r=>r.id)),seenHistory=new Set(history.map(h=>h.id));
  let requestsMore=initial.requestsMore,historyMore=initial.historyMore;
  for(let page=1;requestsMore;page++){
   if(page>250)throw Error('EXPORT_TOO_LARGE');
   const current=await pages(page,0);
   if(current.customer.revision!==initial.customer.revision||current.customer.archivedAt!==initial.customer.archivedAt)throw Error('CHANGED');
   for(const item of current.requests){if(seenRequests.has(item.id))throw Error('CHANGED');seenRequests.add(item.id);requests.push(item);}
   requestsMore=current.requestsMore;
   if(requestsMore&&current.requests.length===0)throw Error('UNVERIFIED');
  }
  for(let page=1;historyMore;page++){
   if(page>250)throw Error('EXPORT_TOO_LARGE');
   const current=await pages(0,page);
   if(current.customer.revision!==initial.customer.revision||current.customer.archivedAt!==initial.customer.archivedAt)throw Error('CHANGED');
   for(const item of current.history){if(seenHistory.has(item.id))throw Error('CHANGED');seenHistory.add(item.id);history.push(item);}
   historyMore=current.historyMore;
   if(historyMore&&current.history.length===0)throw Error('UNVERIFIED');
  }
  // Re-fetch the first page before delivering the download: contact/property
  // edits do not necessarily advance the customer profile revision.
  const latest=await pages(0,0);
  if(JSON.stringify({customer:latest.customer,contacts:latest.contacts,properties:latest.properties,requests:latest.requests,history:latest.history,requestsMore:latest.requestsMore,historyMore:latest.historyMore})!==
     JSON.stringify({customer:initial.customer,contacts:initial.contacts,properties:initial.properties,requests:initial.requests,history:initial.history,requestsMore:initial.requestsMore,historyMore:initial.historyMore}))
   throw Error('CHANGED');
  // No private file URLs, access invitations, credentials, or third-party records.
  return new Response(JSON.stringify({format:'ynsg-customer-record-v1',exportedAt:new Date().toISOString(),organization,customer:initial.customer,contacts:initial.contacts,properties:initial.properties,requests,history,scope:'Customer CRM profile, addresses, contacts, linked request summaries and change history. Excludes uploaded document bytes, financial ledgers and third-party messages.'},null,2),{status:200,headers});
 }catch(e){
  const code=e instanceof Error?e.message:'UNAVAILABLE';
  return NextResponse.json({error:code==='FORBIDDEN'?'This account cannot export this customer.':code==='CHANGED'?'Customer data changed during export. Refresh the record before trying again.':'A complete customer export could not be verified. No partial file was returned.'},{status:code==='FORBIDDEN'?403:503,headers:{'Cache-Control':'private, no-store'}});
 }
}
