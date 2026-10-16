import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../lib/session';
import {customerFileQuery,customerFileDownload,customerFilePurpose,customerFileRecords,customerFileReservation,customerFileFinalize,verifyImageBytes,validCustomerFilePath} from '../../../lib/customer-file-contract';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const bucket='ynsg-customer-files';
const unavailable='The file result could not be confirmed. Refresh saved attachments before trying again.';
export async function GET(request:Request){
 try{
  const query=new URL(request.url).searchParams;
  const target=query.has('file')
   ?customerFileDownload.safeParse(Object.fromEntries(query))
   :customerFileQuery.safeParse(Object.fromEntries(query));
  if(!target.success)return NextResponse.json({error:'Choose a valid customer or attachment.'},{status:400,headers});
  const {db}=await authenticated();
  if('file' in target.data){
   const {data,error}=await db.rpc('authorize_customer_file',{p_org:target.data.organization,p_file:target.data.file});
   if(error)return NextResponse.json({error:'This attachment cannot be opened.'},{status:403,headers});
   const proof=z.object({path:z.string(),name:z.string(),mime:z.string()}).strict().safeParse(data);
   if(!proof.success||!validCustomerFilePath(target.data.organization,target.data.file,proof.data.path))
    return NextResponse.json({error:unavailable},{status:503,headers});
   const signed=await db.storage.from(bucket).createSignedUrl(proof.data.path,60,{download:proof.data.name});
   if(signed.error||!signed.data?.signedUrl)return NextResponse.json({error:unavailable},{status:503,headers});
   return NextResponse.json({url:signed.data.signedUrl,expiresIn:60},{headers});
  }
  const {data,error}=await db.rpc('list_customer_files',{p_org:target.data.organization,p_customer:target.data.customer});
  if(error)return NextResponse.json({error:'These attachments are unavailable to your account.'},{status:403,headers});
  const files=customerFileRecords.safeParse(data);
  if(!files.success)return NextResponse.json({error:unavailable},{status:503,headers});
  return NextResponse.json({files:files.data},{headers});
 }catch(e){return failure(e)}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 const size=Number(request.headers.get('content-length')||0);
 if(!size||size>9000000)return NextResponse.json({error:'Choose one image of up to 8 MB.'},{status:413,headers});
 try{
  const data=await request.formData();
  const parsed=z.object({organization:z.uuid(),customer:z.uuid(),key:z.uuid(),purpose:customerFilePurpose}).strict().safeParse(Object.fromEntries(['organization','customer','key','purpose'].map(k=>[k,data.get(k)])));
  const blob=data.get('file');
  if(!parsed.success||!(blob instanceof File))return NextResponse.json({error:'Choose a customer, attachment type and image.'},{status:400,headers});
  if(blob.size<8||blob.size>8388608||!['image/jpeg','image/png'].includes(blob.type)||blob.name.length>180||blob.name.length<1)
   return NextResponse.json({error:'Use a JPG or PNG image up to 8 MB.'},{status:400,headers});
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(!verifyImageBytes(bytes,blob.type))return NextResponse.json({error:'The image content did not match its file type.'},{status:400,headers});
  const {db}=await authenticated(),sha=createHash('sha256').update(bytes).digest('hex');
  const input=parsed.data;
  const reservation=await db.rpc('reserve_customer_file',{p_org:input.organization,p_customer:input.customer,p_key:input.key,p_purpose:input.purpose,p_name:blob.name,p_mime:blob.type,p_bytes:blob.size,p_sha:sha});
  if(reservation.error)return NextResponse.json({error:'Your account cannot attach that file or the saved attempt changed.'},{status:403,headers});
  const ticket=customerFileReservation.safeParse(reservation.data);
  if(!ticket.success||!validCustomerFilePath(input.organization,ticket.data.id,ticket.data.path))
   return NextResponse.json({error:unavailable},{status:503,headers});
  if(!ticket.data.ready){
   const uploaded=await db.storage.from(bucket).upload(ticket.data.path,bytes,{contentType:blob.type,upsert:false});
   // A duplicate object might not have the expected bytes. Never promote
   // metadata on an ambiguous upload; owner recovery must reconcile the
   // private object before allowing finalization.
   if(uploaded.error)return NextResponse.json({error:unavailable},{status:503,headers});
  }
  const complete=await db.rpc('finalize_customer_file',{p_org:input.organization,p_file:ticket.data.id});
  const receipt=customerFileFinalize.safeParse(complete.data);
  if(complete.error||!receipt.success||receipt.data.id!==ticket.data.id)
   return NextResponse.json({error:unavailable},{status:503,headers});
  return NextResponse.json({ok:true,file:receipt.data.id},{headers});
 }catch(e){return failure(e)}
}
