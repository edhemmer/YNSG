import test from 'node:test';
import assert from 'node:assert/strict';
import {completeInvoicePayments} from '../apps/web/lib/complete-invoice-payments.ts';
const org='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000002',pid='40000000-0000-4000-8000-000000000001';
const invoice={id,total_cents:12000};
const payment={id:pid,organization_id:org,invoice_id:id,cents:6001,method:'cash',reference:'Synthetic cash receipt',received_at:'2026-10-19T00:00:00Z',reverses_payment_id:null as string|null};
function database(options:{rows?:unknown;count?:number|null;current?:unknown;currentCount?:number;error?:unknown}={}){
 const calls:any[]=[];const db={from:(table:string)=>{const call:any={table};calls.push(call);const chain:any={select:(fields:string,config:any)=>{call.fields=fields;call.config=config;return chain;},eq:(field:string,value:unknown)=>{(call.eq??=[]).push([field,value]);return chain;},in:(field:string,value:unknown)=>{call.in=[field,value];return chain;},order:()=>chain,limit:(n:number)=>{call.limit=n;return chain;},then:(resolve:any)=>resolve(table==='payments'?{data:options.rows===undefined?[payment]:options.rows,count:options.count===undefined?1:options.count,error:options.error||null}:{data:options.current===undefined?[invoice]:options.current,count:options.currentCount??1,error:null})};return chain;}};return {db:db as any,calls};
}
test('complete scoped receipts preserve corrections, original invoice fields and exact-cent balances',async()=>{
 const correction={...payment,id:other,cents:-6001,method:'cash_correction',reverses_payment_id:pid};
 const {db,calls}=database({rows:[payment,correction],count:2});
 const original={...invoice,snapshot:{original:'retained'}};
 const result=await completeInvoicePayments(db,org,[original]);
 assert.deepEqual(result,[{...original,payments:[{cents:6001},{cents:-6001}]}]);assert.equal(Object.hasOwn(original,'payments'),false);
 assert.deepEqual(calls[0].in,['invoice_id',[id]]);assert.deepEqual(calls[0].eq,[['organization_id',org]]);assert.equal(calls[0].config.count,'exact');assert.equal(calls[1].table,'invoices');
});
test('row ceilings, missing counts, null arrays and backend errors never become zero receipts',async()=>{
 for(const options of [{count:2},{count:null},{rows:null},{error:{message:'private'}},{rows:[],count:1}])await assert.rejects(completeInvoicePayments(database(options).db,org,[invoice]));
 const {db}=database({rows:[],count:0});assert.deepEqual((await completeInvoicePayments(db,org,[invoice]))[0]!.payments,[]);
});
test('foreign/duplicate receipts, orphan corrections, invalid amounts and net overpayment fail',async()=>{
 const invalid=[[payment,payment],[{...payment,organization_id:other}],[{...payment,invoice_id:other}],[{...payment,cents:12001}],[{...payment,cents:1.5}],[{...payment,cents:-1,method:'stripe_refund'}],[{...payment,cents:-6001,method:'cash_correction',reverses_payment_id:other}]];
 for(const rows of invalid)await assert.rejects(completeInvoicePayments(database({rows,count:rows.length}).db,org,[invoice]));
});
test('mid-read tenant revocation, changed total, foreign identity and duplicate parents fail',async()=>{
 for(const current of [[],[{...invoice,total_cents:13000}],[{...invoice,id:other}],[invoice,invoice]])await assert.rejects(completeInvoicePayments(database({current,currentCount:current.length}).db,org,[invoice]));
 await assert.rejects(completeInvoicePayments(database().db,org,[invoice,invoice]));
});
test('empty invoice selection makes no payment query, and batch queries stay scoped',async()=>{
 const h=database();assert.deepEqual(await completeInvoicePayments(h.db,org,[]),[]);assert.equal(h.calls.length,0);
 const invoices=Array.from({length:101},(_,i)=>({id:'30000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),total_cents:12000}));
 const batches:string[][]=[];
 const db:any={from:(table:string)=>{let ids:string[]=[];const c:any={select:()=>c,eq:()=>c,in:(_:string,value:string[])=>{ids=value;if(table==='payments')batches.push(ids);return c;},order:()=>c,limit:()=>c,then:(resolve:any)=>resolve(table==='payments'?{data:[],count:0,error:null}:{data:invoices.filter(i=>ids.includes(i.id)),count:ids.length,error:null})};return c;}};
 assert.equal((await completeInvoicePayments(db,org,invoices)).length,101);assert.deepEqual(batches.map(b=>b.length),[100,1]);
});
