import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('background scheduler stays paused, isolates credentials and rejects arbitrary destinations',async()=>{
 const db=await PGlite.create();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema private;create schema vault;create schema cron;create schema net;
 create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
 create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean default true);
 create function cron.schedule(job_name text,schedule text,command text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(job_name,schedule,command) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid$$;
 create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=alter_job.active where jobid=job_id$$;
 create table net.calls(id bigint generated always as identity,url text,body jsonb,params jsonb,headers jsonb,timeout integer);
 create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000) returns bigint language sql as $$insert into net.calls(url,body,params,headers,timeout) values(url,body,params,headers,timeout_milliseconds) returning id$$;`);
 const sql=await readFile('scripts/setup-background-cron.sql','utf8');await db.exec(sql);await db.exec(sql);
 const jobs=await db.query<{active:boolean;command:string}>('select active,command from cron.job');assert.equal(jobs.rows.length,2);assert.ok(jobs.rows.every(j=>!j.active&&!j.command.includes('Bearer')));
 await assert.rejects(db.query("select private.enqueue_background_worker('mail')"));
 await db.query('insert into vault.decrypted_secrets values ($1,$2),($3,$4),($5,$6)',['ynsg_crm_worker_secret','w'.repeat(40),'ynsg_crm_protection_bypass','b'.repeat(40),'ynsg_crm_worker_origin','https://attacker.invalid']);
 await assert.rejects(db.query("select private.enqueue_background_worker('mail')"));
 await assert.rejects(db.query("select private.enqueue_background_worker('anything')"));
 await db.query('update vault.decrypted_secrets set decrypted_secret=$1 where name=$2',['https://ynsg-repo-git-codex-crm-workflow-edhemmer-5018s-projects.vercel.app','ynsg_crm_worker_origin']);
 await db.query("select private.enqueue_background_worker('mail')");await db.query("select private.enqueue_background_worker('calendar')");
 const calls=await db.query<{url:string;headers:Record<string,string>;timeout:number}>('select url,headers,timeout from net.calls');assert.equal(calls.rows.length,2);assert.ok(calls.rows[0]!.url.endsWith('/api/notifications/worker'));assert.ok(calls.rows[1]!.url.endsWith('/api/google/worker'));assert.equal(calls.rows[0]!.timeout,55000);assert.equal(calls.rows[0]!.headers.Authorization,'Bearer '+'w'.repeat(40));
 const permission=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','private.enqueue_background_worker(text)','execute') as allowed");assert.equal(permission.rows[0]!.allowed,false);
 const logs=await db.query<{kind:string}>('select kind from private.background_http_runs');assert.deepEqual(logs.rows.map(x=>x.kind),['mail','calendar']);
 }finally{await db.close();}
});
