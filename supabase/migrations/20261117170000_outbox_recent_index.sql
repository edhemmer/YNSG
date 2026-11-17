-- The workspace reads the newest outbox rows for one company. Without this index Postgres scanned
-- every outbox row and ran the per-row owner check on each one; at about 4,200 rows that took
-- over 5 seconds and pushed the workspace load past the 8 second statement timeout
-- (observed November 17, 2026). With the index only the newest page of rows is checked.
create index if not exists outbox_org_created_idx on public.outbox(organization_id, created_at desc, id);
