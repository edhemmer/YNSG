import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Only the disposable PostgreSQL CI adapter is passed in. Never accepts a production URL.
export async function verifyTaskTimeRaces(sql){
 const transform=s=>s.replace(/(?:00000000|10000000|20000000|30000000|41000000|42000000|43000000)-/g,'97000000-').replaceAll("'test-one'","'synthetic-task-races-one'").replaceAll("'test-two'","'synthetic-task-races-two'");
 const foundation=(await readFile('tests/foundation.sql','utf8')).split('set local role service_role;')[0];
 const setup=(await readFile('tests/task-time.sql','utf8')).split('set local role authenticated;')[0];
 await sql(transform(foundation+setup)+'commit;');
 const org='97000000-0000-4000-8000-000000000001',job=org;
 const claim=`begin;set local role authenticated;select set_config('request.jwt.claims','${JSON.stringify({role:'authenticated',sub:org,session_id:org,aal:'aal1'})}',true);`;
 const command=(action,extra,key)=>`select public.task_time_command('${org}','${JSON.stringify({organization:org,job,jobRevision:1,action,key,...extra})}');`;
 await sql(claim+command('plan',{service:'Home',name:'Smart lock',plannedMinutes:120},'race-task-plan-lock-001')+command('plan',{service:'Washing',name:'Concrete patio',plannedMinutes:150},'race-task-plan-wash-001')+'commit;');
 const rows=JSON.parse((await sql(`select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from private.job_task_plans where organization_id='${org}';`)).trim());
 const start=(t,key)=>claim+command('start',{task:t.id,revision:1},key)+'select pg_sleep(0.2);commit;';
 await Promise.all([sql(start(rows[0],'race-task-start-first-001')),sql(start(rows[1],'race-task-start-second-001'))]);
 assert.equal(Number((await sql(`select count(*) from private.job_task_sessions where organization_id='${org}' and ended_at is null;`)).trim()),1);
 const receipt=await Promise.all([sql(start(rows[0],'race-task-start-first-001')),sql(start(rows[0],'race-task-start-first-001'))]);assert.equal(receipt[0],receipt[1]);
 assert.equal(Number((await sql(`select count(*) from private.job_task_sessions where organization_id='${org}';`)).trim()),2);
 await sql(`update public.jobs set status='paused',revision=2 where organization_id='${org}';`);
 assert.equal(Number((await sql(`select count(*) from private.job_task_sessions where organization_id='${org}' and ended_at is null;`)).trim()),0);
 const sessions=JSON.parse((await sql(`select jsonb_agg(jsonb_build_object('id',id,'task',task_id) order by id) from private.job_task_sessions where organization_id='${org}';`)).trim());
 for(let i=0;i<sessions.length;i++)await sql(`update private.job_task_sessions set started_at='2026-01-01 ${i===0?'08':'10'}:00:00+00',ended_at='2026-01-01 ${i===0?'09':'11'}:00:00+00' where organization_id='${org}' and id='${sessions[i].id}';`);
 const review=(s,key)=>claim+command('review',{task:s.task,revision:2,session:s.id,startedAt:'2026-01-01T12:00:00Z',endedAt:'2026-01-01T13:00:00Z',reason:'Synthetic concurrent correction review'},key).replace('"jobRevision":1','"jobRevision":2')+'select pg_sleep(0.2);commit;';
 const results=await Promise.allSettled(sessions.map((s,i)=>sql(review(s,'race-task-review-'+i+'-001'))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/TIME_OVERLAP/);
 console.log('PASS: concurrent task switches leave one timer; exact replays add no intervals; visit pause closes tasks; overlapping corrections serialize');
}
