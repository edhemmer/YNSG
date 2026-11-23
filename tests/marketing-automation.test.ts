import test from 'node:test';
import assert from 'node:assert/strict';
import {marketingEmail,MONTHS,BUSINESS_MONTHS,JOURNEYS,trackedLink,unsubscribeLink} from '../apps/web/lib/marketing-emails.ts';
import {runMarketing,centralMonth} from '../apps/web/lib/marketing-worker.ts';
import {providerEmail} from '../lib/transactional-email.js';
// Website endpoints are plain JavaScript without type declarations.
type Handler=(req:unknown,res:unknown,deps:Record<string,unknown>)=>Promise<unknown>;
const clickHandler:Handler=(await import('../api/email-click.js' as string)).default;
const unsubscribeHandler:Handler=(await import('../api/unsubscribe.js' as string)).default;

const sendId='5f0c9d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',token='a'.repeat(64);
const base={sendId,token,name:'Pat Synthetic',month:12} as const;

test('every month has a customer and a prospect monthly email that differ',()=>{
 assert.equal(MONTHS.length,12);
 for(let month=1;month<=12;month++){
  const c=marketingEmail({...base,journey:'monthly',audience:'customer',month}),p=marketingEmail({...base,journey:'monthly',audience:'prospect',month});
  assert.equal(c.subject,p.subject);
  assert.notEqual(c.body,p.body,'customer and prospect versions read differently');
  assert.match(c.body,/because you’re a customer/);assert.match(p.body,/contacted or signed up/);
 }
});

test('every journey renders branded, personal, compliant email',()=>{
 for(const journey of JOURNEYS)for(const audience of ['customer','prospect'] as const){
  const m=marketingEmail({...base,journey,audience});
  assert.ok(m.subject.length>5&&m.subject.length<80,journey+' subject length');
  assert.match(m.html,/^<!doctype html>/);assert.match(m.html,/Hi Pat,/);
  assert.match(m.html,new RegExp('unsubscribe\\?t='+token),'visible unsubscribe link');
  assert.match(m.body,/298 Quinlan Ave, DeKalb, IL 60115/,'physical mailing address');
  assert.match(m.html,/298 Quinlan Ave/);
  assert.equal(m.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
  assert.match(m.headers['List-Unsubscribe']!,new RegExp('/api/unsubscribe\\?t='+token+'>'));
  assert.doesNotMatch(m.html+m.body,/\$\d|free estimate|insured|guarantee/i,'no prices, insurance or guarantee claims');
 }
});

test('greeting falls back safely and never injects markup',()=>{
 const m=marketingEmail({...base,journey:'monthly',audience:'prospect',name:'<script>x</script>'});
 assert.match(m.html,/Hi neighbor,/);assert.doesNotMatch(m.html,/<script>/);
});

test('links only point at this website and require a valid send and token',()=>{
 assert.equal(trackedLink(sendId,'/request'),'https://www.yourneighborhoodserviceguy.com/api/email-click?s='+sendId+'&to=%2Frequest');
 assert.throws(()=>trackedLink(sendId,'https://evil.example'));assert.throws(()=>trackedLink('x','/request'));
 assert.throws(()=>unsubscribeLink('nope'));
});

test('provider accepts only one-click unsubscribe headers',async()=>{
 const env={RESEND_API_KEY:'re_test',TRANSACTIONAL_EMAIL_FROM:'YNSG <info@yourneighborhoodserviceguy.com>'};
 let sent:Record<string,unknown>|null=null;
 const transport=(async(_u:string,init:{body:string})=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({id:'re_1'}),{status:200});}) as unknown as typeof fetch;
 const msg={action:'send' as const,organization:sendId,id:sendId,to:'pat@example.invalid',subject:'Hi',body:'x',html:'<p>x</p>'};
 await providerEmail({...msg,headers:{'List-Unsubscribe':'<https://x/u>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}},env,transport);
 assert.deepEqual((sent as unknown as {headers:unknown}).headers,{'List-Unsubscribe':'<https://x/u>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'});
 await assert.rejects(providerEmail({...msg,headers:{'Bcc':'a@b.c'}},env,transport));
 await assert.rejects(providerEmail({...msg,headers:{'List-Unsubscribe':'a\r\nBcc: x'}},env,transport));
});

type Call={name:string;args:Record<string,unknown>};
function fakeDb(claimed:unknown[],enabled=true){
 const calls:Call[]=[];
 return {calls,db:{rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});
  if(name==='marketing_automation_plan')return {data:{enabled,queued:3},error:null};
  if(name==='marketing_automation_claim')return {data:claimed,error:null};
  return {data:{ok:true},error:null};}}};
}
const resend=async()=>({enabled:true as const,ready:true,provider:'resend' as const,origin:'',sender:'x'});
const row=(i:number,journey='monthly')=>({id:sendId.slice(0,-1)+i,journey,audience:'customer',email:`p${i}@example.invalid`,name:'Pat',token,stage:'customer'});

test('worker sends the claimed batch and records each result',async()=>{
 const {calls,db}=fakeDb([row(1),row(2,'welcome')]);const sent:string[]=[];
 const r=await runMarketing(sendId,db as never,(async(_o:string,id:string,m:{headers?:Record<string,string>;replyTo?:string})=>{assert.ok(m.headers?.['List-Unsubscribe']);assert.equal(m.replyTo,'info@yourneighborhoodserviceguy.com');sent.push(id);return 're_'+id;}) as never,resend as never);
 assert.equal(r.sent,2);assert.equal(sent.length,2);
 assert.deepEqual(calls.filter(c=>c.name==='marketing_automation_finish').map(c=>c.args.p_status),['sent','sent']);
});

