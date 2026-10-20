-- Keep a quoted, unconfirmed lead declineable without discarding its quote evidence.
-- Existing role/session, request revision, schedule-state lock, receipt and outbox guards stay intact.
do $migration$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('private.review_service_request(uuid,uuid,integer,text,text)'::regprocedure);
 needle:=' if r.status not in (''submitted'',''reviewing'') then raise exception ''TRANSITION''; end if;';
 if strpos(definition,needle)=0 then raise exception 'review transition baseline changed';end if;
 definition:=replace(definition,needle,$replacement$
 if r.status not in ('submitted','reviewing') and not (r.status='quoted' and p_status='declined') then raise exception 'TRANSITION';end if;
 if r.status='quoted' and p_status='declined' then
  -- Serialize against customer/staff agreement on the same quotes. An agreed job
  -- needs its cancellation workflow, not a lead decline.
  perform 1 from public.quotes where organization_id=p_org and request_id=p_id order by id for update;
  if exists(select 1 from public.quotes q where q.organization_id=p_org and q.request_id=p_id and q.status='accepted')
   or exists(select 1 from public.jobs j join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id where q.organization_id=p_org and q.request_id=p_id and j.status<>'canceled') then raise exception 'TRANSITION';end if;
 end if;
$replacement$);
 needle:=' update public.service_requests set status=p_status,revision=revision+1 where organization_id=p_org and id=p_id;';
 if strpos(definition,needle)=0 then raise exception 'review write baseline changed';end if;
 -- Expire pending agreement offers atomically so they cannot be approved after decline.
 definition:=replace(definition,needle,needle||$replacement$
 if r.status='quoted' and p_status='declined' then
  update public.quotes set status='declined',revision=revision+1 where organization_id=p_org and request_id=p_id and status='sent';
 end if;
$replacement$);
 execute definition;
end $migration$;
