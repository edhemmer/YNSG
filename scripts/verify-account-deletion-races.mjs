import assert from 'node:assert/strict';
// Called only by the disposable native PostgreSQL CI harness, never a production connection.
export async function verifyAccountDeletionRaces(sql){
 const org='96000000-0000-4000-8000-000000000010';
 const uid=n=>`96000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const claim=n=>`begin;set local role authenticated;select set_config('request.jwt.claims','${JSON.stringify({role:'authenticated',sub:uid(n),session_id:uid(n+100),aal:'aal1'})}',true);`;
 const command=(n,p)=>`select public.privacy_command('${JSON.stringify({key:uid(n),organization:org,...p})}');`;
 await sql(`insert into auth.users(id,email_confirmed_at) values('${uid(1)}',now()),('${uid(2)}',now()),('${uid(3)}',now());insert into auth.sessions(id,user_id,aal) values('${uid(101)}','${uid(1)}','aal1'),('${uid(102)}','${uid(2)}','aal1'),('${uid(103)}','${uid(3)}','aal1');insert into public.organizations(id,slug,display_name,timezone) values('${org}','synthetic-privacy-races','Synthetic privacy races','America/Chicago');insert into public.memberships(organization_id,user_id,role) values('${org}','${uid(1)}','owner'),('${org}','${uid(2)}','owner');insert into public.customers(organization_id,id,display_name) values('${org}','${uid(20)}','Synthetic privacy customer');insert into public.customer_access(organization_id,customer_id,user_id) values('${org}','${uid(20)}','${uid(3)}');`);
 await sql(claim(1)+command(201,{action:'policy',revision:0,recordDays:30,auditDays:60,basis:'Synthetic race retention basis',notice:'Synthetic race retention notice',reviewed:true})+'commit;');
 for(const n of [1,2,3]){await sql(claim(n)+command(210+n,{action:'request',request:uid(300+n),secret:'a'.repeat(64)})+'commit;');await sql(claim(1)+command(220+n,{action:'approve',request:uid(300+n),revision:1,policyVersion:1})+'commit;');}
 const prepare=n=>command(230+n,{action:'prepare',request:uid(300+n),revision:1,confirmation:'DELETE MY ACCOUNT',secret:'a'.repeat(64)});
 const race=await Promise.allSettled([sql(claim(1)+prepare(1)+'select pg_sleep(0.5);commit;'),sql(claim(2)+prepare(2)+'select pg_sleep(0.5);commit;')]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.match(race.find(r=>r.status==='rejected').reason.message,/SOLE_OWNER/);
 assert.equal(Number((await sql(`select count(*) from public.memberships where organization_id='${org}' and role='owner' and revoked_at is null;`)).trim()),1);
 const remaining=race[0].status==='fulfilled'?2:1;
 const hold=command(240,{action:'hold',hold:uid(400),reason:'Synthetic hold versus deletion race',reviewOn:'2030-01-01'});
 // Start hold first; prepare must wait for the same organization lock and see the committed hold.
 const first=sql(claim(remaining)+hold+'select pg_sleep(1);commit;');
 const held=await Promise.allSettled([first,sql(claim(3)+prepare(3)+'commit;')]);
 assert.equal(held[0].status,'fulfilled');
 // Whichever transaction wins the lock must produce a valid serial result. If deletion won,
 // the hold applies to retained evidence; if hold won, confirmation is blocked.
 if(held[1].status==='rejected')assert.match(held[1].reason.message,/LEGAL_HOLD/);
 const deleted=race[0].status==='fulfilled'?1:2;
 const lease=n=>`begin;set local role service_role;select public.deletion_recovery('${uid(300+deleted)}','${'a'.repeat(64)}',false,'${uid(500+n)}');select pg_sleep(0.5);commit;`;
 const leases=await Promise.all([sql(lease(1)),sql(lease(2))]);
 assert.equal(leases.filter(s=>s.includes('"busy": true')).length,1);
 assert.equal(leases.filter(s=>s.includes('"user":')).length,1);
 console.log('PASS: concurrent owner deletion preserves one owner; hold/deletion serialize; provider recovery has one lease');
}
