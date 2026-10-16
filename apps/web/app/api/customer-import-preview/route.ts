import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '../../../lib/session';
import {customerDetail,contactValue,propertyValue,customerValue} from '../../../lib/customer-record-contract';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const snapshot=z.object({
 format:z.literal('ynsg-customer-record-v1'),organization:z.uuid(),
 customer:z.object({id:z.uuid(),displayName:z.string()}).passthrough(),
 contacts:z.array(z.object({name:z.string(),email:z.string().nullable(),phone:z.string().nullable(),relationship:z.string()}).passthrough()).max(100),
 properties:z.array(z.object({street:z.string(),city:z.string(),state:z.string(),postalCode:z.string().nullable()}).passthrough()).max(100)
}).passthrough();
const command=z.object({organization:z.uuid(),customer:z.uuid(),snapshot}).strict();
const key=(s:string)=>s.trim().toLocaleLowerCase('en-US');
/** No mutations: compare a portable customer CRM document with a selected
 * customer after an independently authorized tenant-scoped read. */
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 try{
  const raw=await request.text();
  if(Buffer.byteLength(raw,'utf8')>250000)return NextResponse.json({error:'The import preview exceeds the supported size.'},{status:413,headers});
  const parsed=command.safeParse(JSON.parse(raw));
  if(!parsed.success)return NextResponse.json({error:'Select a valid customer record export to review.'},{status:400,headers});
  const {organization,customer,snapshot:document}=parsed.data;
  if(document.organization!==organization||document.customer.id!==customer)
   return NextResponse.json({error:'The export belongs to a different company or customer. Nothing was imported.'},{status:409,headers});
  if(!customerValue.safeParse({displayName:document.customer.displayName}).success)
   return NextResponse.json({error:'The export contains an invalid customer name.'},{status:400,headers});
  const contacts=document.contacts.map(c=>({name:c.name,email:c.email||'',phone:c.phone||'',relationship:c.relationship}));
  const properties=document.properties.map(p=>({street:p.street,city:p.city,state:p.state,postalCode:p.postalCode||''}));
  if(contacts.some(c=>!contactValue.safeParse(c).success)||properties.some(p=>!propertyValue.safeParse(p).success))
   return NextResponse.json({error:'The export includes contacts or addresses that require correction before import.'},{status:400,headers});
  const {db}=await authenticated();
  const r=await db.rpc('owner_customer_records',{p_org:organization,p_customer:customer,p_query:'',p_filter:'all',p_page:0,p_requests_page:0,p_history_page:0});
  const current=customerDetail.safeParse(r.data);
  if(r.error||!current.success||current.data.customer.id!==customer)
   return NextResponse.json({error:'The selected customer record could not be confirmed for this account.'},{status:403,headers});
  const contactKey=(c:{name:string;email:string;phone:string})=>[key(c.name),key(c.email),c.phone.replace(/\D/g,'')].join('|');
  const propertyKey=(p:{street:string;city:string;state:string;postalCode:string})=>[key(p.street),key(p.city),key(p.state),key(p.postalCode)].join('|');
  const seenContacts=new Set<string>(),seenProperties=new Set<string>();
  const currentContacts=new Set(current.data.contacts.map(c=>contactKey({name:c.name,email:c.email||'',phone:c.phone||''})));
  const currentProperties=new Set(current.data.properties.map(p=>propertyKey({street:p.street,city:p.city,state:p.state,postalCode:p.postalCode||''})));
  const reviewContacts=contacts.map(c=>{
   const k=contactKey(c),duplicateInFile=seenContacts.has(k);seenContacts.add(k);
   return {name:c.name,status:duplicateInFile?'duplicate_in_file':currentContacts.has(k)?'already_present':'proposed',value:c};
  });
  const reviewProperties=properties.map(p=>{
   const k=propertyKey(p),duplicateInFile=seenProperties.has(k);seenProperties.add(k);
   return {address:[p.street,p.city,p.state].join(', '),status:duplicateInFile?'duplicate_in_file':currentProperties.has(k)?'already_present':'proposed',value:p};
  });
  return NextResponse.json({previewOnly:true,customerId:customer,currentRevision:current.data.customer.revision,customerNameMatches:key(current.data.customer.displayName)===key(document.customer.displayName),contacts:reviewContacts,properties:reviewProperties,writeCount:0},{headers});
 }catch{
  return NextResponse.json({error:'A complete, authorized import preview could not be verified. No customer data was changed.'},{status:503,headers});
 }
}
