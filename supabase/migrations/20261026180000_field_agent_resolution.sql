-- Record why a prepared administrative decision left the active queue.
alter table public.field_agent_tasks
 add column if not exists resolved_at timestamptz,
 add column if not exists resolution text check (resolution in ('completed','superseded','closed'));
