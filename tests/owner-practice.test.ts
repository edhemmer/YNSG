import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeStore,seedPractice,restorePractice,PRACTICE_ORG} from '../apps/web/lib/practice-store.ts';
import {isPracticePath} from '../apps/web/lib/practice-scope.ts';
import {customerDetail,customerList} from '../apps/web/lib/customer-record-contract.ts';
import {mileageReport,verifiedMileageReceipt} from '../apps/web/lib/mileage-contract.ts';
const read=async(s:ReturnType<typeof createPracticeStore>,path:string)=>{const r=await s.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json();};
const post=(s:ReturnType<typeof createPracticeStore>,path:string,body:unknown)=>s.fetch(path,{method:'POST',body:JSON.stringify(body)});
const command=(s:ReturnType<typeof createPracticeStore>,body:Record<string,unknown>)=>post(s,'/api/commands',{organizationId:PRACTICE_ORG,key:crypto.randomUUID(),...body});
test('practice is opt-in by exact pathname, never by query parameter or company id',()=>{
 assert.equal(isPracticePath('/owner/practice'),true);assert.equal(isPracticePath('/owner/practice/'),true);
 for(const path of ['/owner','/owner?practice=true','/owner/practice-other','/owner/practice/invoice','/account'])assert.equal(isPracticePath(path),false);
});
test('six coherent sample states include unpaid and paid invoice documents',async()=>{
 const s=createPracticeStore(),data=await read(s,'/api/request-inbox?organization='+PRACTICE_ORG+'&filter=all');assert.equal(data.requests.length,6);
 assert.equal(data.requests[0].status,'submitted');assert.deepEqual(data.jobs.map((j:any)=>j.status),['scheduled','working','completed','completed','completed']);
 assert.equal(s.document(data.invoices[0].id).balanceCents,6000);assert.equal(s.document(data.invoices[1].id).balanceCents,0);assert.equal(s.document(data.invoices[0].id).sample,true);
 for(const d of s.snapshot().customers)customerDetail.parse(d);
});
test('practice transport rejects foreign companies, network targets, imports, files, providers and unknown routes',async()=>{
 const s=createPracticeStore(),before=s.snapshot();
 for(const path of ['https://example.com/api/commands','//example.com/api/commands','/api/../commands','/api/session','/api/customer-files?organization=other','/api/stripe/checkout?organization='+PRACTICE_ORG])assert.ok(!(await s.fetch(path)).ok,path);
 for(const path of ['/api/customer-files','/api/customer-import','/api/invoice-delivery','/api/customer-delegate'])assert.ok(!(await post(s,path,{organization:PRACTICE_ORG,key:crypto.randomUUID()})).ok,path);
 assert.deepEqual(s.snapshot(),before);
});
test('start pause resume and completion use the real response shapes and preserve stale revisions',async()=>{
 const s=createPracticeStore();const j=s.snapshot().jobs[0]!;
 async function action(action:string,revision:number){return post(s,'/api/jobs',{organizationId:PRACTICE_ORG,id:j.id,revision,action,key:crypto.randomUUID()});}
 assert.ok((await action('start',1)).ok);assert.equal((await action('pause',1)).status,409);assert.ok((await action('pause',2)).ok);assert.ok((await action('resume',3)).ok);
 const body={organization:PRACTICE_ORG,job:j.id,revision:4,key:crypto.randomUUID(),reviewed:true,lines:[{description:'Sample work completed',recordedMinutes:120,chargedCents:12000,waiverReason:''}]};
 const response=await post(s,'/api/visit-completion',body);assert.ok(response.ok);const d=await response.json();assert.equal(d.result.status,'completed');assert.equal(d.result.revision,5);
 assert.deepEqual(await (await post(s,'/api/visit-completion',body)).json(),d);assert.equal(s.snapshot().jobs[0]!.revision,5);
});
test('sample completion then issuing uses reviewed draft totals and produces a readable sample invoice',async()=>{
 const s=createPracticeStore(),j=s.snapshot().jobs.find(j=>j.status==='completed')!;
 assert.equal((await command(s,{command:'ApproveInvoice',id:j.id,revision:1,totalCents:13000,reviewed:true})).status,409);
 const r=await command(s,{command:'ApproveInvoice',id:j.id,revision:1,totalCents:12000,reviewed:true});assert.ok(r.ok);const d=await r.json();const document=s.document(d.result.id);assert.equal(document.totalCents,12000);assert.equal(document.balanceCents,12000);assert.ok(document.lines.length);assert.equal(document.sample,true);
});
test('partial sample payment exact replay cannot duplicate receipt; overpayment and changed replay are rejected',async()=>{
 const s=createPracticeStore(),invoice=s.snapshot().invoices[0]!,key=crypto.randomUUID(),body={command:'RecordPayment',id:invoice.id,cents:6000,method:'zelle',reference:'Sample only',receivedAt:new Date().toISOString(),confirmed:true,key};
 const a=await command(s,body),b=await command(s,body);assert.ok(a.ok);assert.deepEqual(await a.json(),await b.json());assert.equal(s.document(invoice.id).balanceCents,0);assert.equal(s.snapshot().payments[invoice.id]!.length,2);
 assert.equal((await command(s,{...body,cents:5000})).status,409);assert.equal((await command(s,{...body,key:crypto.randomUUID()})).status,409);
});
test('sample customer edits preserve original submission, validate details and reject stale revision',async()=>{
 const s=createPracticeStore(),d=s.snapshot().customers[0]!,original=structuredClone(s.snapshot().requests[0]!.original_submission),key=crypto.randomUUID(),body={organization:PRACTICE_ORG,customer:d.customer.id,revision:1,key,reason:'Practice edit',action:'update_customer',value:{displayName:'Sample revised customer'}};
 assert.ok((await post(s,'/api/customer-records',body)).ok);assert.deepEqual(s.snapshot().requests[0]!.original_submission,original);
 assert.equal((await post(s,'/api/customer-records',{...body,key:crypto.randomUUID()})).status,409);
 const list=await read(s,'/api/customer-records?organization='+PRACTICE_ORG+'&query=revised');customerList.parse(list);assert.equal(list.items.length,1);
 customerDetail.parse(await read(s,'/api/customer-records?organization='+PRACTICE_ORG+'&customer='+d.customer.id));
});
test('sample mileage records and reversals match real receipt/report contracts without claiming deduction',async()=>{
 const s=createPracticeStore(),entry={...s.snapshot().trips[0]!,id:crypto.randomUUID(),odometerStart:50050,odometerEnd:50058},body={action:'record',key:crypto.randomUUID(),entry};
 const r=await post(s,'/api/mileage',body),result=await r.json();verifiedMileageReceipt(result,JSON.stringify(body));
 const path='/api/mileage?'+new URLSearchParams({organization:PRACTICE_ORG,from:entry.tripDate,to:entry.tripDate,page:'0'});const report=mileageReport.parse(await read(s,path));assert.equal(report.businessMiles,20);
 assert.ok((await post(s,'/api/mileage',{action:'reverse',organization:PRACTICE_ORG,id:entry.id,key:crypto.randomUUID(),reason:'Sample correction only'})).ok);
 assert.equal((await read(s,path)).businessMiles,12);
});
test('reset restores all sample data, and separate practice stores do not share changes',async()=>{
 const seed=seedPractice(),a=createPracticeStore(seed),b=createPracticeStore(seed),r=seed.requests[0]!;
 assert.ok((await command(a,{command:'ReviewRequest',id:r.id,revision:1,status:'reviewing'})).ok);assert.equal(b.snapshot().requests[0]!.status,'submitted');a.reset();assert.equal(a.snapshot().requests[0]!.status,'submitted');
});

