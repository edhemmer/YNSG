// Browser-only UI rehearsal. This is deliberately NOT a database, auth session,
// provider integration, or substitute for canonical PostgreSQL acceptance tests.
import {z} from 'zod';
import {ownerCommandSchema} from './owner-command-contract.ts';
import {customerCommand,customerDetail,customerList,type CustomerDetail} from './customer-record-contract.ts';
import {invoiceRecordState,invoiceRecordCommand} from './invoice-record-contract.ts';
import {mileageEntry,mileageReport,previewMileage,type MileageEntry} from './mileage-contract.ts';
import {relationshipNote,noteCommand} from './relationship-note-contract.ts';
import type {InboxRequest,LinkedQuote,LinkedJob,LinkedInvoice} from './request-inbox.ts';
import {invoiceDocument} from './invoice-document.ts';
import {localMinute,localInstant} from '../../../packages/domain/timezone.ts';
import {visitTimes} from './visit-start.ts';
export const PRACTICE_ORG='f0000000-0000-4000-8000-000000000001';
export const PRACTICE_STORAGE='ynsg.practice.v1';
const id=(group:number,n:number)=>`f${String(group).padStart(7,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scheduling={weekdays:[1,2,3,4,5],earliestStart:480,latestStart:900,endOfDay:1020,bufferMinutes:15,leadMinutes:60,horizonMinutes:43200};
type WorkLine={description:string;recordedMinutes:number;chargedCents:number;waiverReason:string;billingBasis?:string;billingMinutes?:number;unitRateCents?:number};
type PracticeInvoice=LinkedInvoice&{issued_at:string;snapshot:Record<string,unknown>};
type Receipt={id:string;cents:number;method:string;receivedAt:string;reference:string;reversesPayment?:string|null};
type State={version:1;createdAt:string;requests:InboxRequest[];quotes:LinkedQuote[];jobs:LinkedJob[];invoices:PracticeInvoice[];customers:CustomerDetail[];drafts:Record<string,{lines:WorkLine[];jobRevision:number}>;payments:Record<string,Receipt[]>;admin:Record<string,{revision:number;dueDate:string|null;archived:boolean}>;notes:Record<string,{id:string;body:string;created_at:string;request_id:string|null}[]>;trips:MileageEntry[];reversed:Record<string,{at:string;reason:string}>;replays:Record<string,{fingerprint:string;result:unknown}>};
const uuid=z.uuid(),stamp=z.iso.datetime({offset:true});
const line=z.object({description:z.string().min(2).max(1000),recordedMinutes:z.number().int().min(0).max(1440),chargedCents:z.number().int().nonnegative(),waiverReason:z.string().max(1000),billingBasis:z.enum(['fixed','hourly']).optional(),billingMinutes:z.number().int().nonnegative().optional(),unitRateCents:z.number().int().nonnegative().optional()}).strict();
const payment=z.object({id:uuid,cents:z.number().int().refine(n=>n!==0),method:z.enum(['cash','zelle','cash_correction','zelle_correction']),receivedAt:stamp,reference:z.string().max(300),reversesPayment:z.uuid().nullable().optional()}).strict();
const storedState=z.object({version:z.literal(1),createdAt:stamp,
 requests:z.array(z.object({id:uuid,customer_id:uuid.nullable().optional(),status:z.string(),revision:z.number().int().positive(),created_at:stamp,original_submission:z.object({name:z.string(),phone:z.string(),email:z.string(),street:z.string(),city:z.string(),description:z.string().optional(),preferredTime:z.string().optional(),communityRate:z.string().optional(),service:z.string().optional(),task:z.string().optional(),services:z.array(z.object({service:z.string(),task:z.string()})).max(100).optional()}).strict(),appointments:z.array(z.object({id:uuid,request_id:uuid,job_id:uuid.nullable().optional(),status:z.string(),revision:z.number().int().positive(),start_at:stamp,end_at:stamp,arrival_at:stamp,expires_at:stamp.nullable(),replaces_id:uuid.nullable(),customer_response:z.string()}).strict()).max(100)}).strict()).max(100),
 quotes:z.array(z.object({id:uuid,request_id:uuid,status:z.string(),current_version:z.number().int().positive(),quote_versions:z.array(z.object({version:z.number().int().positive(),scope:z.string(),labor_cents:z.number().int().nonnegative(),duration_minutes:z.number().int().positive()}).strict()).max(100)}).strict()).max(100),
 jobs:z.array(z.object({id:uuid,quote_id:uuid,approved_version:z.number().int().positive().optional(),status:z.string(),revision:z.number().int().positive()}).strict()).max(100),
 invoices:z.array(z.object({id:uuid,job_id:uuid,number:z.number().int().positive(),total_cents:z.number().int().nonnegative(),issued_at:stamp,snapshot:z.record(z.string(),z.json()),payments:z.array(z.object({cents:z.number().int()}).strict()).max(100)}).strict()).max(100),
 customers:z.array(customerDetail).max(100),drafts:z.record(z.string(),z.object({lines:z.array(line).max(50),jobRevision:z.number().int().positive()}).strict()),payments:z.record(z.string(),z.array(payment).max(100)),admin:z.record(z.string(),invoiceRecordState),notes:z.record(z.string(),z.array(relationshipNote).max(50)),trips:z.array(mileageEntry).max(500),reversed:z.record(z.string(),z.object({at:stamp,reason:z.string().min(10).max(1000)}).strict()),replays:z.record(z.string(),z.object({fingerprint:z.string().max(100000),result:z.json()}).strict())}).strict();
export function restorePractice(raw:string):State|undefined{
 try{if(raw.length>1500000)return;const parsed=storedState.safeParse(JSON.parse(raw));if(parsed.success)return parsed.data as State;}catch{}return;
}
export function seedPractice(now=new Date()):State{
 const s:State={version:1,createdAt:now.toISOString(),requests:[],quotes:[],jobs:[],invoices:[],customers:[],drafts:{},payments:{},admin:{},notes:{},trips:[],reversed:{},replays:{}};
 const names=['New request','Scheduled visit','Work in progress','Ready to invoice','Partial payment','Paid visit'];
 for(let n=1;n<=6;n++){
  const customer=id(2,n),request=id(3,n),quote=id(4,n),job=id(5,n),invoice=id(6,n),created=now.toISOString();
  const start=new Date(now.getTime()+(n+1)*86400000);start.setUTCHours(15,0,0,0);
  const r:InboxRequest={id:request,customer_id:customer,status:n===1?'submitted':'quoted',revision:1,created_at:created,original_submission:{name:'Sample — '+names[n-1],phone:'202-555-0148',email:`sample${n}@example.invalid`,street:`${100+n} Example Street (sample only)`,city:'DeKalb',description:'PRACTICE ONLY. Assemble a small table and adjust an interior door. Please read the full note before starting. No real visit, customer consent, work or payment is represented.',communityRate:'No',services:[{service:'Home tasks',task:'Furniture assembly'},{service:'Home tasks',task:'Door adjustment'}]},appointments:[]};
  s.requests.push(r);
  s.customers.push({customer:{id:customer,displayName:r.original_submission.name,revision:1,archivedAt:null},contacts:[{id:id(7,n),revision:1,name:r.original_submission.name,email:r.original_submission.email,phone:r.original_submission.phone,relationship:'Sample primary contact'}],properties:[{id:id(8,n),revision:1,street:r.original_submission.street,city:'DeKalb',state:'IL',postalCode:'60115'}],requests:[{id:request,status:r.status,createdAt:created,summary:'Furniture assembly · Door adjustment',address:r.original_submission.street}],requestsMore:false,history:[],historyMore:false});
  if(n===1)continue;
  s.quotes.push({id:quote,request_id:request,status:'accepted',current_version:1,quote_versions:[{version:1,scope:'Sample: assemble the table and adjust the interior door.',labor_cents:12000,duration_minutes:120}]});
  s.jobs.push({id:job,quote_id:quote,approved_version:1,status:n===2?'scheduled':n===3?'working':'completed',revision:1});
  r.appointments.push({id:id(9,n),request_id:request,job_id:job,status:'reserved',revision:1,start_at:start.toISOString(),arrival_at:start.toISOString(),end_at:new Date(start.getTime()+7200000).toISOString(),expires_at:null,replaces_id:null,customer_response:'confirmed'});
  if(n>=4)s.drafts[job]={jobRevision:1,lines:[{description:'Sample: table assembly and door adjustment',recordedMinutes:120,chargedCents:12000,waiverReason:'',billingBasis:'fixed'}]};
  if(n>=5){
   const i:PracticeInvoice={id:invoice,job_id:job,number:Number(localMinute(now.getTime(),'America/Chicago').slice(0,7).replace('-','')+'000'+n),total_cents:12000,issued_at:created,payments:[],snapshot:{configuration:{sellerLegalName:'Your Neighborhood Service Guy — PRACTICE',timezone:'America/Chicago',invoiceTerms:'SAMPLE — NOT A BILL. No money is due.'},recipient:{name:r.original_submission.name,email:r.original_submission.email,phone:r.original_submission.phone,street:r.original_submission.street,city:'DeKalb',region:'IL',postalCode:'60115'},recordedWork:s.drafts[job]!.lines}};
   s.invoices.push(i);s.payments[invoice]=[{id:id(10,n),cents:n===5?6000:12000,method:'cash',receivedAt:created,reference:'Simulated sample receipt — no money received'}];i.payments=s.payments[invoice]!.map(p=>({cents:p.cents}));s.admin[invoice]={revision:0,dueDate:null,archived:false};
  }
 }
 s.trips.push({organizationId:PRACTICE_ORG,id:id(11,1),tripDate:localMinute(now.getTime(),'America/Chicago').slice(0,10),purpose:'Sample supply pickup',origin:'Sample workshop',destination:'Sample supplier',vehicleLabel:'Sample truck',odometerStart:50000,odometerEnd:50012,businessUse:'business',recordedSource:'manual-odometer',jobId:null,notes:'Practice only — no tax deduction.'});
 return s;
}
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function fail(message:string):never{throw Error(message);}
function found<T>(item:T|undefined):T{return item??fail('Sample record not found. Reset practice data if needed.');}
function revision(actual:number,expected:unknown){if(actual!==expected)fail('The sample record changed. Refresh before saving.');}
export function createPracticeStore(initial=seedPractice()){
 let state=structuredClone(initial);
 function cap(){if(JSON.stringify(state).length>1500000)fail('Practice storage is full. Reset the sample data.');}
 function replay(path:string,b:any,change:()=>unknown){
  if(typeof b.key!=='string'||b.key.length<16||b.key.length>128)fail('A practice command key is required.');
  const fingerprint=JSON.stringify([path,b]),saved=state.replays[b.key];
  if(saved){if(saved.fingerprint!==fingerprint)fail('This sample attempt was already used for a different change.');return saved.result;}
  const result=change();state.replays[b.key]={fingerprint,result};return result;
 }
 function invoiceFor(value:string){return found(state.invoices.find(i=>i.id===value));}
 function requestForJob(job:LinkedJob){const q=found(state.quotes.find(q=>q.id===job.quote_id));return found(state.requests.find(r=>r.id===q.request_id));}
 function commands(raw:unknown){
  const b=ownerCommandSchema.parse(raw);
  if(b.organizationId!==PRACTICE_ORG)fail('Only the sample company is available in practice.');
  switch(b.command){
   case 'ReviewRequest':{const r=found(state.requests.find(r=>r.id===b.id));revision(r.revision,b.revision);r.status=b.status;r.revision++;return {ok:true,result:{id:r.id,revision:r.revision}};}
   case 'PublishQuote':{const r=found(state.requests.find(r=>r.id===b.id));revision(r.revision,b.revision);if(b.community&&!b.eligibilityReviewed)fail('Review the sample Community Rate first.');let q=state.quotes.find(q=>q.request_id===b.id);if(q?.status==='accepted')fail('The sample agreement is already accepted.');const version=(q?.current_version||0)+1;const v={version,scope:b.scope,labor_cents:b.minutes*(b.community?4500:6000)/60,duration_minutes:b.minutes};if(q){q.current_version=version;q.quote_versions.push(v);}else{q={id:crypto.randomUUID(),request_id:r.id,status:'sent',current_version:version,quote_versions:[v]};state.quotes.push(q);}r.status='quoted';r.revision++;return {ok:true,result:{id:q.id,revision:r.revision}};}
   case 'ApproveQuote':{const q=found(state.quotes.find(q=>q.id===b.id));revision(q.current_version,b.version);if(q.status!=='sent')fail('This sample quote is not awaiting agreement.');q.status='accepted';const job:LinkedJob={id:crypto.randomUUID(),quote_id:q.id,approved_version:q.current_version,status:'approved',revision:1};state.jobs.push(job);const r=requestForJob(job);for(const a of r.appointments.filter(a=>a.status==='reserved'))a.job_id=job.id;return {ok:true,result:{id:job.id}};}
   case 'ApproveInvoice':{const j=found(state.jobs.find(j=>j.id===b.id));revision(j.revision,b.revision);const draft=found(state.drafts[j.id]);if(j.status!=='completed'||draft.jobRevision!==j.revision||state.invoices.some(i=>i.job_id===j.id))fail('Complete and review the sample work first.');if(b.totalCents!==draft.lines.reduce((n,l)=>n+l.chargedCents,0))fail('The sample draft total changed.');const r=requestForJob(j),i:PracticeInvoice={id:crypto.randomUUID(),job_id:j.id,number:Number(localMinute(Date.now(),'America/Chicago').slice(0,7).replace('-','')+'0010')+state.invoices.length,total_cents:b.totalCents,issued_at:new Date().toISOString(),snapshot:{configuration:{sellerLegalName:'Your Neighborhood Service Guy — PRACTICE',timezone:'America/Chicago',invoiceTerms:'SAMPLE — NOT A BILL. No money is due.'},recipient:{...r.original_submission,region:'IL',postalCode:'60115'},recordedWork:draft.lines},payments:[]};state.invoices.push(i);state.payments[i.id]=[];state.admin[i.id]={revision:0,dueDate:null,archived:false};return {ok:true,result:{id:i.id}};}
   case 'ReverseRecordedPayment':{const i=invoiceFor(b.id),payments=state.payments[i.id]||[],original=found(payments.find(p=>p.id===b.paymentId));if(!['cash','zelle'].includes(original.method)||payments.some(p=>p.reversesPayment===original.id))fail('This sample receipt cannot be corrected again.');const p={id:crypto.randomUUID(),cents:-original.cents,method:original.method+'_correction',receivedAt:new Date().toISOString(),reference:b.reason,reversesPayment:original.id};payments.push(p);i.payments=payments.map(p=>({cents:p.cents}));return {ok:true,result:{id:p.id,paymentId:original.id,invoiceId:i.id,reversed:true,cents:p.cents,balanceCents:i.total_cents-payments.reduce((n,p)=>n+p.cents,0)}};}
   case 'RecordPayment':{const i=invoiceFor(b.id),payments=state.payments[i.id]||[];if(b.cents>i.total_cents-payments.reduce((n,p)=>n+p.cents,0))fail('The sample amount exceeds the remaining balance.');const p={id:crypto.randomUUID(),cents:b.cents,method:b.method,receivedAt:b.receivedAt,reference:b.reference};payments.push(p);state.payments[i.id]=payments;i.payments=payments.map(p=>({cents:p.cents}));return {ok:true,result:{id:p.id}};}
   default:fail('That action is not part of this practice. No live action was attempted.');
  }
 }
 async function fetchPractice(path:string,init:RequestInit={}):Promise<Response>{
  if(init.signal?.aborted)throw new DOMException('Aborted','AbortError');
  // Reject absolute URLs, dot traversal and all non-API paths. No fetch fallback.
  if(!path.startsWith('/api/')||path.startsWith('//')||path.includes('..'))return json({error:'Only local sample actions are available.'},400);
  let b:any={};try{if(init.body){if(typeof init.body!=='string'||init.body.length>100000)return json({error:'Files and non-JSON uploads are disabled in practice.'},400);b=JSON.parse(init.body);}}
  catch{return json({error:'Invalid sample command.'},400);}
  const u=new URL(path,'https://practice.invalid'),method=init.method||'GET',route=u.pathname;
  const org=b.organizationId||b.organization||b.entry?.organizationId||u.searchParams.get('organization');
  if(org!==PRACTICE_ORG)return json({error:'Only the sample company is available here.'},403);
  const before=structuredClone(state);
  try{
   if(method!=='GET'&&method!=='POST')return json({error:'Unsupported practice action.'},405);
   if(method==='POST'){
    cap();
    const result=replay(route,b,()=>{
     if(route==='/api/commands')return commands(b);
     if(route==='/api/jobs'){
      const j=found(state.jobs.find(j=>j.id===b.id));revision(j.revision,b.revision);
      const allowed=b.action==='start'?['scheduled','approved']:b.action==='pause'?['working']:b.action==='resume'?['paused']:[];
      if(!allowed.includes(j.status))fail('That sample work transition is unavailable.');
      if(!requestForJob(j).appointments.some(a=>a.status==='reserved'))fail('Schedule the sample visit first.');
      j.status=b.action==='pause'?'paused':'working';j.revision++;return {ok:true,result:{id:j.id,revision:j.revision,status:j.status}};
     }
     if(route==='/api/invoice-draft'||route==='/api/visit-completion'){
      const j=found(state.jobs.find(j=>j.id===b.job));revision(j.revision,b.revision);
      if(state.invoices.some(i=>i.job_id===j.id)||!['working','paused','completed'].includes(j.status))fail('This sample work cannot be edited.');
      if(!Array.isArray(b.lines)||!b.lines.length||b.lines.length>50||b.lines.some((l:any)=>typeof l.description!=='string'||l.description.length<2||l.description.length>1000||!Number.isInteger(l.recordedMinutes)||l.recordedMinutes<0||!Number.isSafeInteger(l.chargedCents)||l.chargedCents<0))fail('Review the sample work lines.');
      const total=b.lines.reduce((n:number,l:WorkLine)=>n+l.chargedCents,0),q=found(state.quotes.find(q=>q.id===j.quote_id)),approved=found(q.quote_versions.find(v=>v.version===j.approved_version));
      if(total>approved.labor_cents)fail('Sample charges cannot exceed agreed labor.');
      if(route==='/api/visit-completion'){if(b.reviewed!==true)fail('Review the sample completion first.');j.status='completed';}
      j.revision++;state.drafts[j.id]={lines:b.lines,jobRevision:j.revision};return {ok:true,result:{id:j.id,revision:j.revision,status:j.status,totalCents:total}};
     }
     if(route==='/api/invoice-admin'){
      const c=invoiceRecordCommand.parse(b),i=invoiceFor(c.invoice),admin=found(state.admin[i.id]);revision(admin.revision,c.revision);Object.assign(admin,{revision:admin.revision+1,dueDate:c.dueDate,archived:c.archived});return {...admin,reason:c.reason};
     }
     if(route==='/api/customer-records'){
      const c=customerCommand.parse(b);
      if(c.action==='create_customer'){const customerId=crypto.randomUUID();state.customers.push({customer:{id:customerId,displayName:c.value.displayName,revision:1,archivedAt:null},contacts:[],properties:[],requests:[],requestsMore:false,history:[],historyMore:false});return {saved:true,customerId,revision:1,recordId:customerId,recordRevision:1};}
      const d=found(state.customers.find(d=>d.customer.id===c.customer));revision(d.customer.revision,c.revision);let recordId=d.customer.id,recordRevision=d.customer.revision+1;
      if(c.action==='update_customer')d.customer.displayName=c.value.displayName;
      if(c.action==='set_archived'){if(c.archived&&d.requests.some(r=>!['declined','canceled'].includes(r.status)))fail('Resolve the sample open requests before archiving.');d.customer.archivedAt=c.archived?new Date().toISOString():null;}
      if(c.action==='save_contact'||c.action==='save_property'){
       const rows=c.action==='save_contact'?d.contacts:d.properties,old=rows.find(r=>r.id===c.record);if(c.record){if(!old)fail('Sample contact or address not found.');revision(old!.revision,c.recordRevision);recordId=old!.id;recordRevision=old!.revision+1;Object.assign(old,{...c.value,revision:recordRevision});}else{recordId=crypto.randomUUID();recordRevision=1;(rows as unknown[]).push({id:recordId,revision:1,...c.value});}
      }
      d.customer.revision++;d.history.unshift({id:crypto.randomUUID(),kind:c.action==='save_contact'?'contact':c.action==='save_property'?'property':'customer',at:new Date().toISOString(),reason:c.reason||'Practice edit',before:null,after:{practice:true}});d.history=d.history.slice(0,20);
      return {saved:true,customerId:d.customer.id,revision:d.customer.revision,recordId,recordRevision};
     }
     if(route==='/api/notes'){const c=noteCommand.parse(b);const notes=state.notes[c.type+':'+c.target]||[];const note={id:crypto.randomUUID(),body:c.body,created_at:new Date().toISOString(),request_id:c.type==='request'?c.target:null};notes.unshift(note);state.notes[c.type+':'+c.target]=notes.slice(0,50);return {ok:true,result:{id:note.id,saved:true}};}
     if(route==='/api/mileage'){
      if(b.action==='record'){const e=mileageEntry.parse(b.entry);if(state.trips.some(t=>t.id===e.id))fail('This sample trip already exists.');const p=previewMileage(e);state.trips.push(e);return {result:{id:e.id,miles:p.miles,businessMiles:p.businessMiles,reversed:false}};}
      if(b.action==='reverse'&&typeof b.reason==='string'&&b.reason.trim().length>=10){found(state.trips.find(t=>t.id===b.id));if(state.reversed[b.id])fail('Sample trip already reversed.');state.reversed[b.id]={at:new Date().toISOString(),reason:b.reason};return {result:{id:b.id,reversed:true}};}
     }
     if(route==='/api/scheduling-review'){
      const r=found(state.requests.find(r=>r.id===b.requestId));revision(r.revision,b.requestRevision);
      const start=localInstant(b.localStart,'America/Chicago'),duration=Number(b.durationMinutes),end=start+duration*60000;
      if(!Number.isFinite(start)||!Number.isInteger(duration)||duration<120||duration>1440||!visitTimes(b.localStart.slice(0,10),scheduling).includes(b.localStart.slice(11)))fail('Choose a valid sample visit time.');
      if(state.requests.some(other=>other.id!==r.id&&other.appointments.some(a=>a.status==='reserved'&&start<Date.parse(a.end_at)+900000&&end>Date.parse(a.start_at)-900000)))fail('That sample time overlaps another visit and its travel buffer. Choose another time.');
      for(const a of r.appointments.filter(a=>a.status==='reserved'))a.status='superseded';
      const j=state.jobs.find(j=>state.quotes.some(q=>q.id===j.quote_id&&q.request_id===r.id)),a={id:crypto.randomUUID(),request_id:r.id,job_id:j?.id||null,status:'reserved',revision:1,start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),arrival_at:new Date(start+Number(b.arrivalOffsetMinutes||0)*60000).toISOString(),expires_at:null,replaces_id:null,customer_response:'confirmed'};
      r.appointments.push(a);r.revision++;if(j&&j.status==='approved')j.status='scheduled';return {result:{id:a.id,status:'reserved'},delivery:{status:'disabled'}};
     }
     fail('This action is unavailable in practice. No live data or provider was contacted.');
    });cap();return json(result);
   }
   if(route==='/api/request-inbox'){
    let requests=state.requests;const selected=u.searchParams.get('request'),search=(u.searchParams.get('search')||'').toLowerCase(),filter=u.searchParams.get('filter');
    if(selected)requests=requests.filter(r=>r.id===selected);else if(filter==='closed')requests=requests.filter(r=>['declined','canceled'].includes(r.status));else if(filter==='review')requests=requests.filter(r=>!['declined','canceled'].includes(r.status));
    if(search)requests=requests.filter(r=>JSON.stringify(r.original_submission).toLowerCase().includes(search));
    return json({requests,quotes:state.quotes,jobs:state.jobs,invoices:state.invoices,preferences:[],checkedAt:new Date().toISOString(),total:requests.length,needsReview:state.requests.filter(r=>r.status==='submitted').length,page:0,hasMore:false});
   }
   if(route==='/api/invoice-draft'){const j=found(state.jobs.find(j=>j.id===u.searchParams.get('job')));return json({draft:state.drafts[j.id]||null,tax:{required:false,rules:[],valid:true,tax:null},readiness:{ready:true,reasons:[]}});}
   if(route==='/api/invoice-admin'){const i=invoiceFor(u.searchParams.get('invoice')||'');return json({organization:PRACTICE_ORG,invoice:i.id,admin:state.admin[i.id],payments:state.payments[i.id]||[],orders:[],canManage:true,cardConfigured:false,cardTransactions:[]});}
   if(route==='/api/invoice-delivery'){const i=invoiceFor(u.searchParams.get('invoice')||'');return json({enabled:false,recipient:(i.snapshot.recipient as {email:string}).email,status:'not_requested',paidStatus:'not_queued'});}
   if(route==='/api/customer-records'){
    const target=u.searchParams.get('customer');if(target){const d=structuredClone(found(state.customers.find(d=>d.customer.id===target)));d.requests=d.requests.map(r=>({...r,status:state.requests.find(q=>q.id===r.id)?.status||r.status}));return json(customerDetail.parse(d));}
    const query=(u.searchParams.get('query')||'').toLowerCase(),filter=u.searchParams.get('filter');return json(customerList.parse({items:state.customers.filter(d=>(filter==='all'||(filter==='archived'?!!d.customer.archivedAt:!d.customer.archivedAt))&&d.customer.displayName.toLowerCase().includes(query)).slice(0,20).map(d=>({...d.customer,contactCount:d.contacts.length,addressCount:d.properties.length})),hasMore:false,page:0}));
   }
   if(route==='/api/customer-delegate')return json({delegates:[]});
   if(route==='/api/customer-files')return json({files:[]});
   if(route==='/api/notes')return json({notes:state.notes[u.searchParams.get('type')+':'+u.searchParams.get('target')]||[],page:0,hasMore:false});
   if(route==='/api/mileage'){
    const from=u.searchParams.get('from')||'',to=u.searchParams.get('to')||'',trips=state.trips.filter(t=>t.tripDate>=from&&t.tripDate<=to),active=trips.filter(t=>!state.reversed[t.id]);
    return json(mileageReport.parse({from,to,page:Number(u.searchParams.get('page')||0),businessMiles:active.filter(t=>t.businessUse==='business').reduce((n,t)=>n+t.odometerEnd-t.odometerStart,0),activeTrips:active.length,trips:trips.slice(0,50).map(t=>({id:t.id,trip_date:t.tripDate,purpose:t.purpose,origin:t.origin,destination:t.destination,vehicle_label:t.vehicleLabel,odometer_start:t.odometerStart,odometer_end:t.odometerEnd,business_use:t.businessUse,recorded_source:t.recordedSource,job_id:t.jobId,notes:t.notes,created_at:state.createdAt,reversed_at:state.reversed[t.id]?.at||null,reversal_reason:state.reversed[t.id]?.reason||null})),hasMore:trips.length>50}));
   }
   if(route==='/api/scheduling-review'){
    const r=found(state.requests.find(r=>r.id===u.searchParams.get('request')));return json({minimumDurationMinutes:120,requestRevision:r.revision,configurationVersion:1,scheduleRevision:1,settings:{timezone:'America/Chicago',scheduling},resources:[{id:id(12,1),name:'Sample operator',kind:'operator',status:'available'}],confirmedAppointments:r.appointments.filter(a=>a.status==='reserved').map(a=>({id:a.id,start:a.start_at,end:a.end_at})),allowAdditionalResources:false});
   }
   if(route==='/api/availability'){
    const day=u.searchParams.get('day')||'',duration=Number(u.searchParams.get('durationMinutes')||120),times=visitTimes(day,scheduling).flatMap(time=>{const start=localInstant(day+'T'+time,'America/Chicago'),end=start+duration*60000;if(state.requests.some(r=>r.appointments.some(a=>a.status==='reserved'&&a.id!==u.searchParams.get('replacement')&&start<Date.parse(a.end_at)+900000&&end>Date.parse(a.start_at)-900000)))return [];return [{start:new Date(start).toISOString()}];});
    return json({reserved:false,timezone:'America/Chicago',validUntil:new Date(Date.now()+60000).toISOString(),times});
   }
   return json({error:'This screen is not part of the sample practice. No live data was requested.'},400);
  }catch(error){state=before;return json({error:error instanceof Error&&error.name!=='ZodError'?error.message:'Review the sample fields before saving.'},409);}
 }
 return {fetch:fetchPractice,snapshot:()=>structuredClone(state),reset:()=>{state=seedPractice();},document:(invoice:string)=>({...invoiceDocument(invoiceFor(invoice)),sample:true})};
}
let browserStore:ReturnType<typeof createPracticeStore>|undefined;
export function getBrowserPractice(){
 if(typeof window==='undefined')throw Error('Practice storage is browser-only.');
 if(!browserStore){let seed:State|undefined;try{const saved=sessionStorage.getItem(PRACTICE_STORAGE);if(saved)seed=restorePractice(saved);}catch{}
  browserStore=createPracticeStore(seed);
 }
 return browserStore;
}
export async function browserPracticeFetch(path:string,init?:RequestInit){const store=getBrowserPractice(),result=await store.fetch(path,init);try{sessionStorage.setItem(PRACTICE_STORAGE,JSON.stringify(store.snapshot()));}catch{/* Practice remains usable in memory when storage is unavailable. */}return result;}
export function resetBrowserPractice(){getBrowserPractice().reset();try{sessionStorage.removeItem(PRACTICE_STORAGE);}catch{}}
