import test from 'node:test';
import assert from 'node:assert/strict';
import {seal,unseal,callbackUri,busyTimes,ownedCalendars,emailRaw,sendEmail,GoogleFailure} from '../apps/web/lib/google-core.ts';
import {projectEvent,eventId,type Projection} from '../apps/web/lib/google-calendar.ts';
test('Google tokens are authenticated, tenant-bound ciphertext',()=>{
 const key=Buffer.alloc(32,7).toString('base64'),encrypted=seal({refresh_token:'synthetic'},key,'tokens:one');
 assert.equal(encrypted.includes('synthetic'),false);assert.deepEqual(unseal(encrypted,key,'tokens:one'),{refresh_token:'synthetic'});
 assert.throws(()=>unseal(encrypted,key,'tokens:two'));assert.throws(()=>unseal(encrypted,Buffer.alloc(32,8).toString('base64'),'tokens:one'));
});
test('Callback is constructed only from an explicit HTTPS origin',()=>{
 assert.equal(callbackUri('https://crm.example.com'),'https://crm.example.com/api/google/callback');
 for(const invalid of ['http://crm.example.com','https://evil@example.com','https://crm.example.com/path','https://crm.example.com/?x=1'])assert.throws(()=>callbackUri(invalid));
});
test('Calendar enumeration paginates and excludes shared read/write calendars',async()=>{
 let calls=0;const transport=(async()=>{calls++;return Response.json(calls===1?{items:[{id:'mine',summary:'Mine',accessRole:'owner'},{id:'shared',accessRole:'writer'}],nextPageToken:'second'}:{items:[{id:'two',summary:'Two',accessRole:'owner'}]});}) as typeof fetch;
 assert.deepEqual((await ownedCalendars('synthetic',transport)).map(c=>c.id),['mine','two']);assert.equal(calls,2);
});
test('Partial Google busy errors cannot be treated as availability',async()=>{
 await assert.rejects(busyTimes('synthetic','mine','2026-10-05T13:00:00Z','2026-10-05T15:00:00Z',(async()=>Response.json({calendars:{mine:{errors:[{reason:'forbidden'}],busy:[]}}})) as typeof fetch),/BUSY_DATA_UNAVAILABLE/);
});
test('Gmail rejects header injection and never retries an ambiguous send',async()=>{
 assert.throws(()=>emailRaw('a@example.com','b@example.com\r\nBcc: c@example.com','Hello','Body','test'));
 let calls=0;await assert.rejects(sendEmail('synthetic','raw',(async()=>{calls++;throw new Error('timeout');}) as typeof fetch),(e:unknown)=>e instanceof GoogleFailure&&e.code==='PROVIDER_UNREACHABLE');assert.equal(calls,1);
 const raw=emailRaw('a@example.com','a@example.com','Gmail test','Unicode ✓','test-one');assert.match(Buffer.from(raw,'base64url').toString(),/Content-Transfer-Encoding: base64/);
});
const projection:Projection={organization:'org-one',appointment:'appointment-one',revision:2,start:'2026-10-05T13:00:00Z',end:'2026-10-05T15:00:00Z',timezone:'America/Chicago',status:'reserved',calendar:'mine'};
test('Calendar retry preserves event identity and detects external edits without a write',async()=>{
 assert.equal(eventId(projection),eventId({...projection,revision:3}));
 let writes=0;const transport=(async(_url,init)=>{if(init?.method)writes++;return Response.json({id:eventId(projection),etag:'external-etag',summary:'Moved outside CRM',start:{dateTime:'2026-10-06T13:00:00Z'},end:{dateTime:'2026-10-06T15:00:00Z'},extendedProperties:{private:{ynsgOrganization:projection.organization,ynsgAppointment:projection.appointment,ynsgRevision:'1'}}});}) as typeof fetch;
 const result=await projectEvent('synthetic',projection,{etag:'old-etag',eventId:eventId(projection)},transport);assert.equal(result.state,'needs_review');assert.equal(writes,0);
});
test('Missing previously mapped events require review; unknown insert retries reuse ID',async()=>{
 const missing=(async()=>new Response('',{status:404})) as typeof fetch;
 assert.equal((await projectEvent('synthetic',projection,{etag:'old',eventId:eventId(projection)},missing)).state,'needs_review');
 let posted:Record<string,unknown>|null=null;const transport=(async(_url,init)=>{if(!init?.method)return new Response('',{status:404});posted=JSON.parse(String(init.body));return Response.json({id:eventId(projection),etag:'new'});}) as typeof fetch;
 assert.equal((await projectEvent('synthetic',projection,{etag:null,eventId:null},transport)).state,'synced');assert.equal((posted as Record<string,unknown>|null)?.id,eventId(projection));
});
