// Read-only independent monitor. No credentials, customer data or writes.
import assert from 'node:assert/strict';
export async function checkProduction(fetcher=fetch){
 const checks=[
  ['https://www.yourneighborhoodserviceguy.com/request','calendar'],
  ['https://yourneighborhoodserviceguy.app/sign-in','owner'],
  ['https://yourneighborhoodserviceguy.app/api/health','health'],
 ];
 await Promise.all(checks.map(async([url,kind])=>{
  const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'YNSG-read-only-health-check'}});
  assert.equal(r.status,200,kind+' returned '+r.status);
  if(kind==='health'){const d=await r.json();assert.equal(d.status,'ok');assert.ok(Number.isFinite(Date.parse(d.checkedAt))&&Math.abs(Date.now()-Date.parse(d.checkedAt))<120000,'Health response is stale');}
  else{const text=await r.text();assert.ok(text.length>1000,kind+' did not return a full page');if(kind==='calendar'){assert.ok(text.includes('Appointment month calendar'));for(const id of ['appointment-days','appointment-times','request-form'])assert.ok(text.includes('id="'+id+'"'));}else assert.ok(text.includes('Owner sign in')&&text.includes('action="/auth/access"'),'Owner entry missing');}
 }));
 return 'PASS: public request page, owner entry and independent worker/mail health';
}
if(process.argv[1]?.endsWith('/check-production.mjs'))checkProduction().then(console.log).catch(e=>{console.error('Production check failed:',e.message);process.exitCode=1;});
