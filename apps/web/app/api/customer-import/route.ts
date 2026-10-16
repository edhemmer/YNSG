import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {contactValue,propertyValue} from '../../../lib/customer-record-contract';
const headers={'Cache-Control':'private, no-store'};
const schema=z.object({organization:z.uuid(),customer:z.uuid(),expectedRevision:z.number().int().positive(),key:z.uuid(),approved:z.literal(true),contacts:z.array(contactValue).max(50),properties:z.array(propertyValue).max(50)}).strict().refine(v=>v.contacts.length+v.properties.length>0,'Select one or more new records.');
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();
  if(Buffer.byteLength(raw,'utf8')>45000)return NextResponse.json({error:'The customer import exceeds the supported size.'},{status:413,headers});
  const p=schema.safeParse(JSON.parse(raw));if(!p.success)return NextResponse.json({error:'Review the selected customer records before importing.'},{status:400,headers});
  const v=p.data,{db}=await authenticated();
  const r=await db.rpc('apply_customer_import',{p_org:v.organization,p_customer:v.customer,p_revision:v.expectedRevision,p_key:v.key,p_contacts:v.contacts,p_properties:v.properties});
  if(r.error){
   const msg=r.error.message||'';
   const conflict=/STALE_REVISION|DUPLICATE_|IDEMPOTENCY_CONFLICT|DETAIL_LIMIT/.test(msg);
   return NextResponse.json({error:conflict?'Customer information changed or matches an existing record. Refresh and review the import before continuing.':r.error.code==='42501'?'This account cannot import customer details.':'The import outcome could not be verified. Check the original saved attempt before retrying.'},{status:r.error.code==='42501'?403:conflict?409:503,headers});
  }
  const receipt=z.object({saved:z.literal(true),customer:z.uuid(),revision:z.number().int().positive(),contactsAdded:z.number().int().min(0).max(50),propertiesAdded:z.number().int().min(0).max(50)}).strict().safeParse(r.data);
  if(!receipt.success||receipt.data.customer!==v.customer||receipt.data.contactsAdded!==v.contacts.length||receipt.data.propertiesAdded!==v.properties.length)
   return NextResponse.json({error:'The saved import could not be verified. Refresh records before any other changes.'},{status:503,headers});
  return NextResponse.json({result:receipt.data},{headers});
 }catch{return NextResponse.json({error:'The customer import could not be verified. Check saved records before retrying.'},{status:503,headers});}
}