test('practice reload validates bounded tab storage and discards malformed or incomplete records',async()=>{
 const s=createPracticeStore(),r=s.snapshot().requests[0]!;
 await command(s,{command:'ReviewRequest',id:r.id,revision:1,status:'reviewing'});
 const raw=JSON.stringify(s.snapshot()),restored=restorePractice(raw);assert.ok(restored);assert.equal(createPracticeStore(restored).snapshot().requests[0]!.status,'reviewing');
 for(const value of ['{bad','{}',JSON.stringify({...s.snapshot(),requests:[{id:r.id}]}),JSON.stringify({...s.snapshot(),payments:null}),' '.repeat(1500001)])assert.equal(restorePractice(value),undefined);
});
test('sample receipt correction restores balance and survives tab reload without live activity',async()=>{
 const s=createPracticeStore(),i=s.snapshot().invoices[0]!,original=s.snapshot().payments[i.id]![0]!;
 const r=await command(s,{command:'ReverseRecordedPayment',id:i.id,paymentId:original.id,reason:'Synthetic mistaken receipt entry',reviewed:true});assert.ok(r.ok);
 assert.equal(s.document(i.id).balanceCents,12000);const restored=restorePractice(JSON.stringify(s.snapshot()));assert.ok(restored);assert.equal(createPracticeStore(restored).document(i.id).balanceCents,12000);
});