test('worker pauses on provider limits and keeps the rest in line',async()=>{
 const {calls,db}=fakeDb([row(1),row(2),row(3)]);
 const r=await runMarketing(sendId,db as never,(async()=>{throw Object.assign(Error('MAIL_PROVIDER_UNAVAILABLE'),{status:429});}) as never,resend as never);
 assert.equal(r.sent,0);
 assert.deepEqual(calls.filter(c=>c.name==='marketing_automation_finish').map(c=>c.args.p_status),['queued','queued','queued']);
});

test('worker does nothing when automation is off or email is not set up',async()=>{
 const off=fakeDb([row(1)],false);
 assert.equal((await runMarketing(sendId,off.db as never,(async()=>'x') as never,resend as never)).paused,'off');
 assert.ok(!off.calls.some(c=>c.name==='marketing_automation_claim'));
 const none=fakeDb([row(1)]);
 assert.equal((await runMarketing(sendId,none.db as never,(async()=>'x') as never,(async()=>null) as never)).paused,'mail_service');
 assert.equal(none.calls.length,0);
});

function res(){const r={statusCode:0,headers:{} as Record<string,string>,body:undefined as unknown,status(c:number){r.statusCode=c;return r;},setHeader(k:string,v:string){r.headers[k]=v;},json(b:unknown){r.body=b;return r;},end(){return r;}};return r;}

test('email click records and redirects only within this website',async()=>{
 const seen:string[]=[];const record=async(_r:unknown,id:string)=>{seen.push(id);};
 let r=res();await clickHandler({method:'GET',query:{s:sendId,to:'/leaf-cleanup-dekalb-il'},headers:{'user-agent':'Mozilla/5.0'}},r,{record});
 assert.equal(r.statusCode,302);assert.equal(r.headers.Location,'https://www.yourneighborhoodserviceguy.com/leaf-cleanup-dekalb-il');assert.deepEqual(seen,[sendId]);
 r=res();await clickHandler({method:'GET',query:{s:sendId,to:'//evil.example'},headers:{}},r,{record});
 assert.equal(r.headers.Location,'https://www.yourneighborhoodserviceguy.com/');
 r=res();await clickHandler({method:'GET',query:{s:sendId,to:'/request'},headers:{'user-agent':'Some LinkScanner bot'}},r,{record});
 assert.equal(seen.length,2,'link scanners are not counted as clicks');
 r=res();await clickHandler({method:'GET',query:{s:sendId,to:'/request'},headers:{}},r,{record:async()=>{throw Error('down');}});
 assert.equal(r.statusCode,302,'visitor still reaches the page when recording fails');
});

test('mail apps can unsubscribe in one click with the personal code',async()=>{
 const done:unknown[]=[];
 const r=res();await unsubscribeHandler({method:'POST',query:{t:token},headers:{host:'www.yourneighborhoodserviceguy.com'},body:{'List-Unsubscribe':'One-Click'}},r,{optOut:async(_r:unknown,v:unknown)=>{done.push(v);},env:{}});
 assert.equal(r.statusCode,200);assert.deepEqual(done,[{email:null,token}]);
});


test('business contacts get the business series; a failed lookup falls back to the home series',async()=>{
 const claimed=[row(1),row(2)];const calls:Call[]=[];const subjects:Record<string,string>={};
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});
  if(name==='marketing_automation_plan')return {data:{enabled:true,queued:2},error:null};
  if(name==='marketing_automation_claim')return {data:claimed,error:null};
  if(name==='marketing_business_sends')return {data:[claimed[0]!.id],error:null};
  return {data:{ok:true},error:null};}};
 await runMarketing(sendId,db as never,(async(_o:string,id:string,m:{subject:string})=>{subjects[id]=m.subject;return 're_'+id;}) as never,resend as never);
 const month=centralMonth();
 assert.equal(subjects[claimed[0]!.id],BUSINESS_MONTHS[Math.floor((month-1)/2)]!.subject);
 assert.equal(subjects[claimed[1]!.id],MONTHS[month-1]!.subject);
 assert.deepEqual(calls.find(c=>c.name==='marketing_business_sends')?.args.p_ids,claimed.map(r=>r.id));
 const failing={rpc:async(name:string)=>name==='marketing_automation_plan'?{data:{enabled:true,queued:1},error:null}:name==='marketing_automation_claim'?{data:[row(3)],error:null}:name==='marketing_business_sends'?{data:null,error:{message:'down'}}:{data:{ok:true},error:null}};
 const seen:string[]=[];
 await runMarketing(sendId,failing as never,(async(_o:string,_id:string,m:{subject:string})=>{seen.push(m.subject);return 'x';}) as never,resend as never);
 assert.deepEqual(seen,[MONTHS[month-1]!.subject]);
});

test('business emails stay inside what YNSG can promise',()=>{
 for(let month=1;month<=12;month++)for(const journey of JOURNEYS)for(const audience of ['customer','prospect'] as const){
  const m=marketingEmail({journey,audience,month,name:'Pat',sendId,token,segment:'business'});
  assert.doesNotMatch(m.body,/insured|background[- ]checked|licensed|guarantee|gutter|holiday lights|fixed price|not-to-exceed|\$\d/i,journey+' '+month);
  assert.match(m.body,/Unsubscribe: /);
 }
});
