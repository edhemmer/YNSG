import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,failure} from '../../../../lib/session';
import {merchantFor,stripeRequest,stripeStore,reconcileSession} from '../../../../lib/stripe-server';
import {stripeSession} from '../../../../lib/stripe-core';
const input=z.object({organization:z.uuid(),invoice:z.uuid(),amountCents:z.number().int().positive().max(999999999),action:z.enum(['create','cancel'])}).strict();
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403});
 try{const raw=await request.text();if(raw.length>2000)throw Error('VALIDATION');const v=input.parse(JSON.parse(raw));const {db}=await authenticated();
 const access=await db.rpc('invoice_payment_context',{p_org:v.organization,p_invoice:v.invoice});if(access.error)throw Error('FORBIDDEN');
 const merchant=await merchantFor(v.organization,v.action!=="cancel");await stripeStore(v.organization,null,'merchant',{accountId:merchant.accountId});
 const prepared=await db.rpc('prepare_card_payment',{p_org:v.organization,p_invoice:v.invoice,p_cents:v.amountCents,p_account:merchant.accountId});if(prepared.error)throw Error(prepared.error.message);
 const order=z.object({id:z.uuid(),session_id:z.string().nullable(),expires_at:z.number().int(),status:z.string()}).parse(prepared.data);
 // A stable database order is the provider idempotency key, including retries after a lost response.
 const returnUrl=new URL('/invoice',process.env.APP_ORIGIN);returnUrl.search=new URLSearchParams({organization:v.organization,invoice:v.invoice,return:'account'}).toString();
 const form=new URLSearchParams({mode:'payment','payment_method_types[0]':'card','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(v.amountCents),'line_items[0][price_data][product_data][name]':'Payment toward your service invoice','line_items[0][quantity]':'1',success_url:returnUrl.toString(),cancel_url:returnUrl.toString(),expires_at:String(order.expires_at),'metadata[integration]':'ynsg','metadata[organization]':v.organization,'metadata[order]':order.id,'payment_intent_data[metadata][integration]':'ynsg','payment_intent_data[metadata][organization]':v.organization,'payment_intent_data[metadata][order]':order.id});
 let sessionRaw:unknown;try{sessionRaw=order.session_id?await stripeRequest('/v1/checkout/sessions/'+encodeURIComponent(order.session_id),merchant):await stripeRequest('/v1/checkout/sessions',merchant,form,'ynsg-card-'+order.id);}catch(e){if(e instanceof Error&&e.message==='STRIPE_REQUEST_REJECTED'&&!order.session_id)await stripeStore(v.organization,order.id,'failed',{accountId:merchant.accountId});throw e;}
 const s=stripeSession.parse(sessionRaw);
 if(s.metadata.organization!==v.organization||s.metadata.order!==order.id||s.amount_total!==v.amountCents||!s.livemode)throw Error('PROVIDER_MISMATCH');
 if(v.action==='cancel'&&s.status==='open'){await stripeRequest('/v1/checkout/sessions/'+encodeURIComponent(s.id)+'/expire',merchant,new URLSearchParams(),'ynsg-cancel-'+order.id);await stripeStore(v.organization,order.id,'expired',{accountId:merchant.accountId,sessionId:s.id});return NextResponse.json({status:'expired'});}
 if(s.status!=='open'){await reconcileSession(s.id,merchant);return NextResponse.json({status:s.status});}
 if(!s.url||new URL(s.url).origin!=='https://checkout.stripe.com')throw Error('PROVIDER_MISMATCH');
 await stripeStore(v.organization,order.id,'session',{accountId:merchant.accountId,sessionId:s.id,url:s.url});return NextResponse.json({status:'open',url:s.url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const code=e instanceof Error?e.message:'';if(['STRIPE_SETUP_REQUIRED','STRIPE_MERCHANT_REQUIRED'].includes(code))return NextResponse.json({error:'Card payments need a verified Stripe merchant and live webhook connection.'},{status:503});if(code==='CARD_PAYMENT_PENDING')return NextResponse.json({error:'A card checkout is already pending. Resolve it before recording another payment.'},{status:409});return failure(e);}
}
