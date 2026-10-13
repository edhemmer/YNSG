-- A larger accepted scope does not silently extend the customer's calendar slot.
-- Preserve retries and legacy finance-only companies; scheduling-enabled companies
-- need a confirmed work window covering the approved version before starting.
do $$declare d text;old text;begin
 d:=pg_get_functiondef('private.job_action(uuid,uuid,integer,text,text,text)'::regprocedure);
 old:=' select * into j from public.jobs where organization_id=p_org and id=p_id for update;';
 if strpos(d,old)=0 then raise exception 'job lock baseline changed';end if;
 d:=replace(d,old,' if p_action=''start'' then perform 1 from private.schedule_state where organization_id=p_org for update;end if;'||chr(10)||old);
 old:=' if p_action=''pause'' then';
 if strpos(d,old)=0 then raise exception 'work start baseline changed';end if;
 d:=replace(d,old,' if p_action=''start'' and exists(select 1 from public.entitlements where organization_id=p_org and module=''scheduling'' and enabled) then
  if not exists(select 1 from public.appointments a join public.quote_versions v on v.organization_id=a.organization_id and v.quote_id=j.quote_id and v.version=j.approved_version
   where a.organization_id=p_org and a.job_id=j.id and a.status=''reserved'' and extract(epoch from(a.end_at-a.arrival_at))/60>=v.duration_minutes for update of a) then raise exception ''WORK_WINDOW_TOO_SHORT'';end if;
 end if;
'||old);execute d;
end$$;
