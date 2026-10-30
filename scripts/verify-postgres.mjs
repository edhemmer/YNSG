import {withNetworkCatalog} from './sql-fixture-catalog.mjs';
import {verifyOwnerNetworkRaces} from './verify-owner-network-races.mjs';
import {verifyTaskTimeRaces} from './verify-task-time-races.mjs';
import {verifyAccountDeletionRaces} from './verify-account-deletion-races.mjs';
import {captureRecovery,snapshotDatabase} from './capture-recovery.mjs';
import {verifyCustomerFileRestore} from './verify-customer-file-restore.mjs';
import {createHash} from 'node:crypto';
import {generateRecoveryKey,packRecoveryBundle,unpackRecoveryBundle} from './recovery-bundle.mjs';
import {reconcileRecoveryCatalog,verifyRecoveryCatalog} from './verify-recovery-catalog.mjs';
// Synthetic-only PostgreSQL 17 checks inside the explicitly named CI service.
// No production database URL, account credentials, mail provider or customer data.
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const container=process.env.YNSG_TEST_POSTGRES_CONTAINER;
assert.ok(/^[a-f0-9]{12,64}$/.test(container||''),'Use only the disposable PostgreSQL CI service container');
async function run(args,input,binary=false){
 return new Promise((resolve,reject)=>{const child=spawn('docker',['exec','-i',container,...args],{stdio:['pipe','pipe','pipe']});const output=[],errors=[];let size=0;
 child.stdout.on('data',b=>{size+=b.length;if(size>64*1024*1024){child.kill();reject(Error('Fixture output exceeded limit'));}else output.push(b);});child.stderr.on('data',b=>errors.push(b));child.on('error',reject);child.on('exit',code=>{const out=Buffer.concat(output);if(code!==0)reject(Error(Buffer.concat(errors).toString().slice(-3000)||'Fixture command failed'));else resolve(binary?out:out.toString());});child.stdin.end(input);
 });
}
const sql=(input,database='ynsg_test')=>run(['psql','-U','postgres','-d',database,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],input);
const testSource=await readFile('tests/database.mjs','utf8');
const bootstrap=testSource.match(/await db\.exec\(`([\s\S]*?)`\);/)?.[1];assert.ok(bootstrap,'Auth fixture bootstrap not found');
await sql(bootstrap);
for(const path of (await readdir('supabase/migrations')).filter(p=>p.endsWith('.sql')).sort())await sql(await readFile('supabase/migrations/'+path,'utf8'));
const foundation=await readFile('tests/foundation.sql','utf8'),prefix=foundation.split('set local role service_role;')[0];
await sql(foundation);
const fixtures=[...new Set([...testSource.matchAll(/readFile\('tests\/([^']+\.sql)'/g)].map(m=>m[1]))].filter(p=>!['foundation.sql','service-lifecycle.sql','approved-work-window.sql','recurring-series.sql','atomic-owner-visit.sql','mobile-notifications.sql'].includes(p));
for(const file of fixtures){await sql(prefix+await withNetworkCatalog(await readFile('tests/'+file,'utf8')));console.log('PASS: native PostgreSQL '+file);}
const marker="set local role service_role;\nselect set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);\nselect public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','70000000-0000-4000-8000-000000000006'";
const booking=(await readFile('tests/independent-calendar.sql','utf8')).split(marker)[0];assert.ok(!booking.includes('rollback;'),'Booking fixture split changed');
await sql(prefix+booking+await readFile('tests/approved-work-window.sql','utf8'));
console.log('PASS: undersized approved work window cannot start a timer');
await sql(prefix+booking+await readFile('tests/recurring-series.sql','utf8'));
console.log('PASS: weekly year atomicity, persisted travel padding, DST, retries, separate invoices, receipts and guarded stop');
await sql(prefix+(await readFile('tests/mobile-notifications.sql','utf8')).replace('-- CANONICAL_BOOKING',()=>booking));
console.log('PASS: opt-in phone notifications, quiet hours, stale visit, revocation and unknown-result handling');
await sql(prefix+booking+await readFile('tests/atomic-owner-visit.sql','utf8'));
console.log('PASS: atomic work completion rollback, retry, timer closure and permissions');
const lifecycle=await readFile('tests/service-lifecycle.sql','utf8');assert.ok(lifecycle.trim().endsWith('rollback;'));
await sql(prefix+booking+lifecycle.replace(/rollback;\s*$/,'commit;'));
console.log('PASS: canonical service → quote → work → invoice → split receipts committed in synthetic database');
// Two independent requests must enroll one self-owned profile, including exact replay.
await sql(`insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000006','profile-race@example.invalid',now());
 insert into auth.sessions(id,user_id,aal) values('10000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','aal1');
 update public.organizations set status='active' where id='20000000-0000-4000-8000-000000000001';`);
const enrollment=`begin;set local role authenticated;select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000006","session_id":"10000000-0000-4000-8000-000000000006","aal":"aal1"}',true);
 select public.create_customer_profile('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000006','{"name":"Race Synthetic","phone":"5550000000","street":"100 Synthetic Lane","city":"DeKalb","postalCode":"60115"}');commit;`;
const enrolled=await Promise.all([sql(enrollment),sql(enrollment)]);
assert.equal(enrolled[0],enrolled[1],'Concurrent exact enrollment replies must agree');
assert.equal((await sql("select count(*) from public.customer_access where user_id='00000000-0000-4000-8000-000000000006';")).trim(),'1');
console.log('PASS: independent concurrent customer profile enrollment creates one actor-bound customer and one exact receipt');

await sql(`create schema qa_fixture;grant usage on schema qa_fixture to service_role;
 create function qa_fixture.start() returns timestamptz language sql as $$select ((date_trunc('week',clock_timestamp() at time zone 'America/Chicago')+interval '21 days 8 hours') at time zone 'America/Chicago')$$;
 create function qa_fixture.facts() returns jsonb language sql as $$select public.crm_calendar_facts('20000000-0000-4000-8000-000000000001',qa_fixture.start()-interval '1 hour',qa_fixture.start()+interval '3 hours')$$;`);
const hold=n=>`select public.website_slot_hold('20000000-0000-4000-8000-000000000001','select','80000000-0000-4000-8000-${String(n).padStart(12,'0')}',repeat('${n}',64),repeat('${n+2}',64),repeat('${n+4}',64),qa_fixture.start(),qa_fixture.facts());`;
const claim=`begin;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);`;
const race=await Promise.allSettled([sql(claim+hold(1)+'select pg_sleep(1);commit;'),sql(claim+hold(2)+'select pg_sleep(1);commit;')]);
assert.equal(race.filter(r=>r.status==='fulfilled').length,1,'Exactly one simultaneous booking must win');const failed=race.find(r=>r.status==='rejected');assert.match(failed.reason.message,/CAPACITY_CONFLICT|conflicting key|exclusion constraint/);
const winner=race[0].status==='fulfilled'?1:2;
await sql(claim+hold(winner)+'commit;');
assert.equal((await sql("select count(*) from public.appointments where start_at=qa_fixture.start() and status='held';")).trim(),'1');
console.log('PASS: two independent PostgreSQL connections raced the canonical website hold; one reservation, conflict loser and idempotent retry');
const customerRevision=Number((await sql("select revision from public.customers where organization_id='20000000-0000-4000-8000-000000000001' and id='30000000-0000-4000-8000-000000000001';")).trim());assert.ok(customerRevision>0);
const ownerClaim=`begin;set local role authenticated;select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);`;
const customerSave=n=>`select public.manage_customer_record('20000000-0000-4000-8000-000000000001','{"action":"update_customer","customer":"30000000-0000-4000-8000-000000000001","revision":${customerRevision},"value":{"displayName":"Synthetic concurrent ${n}"},"reason":"Synthetic race"}','91000000-0000-4000-8000-${String(n).padStart(12,'0')}');`;
const customerRace=await Promise.allSettled([sql(ownerClaim+customerSave(1)+'select pg_sleep(0.5);commit;'),sql(ownerClaim+customerSave(2)+'select pg_sleep(0.5);commit;')]);assert.equal(customerRace.filter(r=>r.status==='fulfilled').length,1);assert.match(customerRace.find(r=>r.status==='rejected').reason.message,/STALE_REVISION/);
await sql(ownerClaim+customerSave(customerRace[0].status==='fulfilled'?1:2)+'commit;');assert.equal(Number((await sql("select revision from public.customers where organization_id='20000000-0000-4000-8000-000000000001' and id='30000000-0000-4000-8000-000000000001';")).trim()),customerRevision+1);
console.log('PASS: two customer corrections raced one parent revision; one winner, one stale rejection and exact saved-result replay');
// A receipt correction races on the invoice lock and unique original-payment link.
const correctionTarget=JSON.parse((await sql("select jsonb_build_object('invoice',p.invoice_id,'payment',p.id) from public.payments p where p.method='cash' and not exists(select 1 from public.payments r where r.organization_id=p.organization_id and r.reverses_payment_id=p.id) limit 1;")).trim());
const correctReceipt=n=>`select public.reverse_recorded_payment('20000000-0000-4000-8000-000000000001','${correctionTarget.invoice}','${correctionTarget.payment}','Synthetic concurrent receipt correction','native-correction-race-0${n}');`;
const receiptRace=await Promise.allSettled([sql(ownerClaim+correctReceipt(1)+'select pg_sleep(0.5);commit;'),sql(ownerClaim+correctReceipt(2)+'select pg_sleep(0.5);commit;')]);assert.equal(receiptRace.filter(r=>r.status==='fulfilled').length,1);assert.match(receiptRace.find(r=>r.status==='rejected').reason.message,/PAYMENT_ALREADY_REVERSED/);
await sql(ownerClaim+correctReceipt(receiptRace[0].status==='fulfilled'?1:2)+'commit;');
assert.equal(Number((await sql(`select count(*) from public.payments where reverses_payment_id='${correctionTarget.payment}';`)).trim()),1);
await sql(ownerClaim+`select public.record_payment('20000000-0000-4000-8000-000000000001','${correctionTarget.invoice}',5000,'cash','Synthetic corrected receipt after race',now(),true,'native-corrected-receipt-01');commit;`);
console.log('PASS: two receipt corrections race one invoice; one opposite entry, rejected loser, exact replay and corrected settlement');
// Credits share the canonical invoice lock with receipts; races cannot over-settle it.
const creditOrg='20000000-0000-4000-8000-000000000001',creditInvoice=correctionTarget.invoice;
await sql(ownerClaim+`select public.reverse_recorded_payment('${creditOrg}','${creditInvoice}',(select id from public.payments where invoice_id='${creditInvoice}' and method='cash' and cents=5000 and not exists(select 1 from public.payments r where r.reverses_payment_id=payments.id) limit 1),'Synthetic credit race setup','native-credit-reopen');commit;`);
const issueCredit=(n,revision)=>`select public.invoice_credit_command('${creditOrg}','${creditInvoice}',${revision},'{"action":"issue","subtotalCents":4000,"taxCents":[],"reason":"Synthetic reviewed concurrent credit","reviewed":true}','95000000-0000-4000-8000-${String(n).padStart(12,'0')}');`;
const creditRace=await Promise.allSettled([sql(ownerClaim+issueCredit(1,0)+'select pg_sleep(0.5);commit;'),sql(ownerClaim+issueCredit(2,0)+'select pg_sleep(0.5);commit;')]);
assert.equal(creditRace.filter(r=>r.status==='fulfilled').length,1);assert.match(creditRace.find(r=>r.status==='rejected').reason.message,/STALE_REVISION/);
await sql(ownerClaim+issueCredit(creditRace[0].status==='fulfilled'?1:2,0)+'commit;');
const winningCredit=(await sql(`select id from private.invoice_credits where invoice_id='${creditInvoice}' and reverses_id is null;`)).trim();
await sql(ownerClaim+`select public.invoice_credit_command('${creditOrg}','${creditInvoice}',1,'{"action":"reverse","credit":"${winningCredit}","reason":"Synthetic correction after race","reviewed":true}','95000000-0000-4000-8000-000000000003');commit;`);
const mixedRace=await Promise.allSettled([sql(ownerClaim+issueCredit(4,2)+'select pg_sleep(0.5);commit;'),sql(ownerClaim+`select public.record_payment('${creditOrg}','${creditInvoice}',4000,'cash','Synthetic receipt versus credit',now(),true,'native-credit-receipt-race');select pg_sleep(0.5);commit;`)]);
assert.equal(mixedRace.filter(r=>r.status==='fulfilled').length,1);assert.match(mixedRace.find(r=>r.status==='rejected').reason.message,/CREDIT_EXCEEDS_BALANCE|OVERPAYMENT/);
assert.equal((await sql(`select i.total_cents-coalesce((select sum(p.cents) from public.payments p where p.invoice_id=i.id),0)-private.invoice_credit_total(i.organization_id,i.id) from public.invoices i where i.id='${creditInvoice}';`)).trim(),'1000');
if(mixedRace[0].status==='fulfilled'){
 const id=(await sql(`select id from private.invoice_credits c where invoice_id='${creditInvoice}' and reverses_id is null and not exists(select 1 from private.invoice_credits r where r.reverses_id=c.id);`)).trim();
 await sql(ownerClaim+`select public.invoice_credit_command('${creditOrg}','${creditInvoice}',3,'{"action":"reverse","credit":"${id}","reason":"Synthetic race fixture restoration","reviewed":true}','95000000-0000-4000-8000-000000000005');commit;`);
}else{
 const id=(await sql(`select id from public.payments where invoice_id='${creditInvoice}' and method='cash' and cents=4000;`)).trim();
 await sql(ownerClaim+`select public.reverse_recorded_payment('${creditOrg}','${creditInvoice}','${id}','Synthetic race fixture restoration','native-credit-receipt-restoration');commit;`);
}
await sql(ownerClaim+`select public.record_payment('${creditOrg}','${creditInvoice}',5000,'cash','Synthetic settlement after race',now(),true,'native-credit-final-settlement');commit;`);
console.log('PASS: concurrent credits have one winner and replay; receipt versus credit cannot exceed the unpaid balance');
// Concurrent file association corrections must serialize on one file version.
const linkTarget=JSON.parse((await sql("select jsonb_build_object('file',f.id,'customer',f.customer_id,'job',(select id from public.jobs limit 1),'revision',(select max(revision) from private.customer_file_links where file_id=f.id)) from private.customer_supporting_files f where f.id='83000000-0000-4000-8000-000000000001';")).trim());
const linkFile=n=>`select public.link_customer_file('20000000-0000-4000-8000-000000000001','${linkTarget.customer}','${linkTarget.file}',${linkTarget.revision},'job','${linkTarget.job}','Synthetic concurrent file association review',true,'84000000-0000-4000-8000-${String(n).padStart(12,'0')}');`;
const linkRace=await Promise.allSettled([sql(ownerClaim+linkFile(1)+'select pg_sleep(0.5);commit;'),sql(ownerClaim+linkFile(2)+'select pg_sleep(0.5);commit;')]);assert.equal(linkRace.filter(r=>r.status==='fulfilled').length,1);assert.match(linkRace.find(r=>r.status==='rejected').reason.message,/STALE_REVISION/);
await sql(ownerClaim+linkFile(linkRace[0].status==='fulfilled'?1:2)+'commit;');assert.equal(Number((await sql(`select count(*) from private.customer_file_links where file_id='${linkTarget.file}';`)).trim()),5);
console.log('PASS: two file links race one version; one winner, one stale rejection and exact replay');
await verifyAccountDeletionRaces(sql);
// Pending metadata remains recoverable without pretending an upload completed.
await sql(`insert into private.customer_supporting_files(organization_id,id,customer_id,actor_id,request_key,purpose,original_name,mime,bytes,sha256,object_path,status)
 select organization_id,'85000000-0000-4000-8000-000000000001',customer_id,actor_id,'85000000-0000-4000-8000-000000000002',purpose,'synthetic-pending.png',mime,bytes,sha256,organization_id::text||'/85000000-0000-4000-8000-000000000001','pending'
 from private.customer_supporting_files where status='ready' limit 1;`);
const snapshotSql=`select jsonb_build_object('deletionRequests',(select jsonb_agg(to_jsonb(d) order by id) from private.account_deletions d),'retentionEvents',(select jsonb_agg(to_jsonb(e) order by id) from private.retention_events e),'invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.invoices i),'credits',(select jsonb_agg(to_jsonb(c) order by id) from private.invoice_credits c),'payments',(select jsonb_agg(to_jsonb(p) order by id) from public.payments p),'journal',(select jsonb_agg(to_jsonb(j) order by entry_id,account) from public.journal_lines j),'appointments',(select jsonb_agg(to_jsonb(a) order by id) from public.appointments a),'fileLinks',(select jsonb_agg(to_jsonb(f) order by file_id,revision) from private.customer_file_links f),'fileMetadata',(select jsonb_agg(to_jsonb(f) order by id) from private.customer_supporting_files f),'reservations',(select jsonb_agg(to_jsonb(r) order by appointment_id,resource_id) from public.resource_reservations r))::text;`;
const before=JSON.parse((await sql(snapshotSql)).trim());assert.equal(before.invoices.length,1);assert.ok(before.payments.length>=10);assert.ok(before.payments.filter(p=>p.reverses_payment_id).length>=4);assert.equal(before.payments.reduce((n,p)=>n+p.cents,0),12000);
const dump=await run(['pg_dump','-U','postgres','--format=custom','ynsg_test'],undefined,true);
const temp=await mkdtemp(join(tmpdir(),'ynsg-synthetic-restore-'));await writeFile(join(temp,'synthetic.dump'),dump,{mode:0o600});
// Exercise the encrypted transport with an actual synthetic pg_dump plus image bytes.
const keyPath=join(temp,'recovery.key'),filesRoot=join(temp,'files'),manifestPath=join(temp,'manifest.json'),output=join(temp,'backup.ynsg'),outputDirectory=join(temp,'isolated');
const bytes=Buffer.from([137,80,78,71,13,10,26,10,1,2,3,4]);
const files=before.fileMetadata.filter(f=>f.status==='ready').map(f=>({organization:f.organization_id,id:f.id,path:f.object_path,bytes:f.bytes,mime:f.mime,sha256:f.sha256}));
for(const f of files){assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,'Dump metadata must attest the actual bundled bytes');await mkdir(join(filesRoot,f.organization),{recursive:true});await writeFile(join(filesRoot,f.path),bytes,{mode:0o600});}
await writeFile(manifestPath,JSON.stringify({format:'ynsg-customer-file-backup-v1',files}),{mode:0o600});
await generateRecoveryKey(keyPath);const bundleArgs={keyPath,dumpPath:join(temp,'synthetic.dump'),manifestPath,filesRoot,output,outputDirectory,candidate:'a'.repeat(40)};
await packRecoveryBundle(bundleArgs);await unpackRecoveryBundle({...bundleArgs,bundlePath:output});
for(const f of files)assert.deepEqual(await readFile(join(outputDirectory,'verified/files',f.path)),bytes);
assert.equal((await verifyCustomerFileRestore(join(outputDirectory,'verified/manifest.json'),join(outputDirectory,'verified/files'))).verified,files.length);
const recoveredDump=await readFile(join(outputDirectory,'verified/database.dump'));assert.deepEqual(recoveredDump,dump);
await sql('create database ynsg_restore;');
await run(['pg_restore','-U','postgres','--exit-on-error','--dbname=ynsg_restore'],recoveredDump);
const after=JSON.parse((await sql(snapshotSql,'ynsg_restore')).trim());assert.deepEqual(after,before,'Restored money, appointment and capacity records must match');
const catalogQuery=await readFile('scripts/recovery-file-catalog.sql','utf8');
const restoredCatalog=JSON.parse((await sql(catalogQuery,'ynsg_restore')).trim());
const recoveredManifest=JSON.parse(await readFile(join(outputDirectory,'verified/manifest.json'),'utf8'));
const catalogPath=join(temp,'restored-catalog.json');await writeFile(catalogPath,JSON.stringify(restoredCatalog),{mode:0o600});
assert.equal((await verifyRecoveryCatalog({catalogPath,manifestPath:join(outputDirectory,'verified/manifest.json'),filesRoot:join(outputDirectory,'verified/files')})).verified,files.length);
assert.ok(restoredCatalog.pendingCount>0,'Pending fixture metadata must be explicitly accounted for');
assert.throws(()=>reconcileRecoveryCatalog(restoredCatalog,{...recoveredManifest,files:recoveredManifest.files.slice(1)}),'A valid but incomplete bundle must fail restored-catalog reconciliation');
const changed=structuredClone(recoveredManifest);changed.files[0].sha256='b'.repeat(64);
assert.throws(()=>reconcileRecoveryCatalog(restoredCatalog,changed),'Same counts cannot hide metadata divergence');
console.log('PASS: restored database catalog reconciles every ready object and pending count; missing or changed manifest entries fail');
assert.equal((await sql('select sum(debit_cents::bigint-credit_cents) from public.journal_lines;','ynsg_restore')).trim(),'0');
console.log('PASS: encrypted bundle recovered real synthetic pg_dump and exact image bytes; isolated pg_restore matches invoices, receipts, journal, appointments and reservations');

// The source catalog and custom dump must share the exported PostgreSQL snapshot.
// Mutate a synthetic row after snapshot export, before pg_dump starts.
await sql('create table qa_fixture.capture_marker(value integer);insert into qa_fixture.capture_marker values(1);');
const capturedOutput=join(temp,'captured.ynsg'),capturedDirectory=join(temp,'captured-restore');
const sourceDatabase=snapshotDatabase({psql:['docker','exec','-i',container,'psql','-U','postgres','-d','ynsg_test'],dump:['docker','exec','-i',container,'pg_dump','-U','postgres','--dbname=ynsg_test']});
const originalDump=sourceDatabase.dump;
sourceDatabase.dump=async(snapshot,path)=>{await sql('insert into qa_fixture.capture_marker values(2);');await originalDump(snapshot,path);};
const capture=await captureRecovery({keyPath,output:capturedOutput,candidate:'b'.repeat(40),source:{origin:'https://'+'a'.repeat(20)+'.supabase.co',token:'synthetic-only'},database:sourceDatabase,fetcher:async()=>new Response(bytes)});
assert.equal(capture.files,files.length);assert.ok(capture.pendingExcluded>0);
await unpackRecoveryBundle({keyPath,bundlePath:capturedOutput,outputDirectory:capturedDirectory});
await sql('create database ynsg_capture;');
await run(['pg_restore','-U','postgres','--exit-on-error','--dbname=ynsg_capture'],await readFile(join(capturedDirectory,'verified/database.dump')));
assert.equal((await sql('select count(*) from qa_fixture.capture_marker;')).trim(),'2');
assert.equal((await sql('select count(*) from qa_fixture.capture_marker;','ynsg_capture')).trim(),'1');
const capturedCatalog=JSON.parse((await sql(catalogQuery,'ynsg_capture')).trim());
const capturedManifest=JSON.parse(await readFile(join(capturedDirectory,'verified/manifest.json'),'utf8'));
assert.equal(reconcileRecoveryCatalog(capturedCatalog,capturedManifest).verified,files.length);
assert.deepEqual(JSON.parse((await sql(snapshotSql,'ynsg_capture')).trim()),before);
console.log('PASS: source capture exports one live read-only snapshot; concurrent later write excluded from dump, all original files and financial records restored');
await verifyTaskTimeRaces(sql);
await verifyOwnerNetworkRaces(sql);
