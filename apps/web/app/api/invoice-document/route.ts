import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';
import {invoicePdf} from '../../../lib/invoice-pdf';
import {invoiceDocument} from '../../../lib/invoice-document';
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams;
 const organization=z.uuid().parse(q.get('organization')),id=z.uuid().parse(q.get('invoice'));
 const {db}=await authenticated();
 const r=await db.from('invoices').select('number,issued_at,total_cents,snapshot,payments(cents)').eq('organization_id',organization).eq('id',id).maybeSingle();
 if(r.error)throw r.error;
 if(!r.data)return NextResponse.json({error:'This invoice is unavailable to your account.'},{status:404,headers:{'Cache-Control':'no-store'}});
 const document=invoiceDocument(r.data);
 const context=await db.rpc("invoice_payment_context",{p_org:organization,p_invoice:id});if(context.error)throw Error(context.error.message);document.dueDate=context.data.admin.dueDate;
 if(q.get("format")==="pdf"){const bytes=await invoicePdf(document);return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="invoice-${document.number}.pdf"`,"Cache-Control":"private, no-store"}});}
 return NextResponse.json({invoice:document},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
