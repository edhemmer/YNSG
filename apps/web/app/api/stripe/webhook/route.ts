import {NextResponse} from 'next/server';
import {z} from 'zod';
import {verifyStripeSignature,merchantMap} from '../../../../lib/stripe-core';
import {merchantFor,reconcileSession,reconcileRefunds,stripeRequest,stripeStore} from '../../../../lib/stripe-server';
export const runtime='nodejs';
export async function POST(request:Request){
 let event;try{const raw=await request.text();if(Buffer.byteLength(raw)>1000000)throw Error('TOO_LARGE');event=verifyStripeSignature(raw,request.headers.get('Stripe-Signature')||'',process.env.STRIPE_WEBHOOK_SECRET||'');}catch{return NextResponse.json({error:'Webhook signature not accepted.'},{status:400});}
 if(!event.livemode)return NextResponse.json({error:'Live events required.'},{status:400});
 try{
  const obj=event.data.object;
  if(!['checkout.session.completed','checkout.session.expired','charge.refunded','refund.updated','charge.dispute.created','charge.dispute.closed'].includes(event.type))return NextResponse.json({received:true});
  const map=merchantMap(process.env.STRIPE_MERCHANTS_JSON);let org:string;
  if(event.type.startsWith('checkout.session.')){if(!obj.metadata||typeof obj.metadata!=='object'||(obj.metadata as Record<string,unknown>).integration!=='ynsg')return NextResponse.json({received:true});const m=z.object({organization:z.uuid()}).parse(obj.metadata);org=m.organization;}
  else{const eventAccount=event.account;const matches=Object.entries(map).filter(([,id])=>!eventAccount||id===eventAccount);
   if(eventAccount&&matches.length!==1)throw Error('PROVIDER_MISMATCH');
   // Direct-account events are assigned only after retrieving the platform account, never by customer metadata.
   const platform=z.object({id:z.string()}).parse(await stripeRequest('/v1/account'));const found=matches.find(([,id])=>id===(eventAccount||platform.id));if(!found)throw Error('PROVIDER_MISMATCH');org=found[0];}
  const merchant=await merchantFor(org,false);if((event.account||undefined)!==(merchant.connected?merchant.accountId:undefined))throw Error('PROVIDER_MISMATCH');
  if(event.type.startsWith('checkout.session.'))await reconcileSession(z.string().regex(/^cs_/).parse(obj.id),merchant);
  else if(event.type==='charge.refunded'||event.type==='refund.updated')await reconcileRefunds(z.string().regex(/^ch_/).parse(event.type==='charge.refunded'?obj.id:obj.charge),merchant);
  else{const chargeId=z.string().regex(/^ch_/).parse(obj.charge),charge=z.object({payment_intent:z.string()}).parse(await stripeRequest('/v1/charges/'+encodeURIComponent(chargeId),merchant));const pi=z.object({metadata:z.record(z.string(),z.string())}).parse(await stripeRequest('/v1/payment_intents/'+encodeURIComponent(charge.payment_intent),merchant));if(pi.metadata.integration!=='ynsg')return NextResponse.json({received:true});z.uuid().parse(pi.metadata.order);if(pi.metadata.organization!==org)throw Error('PROVIDER_MISMATCH');await stripeStore(org,pi.metadata.order,'alert',{accountId:merchant.accountId,providerId:event.id,status:obj.status||'review_required',eventType:event.type,chargeId});}
  return NextResponse.json({received:true});
 }catch{return NextResponse.json({error:'Payment reconciliation needs retry.'},{status:500});}
}
