import test from 'node:test';
import assert from 'node:assert/strict';
import {backgroundDeployment,verifiedSessionId} from '../apps/web/lib/background-setup.ts';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const org='a933d657-14d3-46b6-85e6-21d973e4ed97';
test('background setup refuses wrong company, missing credentials and unsafe origins',()=>{
 const env={GOOGLE_WORKER_ORGANIZATION_ID:org,GOOGLE_WORKER_SECRET:'w'.repeat(40),VERCEL_AUTOMATION_BYPASS_SECRET:'b'.repeat(40),APP_ORIGIN:'https://app.example.com'};
 assert.equal(backgroundDeployment(env,org).origin,env.APP_ORIGIN);
 for(const changed of [{GOOGLE_WORKER_ORGANIZATION_ID:'00000000-0000-4000-8000-000000000001'},{GOOGLE_WORKER_SECRET:''},{VERCEL_AUTOMATION_BYPASS_SECRET:'short'},{APP_ORIGIN:'https://app.example.com/@other'},{APP_ORIGIN:'http://app.example.com'},{GOOGLE_WORKER_SECRET:'w'.repeat(35)+'\n'}])assert.throws(()=>backgroundDeployment({...env,...changed},org));
 const token='header.'+Buffer.from(JSON.stringify({session_id:org})).toString('base64url')+'.signature';
 assert.equal(verifiedSessionId(token),org);assert.throws(()=>verifiedSessionId('bad'));
});
test('Vault preparation requires a live owner in the deployment company, never activates jobs and returns no keys',async()=>{
 const db=await PGlite.create(),actor='00000000-0000-4000-8000-000000000001',session='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema auth;create schema vault;create schema cron;
   create table public.organizations(id uuid primary key);create table public.memberships(organization_id uuid,user_id uuid,role text,revoked_at timestamptz);
   create table auth.users(id uuid primary key,deleted_at timestamptz,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
   create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('role',current_setting('test.role',true))$$;
   create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,value text);
   create function vault.create_secret(value text,name text,description text) returns uuid language sql as $$insert into vault.secrets(name,value) values(name,value) returning id$$;
   create function vault.update_secret(secret_id uuid,value text,name text,description text) returns void language sql as $$update vault.secrets set name=update_secret.name,value=update_secret.value where id=secret_id$$;
   create table cron.job(jobid bigint primary key,jobname text,active boolean);
   create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=alter_job.active where jobid=job_id$$;
   insert into cron.job values(1,'ynsg-mail-worker',true),(2,'ynsg-calendar-worker',true),(3,'unrelated',true);`);
  await db.query('insert into public.organizations values($1)',[org]);
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now());',[actor]);
  await db.query('insert into auth.sessions values($1,$2,null)',[session,actor]);
  await db.query("insert into public.memberships values($1,$2,'owner',null)",[org,actor]);
  await db.exec(await readFile('scripts/setup-background-vault.sql','utf8'));
  const prepare=()=>db.query<{result:{credentialsStored:boolean;jobs:{active:boolean}[]}}>('select public.background_setup($1,$2,$3,$4,$5,$6,$7) as result',[org,actor,session,'prepare','w'.repeat(40),'b'.repeat(40),'https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app']);
  await db.exec("set test.role='authenticated'");await assert.rejects(prepare());
  await db.exec("set test.role='service_role'");
  await db.exec("update public.memberships set role='admin'");await assert.rejects(prepare());
  await db.exec("update public.memberships set role='owner';update auth.sessions set not_after=now()-interval '1 minute'");await assert.rejects(prepare());
  await db.exec('update auth.sessions set not_after=null');
  await assert.rejects(db.query("select public.background_setup($1,$2,$3,'prepare',$4,$5,$6)",[org,actor,session,'w'.repeat(40),'b'.repeat(40),'https://attacker.invalid']));
  const result=(await prepare()).rows[0]!.result;assert.equal(result.credentialsStored,true);assert.ok(result.jobs.every(x=>!x.active));assert.ok(!JSON.stringify(result).includes('w'.repeat(40)));
  await prepare();assert.equal((await db.query<{count:number}>('select count(*)::int as count from vault.secrets')).rows[0]!.count,3);
  assert.equal((await db.query<{active:boolean}>("select active from cron.job where jobname='unrelated'")).rows[0]!.active,true);
  const access=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.background_setup(uuid,uuid,uuid,text,text,text,text)','execute') as allowed");assert.equal(access.rows[0]!.allowed,false);
  await db.exec('update public.memberships set revoked_at=now()');await assert.rejects(prepare());
 }finally{await db.close();}
});
