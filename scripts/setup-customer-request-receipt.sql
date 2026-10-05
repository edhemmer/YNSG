begin;
create function private.customer_receipt_current(p_org uuid,p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.outbox o join public.service_requests r on r.organization_id=o.organization_id and r.id=o.object_id where o.organization_id=p_org and o.id=p_id and o.kind='request.customer_receipt' and r.status not in('declined','canceled') and r.original_submission->>'email'=o.payload->>'recipient' and not exists(select 1 from public.appointments a where a.organization_id=r.organization_id and a.request_id=r.id and a.status='reserved'));
$$;
revoke all on function private.customer_receipt_current(uuid,uuid) from public,anon,authenticated;
grant execute on function private.customer_receipt_current(uuid,uuid) to service_role;
create function private.queue_customer_request_receipt() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(new.original_submission->>'email','')<>'' then
  insert into public.outbox(organization_id,event_key,kind,object_id,payload) values(new.organization_id,'request:'||new.id||':customer-receipt','request.customer_receipt',new.id,jsonb_build_object('schemaVersion',1,'recipient',new.original_submission->>'email')) on conflict(organization_id,event_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.queue_customer_request_receipt() from public,anon,authenticated;
create trigger queue_customer_request_receipt after insert on public.service_requests for each row execute function private.queue_customer_request_receipt();
do $$ declare def text; name text;begin
 foreach name in array array['private.claim_mail_company()','private.claim_outbox(uuid,integer)'] loop
  def:=pg_get_functiondef(name::regprocedure);
  if length(def)-length(replace(def,'''request.owner_notification''',''))<>length('''request.owner_notification''') then raise exception 'MAIL_KIND_LIST_CHANGED';end if;
  def:=replace(def,'''request.owner_notification''','''request.owner_notification'',''request.customer_receipt''');
  if name like 'private.claim_outbox%' then
   if position('((o.kind like ''appointment.%''' in def)=0 then raise exception 'MAIL_SUPPRESSION_CHANGED';end if;
   def:=replace(def,'((o.kind like ''appointment.%''','((o.kind=''request.customer_receipt'' and not private.customer_receipt_current(p_org,o.id)) or (o.kind like ''appointment.%''');
  end if;
  execute def;
 end loop;
 def:=pg_get_functiondef('private.begin_delivery(uuid,uuid,uuid)'::regprocedure);
 if position('((o.kind like ''appointment.%''' in def)=0 then raise exception 'MAIL_SUPPRESSION_CHANGED';end if;
 def:=replace(def,'((o.kind like ''appointment.%''','((o.kind=''request.customer_receipt'' and not private.customer_receipt_current(p_org,p_id)) or (o.kind like ''appointment.%''');execute def;
end $$;
commit;
