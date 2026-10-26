-- Durable owner-review task queue; proposals only, never execution authority.
create table if not exists public.field_agent_tasks (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 request_id uuid not null,
 request_revision integer not null check (request_revision >= 0),
 task_kind text not null check (task_kind in ('review','schedule','quote','work','invoice','payment','follow_up')),
 title text not null,
 detail text not null,
 status text not null default 'proposed' check (status in ('proposed','superseded','dismissed')),
 source text not null default 'saved_workflow',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,request_id,request_revision,task_kind),
 foreign key (organization_id,request_id) references public.service_requests(organization_id,id) on delete cascade
);
create index if not exists field_agent_tasks_current on public.field_agent_tasks (organization_id,request_id,status);
alter table public.field_agent_tasks enable row level security;
revoke all on public.field_agent_tasks from anon, authenticated;
grant select,insert,update on public.field_agent_tasks to service_role;
-- All reads and writes use a server-side service role only after owner authorization.
