import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {merchantMap,STRIPE_API_VERSION,stripeSession,stripeFacts} from './stripe-core.ts';
type Merchant={organization:string;accountId:string;connected:boolean};
export function stripeConfigured(org:string){try{return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')&&process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')&&merchantMap(process.env.STRIPE_MERCHANTS_JSON)[org]&&process.env.APP_ORIGIN&&process.env.SUPABASE_SERVICE_ROLE_KEY);}catch{return false;}}
export async function stripeRequest(path:string,merchant?:Merchant,body?:URLSearchParams,key?:string):Promise<unknown>{
 const secret=process.env.STRIPE_SECRET_KEY;if(!secret?.startsWith('sk_live_'))throw Error('STRIPE_SETUP_REQUIRED');
 if(!path.startsWith('/v1/')||path.includes('://'))throw Error('VALIDATION');
 const r=await fetch('https://api.stripe.com'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,'Stripe-Version':STRIPE_API_VERSION,...(merchant?.connected?{'Stripe-Account':merchant.accountId}:{}),...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error([400,401,403,404].includes(r.status)?'STRIPE_REQUEST_REJECTED':'STRIPE_PROVIDER_UNAVAILABLE');return r.json();
}
export async function merchantFor(org:string,requireCharges=true):Promise<Merchant>{
 const accountId=merchantMap(process.env.STRIPE_MERCHANTS_JSON)[org];if(!accountId||!stripeConfigured(org))throw Error('STRIPE_SETUP_REQUIRED');
 const account=z.object({id:z.string(),charges_enabled:z.boolean(),country:z.string(),default_currency:z.string()}).parse(await stripeRequest('/v1/account'));
 const merchant={organization:org,accountId,connected:accountId!==account.id};
 const target=merchant.connected?z.object({id:z.string(),charges_enabled:z.boolean(),country:z.string(),default_currency:z.string()}).parse(await stripeRequest('/v1/account',merchant)):account;
 if(target.id!==accountId||(requireCharges&&!target.charges_enabled)||target.country!=='US'||target.default_currency!=='usd')throw Error('STRIPE_MERCHANT_REQUIRED');return merchant;
}
export async function stripeStore(org:string,order:string|null,action:string,data:Record<string,unknown>={}){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('STRIPE_SETUP_REQUIRED');
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const r=await db.rpc('stripe_store',{p_org:org,p_order:order,p_action:action,p_data:data});if(r.error)throw Error(r.error.message);return r.data;
}
const orderSchema=z.object({id:z.uuid(),organization_id:z.uuid(),invoice_id:z.uuid(),cents:z.number().int().positive(),account_id:z.string(),session_id:z.string().nullable(),status:z.string(),expires_at:z.number().int()});
export async function reconcileSession(sessionId:string,merchant:Merchant){
 const s=stripeSession.parse(await stripeRequest('/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=payment_intent.latest_charge.balance_transaction',merchant));
 if(!s.livemode||s.metadata.organization!==merchant.organization)throw Error('PROVIDER_MISMATCH');
 const order=orderSchema.parse(await stripeStore(merchant.organization,s.metadata.order,'read'));
 if(order.account_id!==merchant.accountId||order.cents!==s.amount_total||(order.session_id&&order.session_id!==s.id))throw Error('PROVIDER_MISMATCH');
 if(s.status==='expired'){await stripeStore(merchant.organization,order.id,'expired',{accountId:merchant.accountId,sessionId:s.id});return;}
 if(s.payment_status!=='paid')return;
 if(!order.session_id)await stripeStore(merchant.organization,order.id,'session',{accountId:merchant.accountId,sessionId:s.id,url:s.url});
 const pi=z.object({id:z.string().regex(/^pi_/),status:z.literal('succeeded'),amount_received:z.number().int(),currency:z.literal('usd'),latest_charge:z.object({id:z.string().regex(/^ch_/),paid:z.literal(true),captured:z.literal(true),amount:z.number().int(),balance_transaction:z.unknown()})}).parse(s.payment_intent);
 if(pi.amount_received!==order.cents||pi.latest_charge.amount!==order.cents)throw Error('PROVIDER_MISMATCH');
 const charge=pi.latest_charge;let bt=charge.balance_transaction;if(typeof bt==='string')bt=await stripeRequest('/v1/balance_transactions/'+encodeURIComponent(bt),merchant);
 const facts=stripeFacts(bt,charge.id,order.cents);
 await stripeStore(merchant.organization,order.id,'payment',{accountId:merchant.accountId,sessionId:s.id,paymentIntent:pi.id,chargeId:charge.id,providerId:charge.id,...facts});
}
export async function reconcileRefunds(chargeId:string,merchant:Merchant){
 const charge=z.object({id:z.string(),payment_intent:z.string()}).parse(await stripeRequest('/v1/charges/'+encodeURIComponent(chargeId),merchant));
 const pi=z.object({metadata:z.record(z.string(),z.string())}).parse(await stripeRequest('/v1/payment_intents/'+encodeURIComponent(charge.payment_intent),merchant));
 if(pi.metadata.integration!=='ynsg')return;z.uuid().parse(pi.metadata.order);
 if(pi.metadata.organization!==merchant.organization)throw Error('PROVIDER_MISMATCH');
 let cursor='';for(let page=0;page<50;page++){
  const q=new URLSearchParams({charge:chargeId,limit:'100',...(cursor?{starting_after:cursor}:{})});
  const list=z.object({has_more:z.boolean(),data:z.array(z.object({id:z.string().regex(/^re_/),status:z.string(),amount:z.number().int().positive(),balance_transaction:z.unknown()}))}).parse(await stripeRequest('/v1/refunds?'+q,merchant));
  for(const r of list.data){if(r.status!=='succeeded')continue;let bt=r.balance_transaction;if(typeof bt==='string')bt=await stripeRequest('/v1/balance_transactions/'+encodeURIComponent(bt),merchant);const facts=stripeFacts(bt,r.id,-r.amount);await stripeStore(merchant.organization,pi.metadata.order,'refund',{accountId:merchant.accountId,providerId:r.id,chargeId,...facts});}
  if(!list.has_more)return;cursor=list.data.at(-1)?.id||'';if(!cursor)throw Error('PROVIDER_MISMATCH');
 }throw Error('STRIPE_RECONCILIATION_LIMIT');
}
