import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
export async function verifyGoogleReconnectRaces(sql){
 const org='99300000-0000-4000-8000-000000000001';
 const prefix=(await readFile('tests/foundation.sql','utf8')).split('set local role service_role;')[0].replace(/(?:00000000|10000000|20000000|30000000)-/g,'99300000-').replaceAll("'test-one'","'synthetic-google-race-one'").replaceAll("'test-two'","'synthetic-google-race-two'");
 await sql(prefix+`insert into private.google_accounts(organization_id,revision,encrypted_tokens,email,subject,calendar_id) values('${org}',1,'synthetic-old','owner@example.invalid','synthetic-google-race','synthetic-calendar');commit;`);
 const scopes=['openid','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events.owned','https://www.googleapis.com/auth/calendar.freebusy','https://www.googleapis.com/auth/calendar.app.created'];
 const body={revision:1,ciphertext:'synthetic-new',email:'owner@example.invalid',subject:'synthetic-google-race',calendarId:'synthetic-calendar',calendarVerified:true,scopes,actor:org};
 const service=`begin;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);`;
 const attempts=await Promise.allSettled([sql(service+`select public.google_store('${org}','reconnect','${JSON.stringify(body)}');select pg_sleep(0.15);commit;`),sql(service+`select public.google_store('${org}','tokens','{"revision":1,"ciphertext":"synthetic-concurrent-refresh"}');commit;`)]);
 assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);assert.match(attempts.find(a=>a.status==='rejected').reason.message,/STALE_CONNECTION/);
 const row=JSON.parse((await sql(`select jsonb_build_object('revision',revision,'calendar',calendar_id,'subject',subject) from private.google_accounts where organization_id='${org}';`)).trim());assert.deepEqual(row,{revision:2,calendar:'synthetic-calendar',subject:'synthetic-google-race'});
 console.log('PASS: Google reconnect versus token refresh has one revision winner; stale credentials cannot overwrite the saved calendar/account');
}
