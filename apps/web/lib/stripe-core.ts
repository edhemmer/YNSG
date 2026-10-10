import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const STRIPE_API_VERSION='2026-09-30.endive';
export function verifyStripeSignature(raw:string,signature:string,secret:string,nowSeconds=Math.floor(Date.now()/1000)){
 if(!secret.startsWith('whsec_'))throw Error('STRIPE_SETUP_REQUIRED');
 const parts=signature.split(','),times=parts.filter(p=>p.startsWith('t='));
 if(times.length!==1||!/^t=\d+$/.test(times[0]!))throw Error('INVALID_SIGNATURE');
 const timestamp=Number(times[0]!.slice(2));if(!Number.isSafeInteger(timestamp)||Math.abs(nowSeconds-timestamp)>300)throw Error('INVALID_SIGNATURE');
 const expected=createHmac('sha256',secret).update(timestamp+'.'+raw).digest();
 const accepted=parts.filter(p=>/^v1=[a-f0-9]{64}$/.test(p)).some(p=>timingSafeEqual(expected,Buffer.from(p.slice(3),'hex')));
 if(!accepted)throw Error('INVALID_SIGNATURE');
 return z.object({id:z.string().regex(/^evt_/),type:z.string(),livemode:z.boolean(),account:z.string().optional(),data:z.object({object:z.record(z.string(),z.unknown())})}).parse(JSON.parse(raw));
}
export const balanceTransaction=z.object({id:z.string().regex(/^txn_/),amount:z.number().int(),fee:z.number().int(),net:z.number().int(),currency:z.literal('usd'),created:z.number().int().positive(),source:z.string()}).refine(t=>t.net===t.amount-t.fee);
export function stripeFacts(raw:unknown,source:string,amount:number){const t=balanceTransaction.parse(raw);if(t.source!==source||t.amount!==amount)throw Error('PROVIDER_MISMATCH');return {amountCents:t.amount,feeCents:t.fee,netCents:t.net,currency:t.currency,occurredAt:new Date(t.created*1000).toISOString(),balanceTransaction:t.id};}
export const stripeSession=z.object({id:z.string().regex(/^cs_/),url:z.string().nullable(),status:z.string(),payment_status:z.string(),amount_total:z.number().int(),currency:z.literal('usd'),livemode:z.boolean(),metadata:z.object({organization:z.uuid(),order:z.uuid()}),payment_intent:z.union([z.string(),z.null(),z.record(z.string(),z.unknown())])});
export function merchantMap(raw:string|undefined){
 if(!raw)throw Error('STRIPE_SETUP_REQUIRED');
 const mapping=z.record(z.uuid(),z.string().regex(/^acct_[A-Za-z0-9]+$/)).parse(JSON.parse(raw));
 if(new Set(Object.values(mapping)).size!==Object.keys(mapping).length)throw Error('STRIPE_MERCHANT_AMBIGUOUS');return mapping;
}
