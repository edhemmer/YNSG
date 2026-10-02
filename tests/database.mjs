import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import {readFile,readdir} from 'node:fs/promises';
const db=await PGlite.create({extensions:{btree_gist}});
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),aal text,not_after timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
 create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
 grant usage on schema auth to authenticated,anon,service_role;
 grant execute on all functions in schema auth to authenticated,anon,service_role;`);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'));
 const foundation=await readFile('tests/foundation.sql','utf8');
 await db.exec(foundation);
 await db.exec(foundation.split('set local role service_role;')[0]+await readFile('tests/commercial.sql','utf8'));
 await db.exec(foundation.split('set local role service_role;')[0]+await readFile('tests/scheduler.sql','utf8'));
 await db.exec(foundation.split('set local role service_role;')[0]+await readFile('tests/google.sql','utf8'));
 await db.exec(foundation.split('set local role service_role;')[0]+await readFile('tests/owner-setup.sql','utf8'));
 await db.exec(foundation.split('set local role service_role;')[0]+await readFile('tests/operations.sql','utf8'));
 await db.exec(foundation.split('set local role service_role;')[0]+await readFile('tests/availability.sql','utf8'));
 console.log('PASS: empty-schema migrations plus foundation, commercial, and scheduler PostgreSQL integration assertions (PGlite). Live auth, provider delivery, and multi-connection races require separate evidence.');
}finally{await db.close();}
