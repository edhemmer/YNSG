-- Read-only email history for one customer record: service emails (request receipts, appointment
-- notices, invoices) and marketing series emails. Owners and admins only. Service emails are tied to
-- the customer through their own requests, quotes, jobs, appointments, invoices and recurring series;
-- marketing emails through the customer's saved contact emails. A shared email never invents a link
-- for service mail. Nothing here changes a delivery or reveals message bodies.
create index if not exists outbox_object on public.outbox(organization_id,object_id);
create function private.owner_customer_email_history(p_org uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_customer is null or not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND';end if;
 with requests as materialized (
  select id from public.service_requests where organization_id=p_org and customer_id=p_customer
 ), jobs as materialized (
  select id from public.jobs where organization_id=p_org and customer_id=p_customer
 ), objects as materialized (
  select id from requests
  union select id from public.quotes where organization_id=p_org and customer_id=p_customer
  union select id from jobs
  union select a.id from public.appointments a join jobs j on j.id=a.job_id where a.organization_id=p_org
  union select id from public.invoices where organization_id=p_org and customer_id=p_customer
  union select s.id from private.recurring_series s join requests r on r.id=s.request_id where s.organization_id=p_org
 ), service as (
  select o.id,o.kind,o.status,o.created_at,o.next_attempt_at,
   (select max(d.finished_at) from public.delivery_attempts d where d.organization_id=p_org and d.outbox_id=o.id and d.status='accepted') sent_at
  from public.outbox o join objects x on x.id=o.object_id
  where o.organization_id=p_org and o.kind in ('request.customer_receipt','request.declined','quote.published',
   'appointment.confirmation','appointment.reminder','appointment.canceled','appointment.declined_service','appointment.declined_time',
   'appointment.reschedule_requested','appointment.delay_notice','invoice.delivery','invoice.issued','invoice.paid',
   'recurring.confirmation','recurring.stopped')
 ), emails as materialized (
  select distinct lower(email) email from public.contacts where organization_id=p_org and customer_id=p_customer and email is not null
 ), marketing as (
  select s.id,s.journey,s.status,s.scheduled_for,s.sent_at,s.clicked_at
  from public.marketing_sends s join public.marketing_contacts c on c.id=s.contact_id and c.organization_id=p_org
  join emails e on e.email=c.email where s.organization_id=p_org and s.status<>'skipped'
 ), items as (
  select 'service' channel,kind,case when status='accepted' then 'sent' when status in('suppressed') then 'not_sent'
   when status in('dead_letter','needs_reconciliation') then 'not_delivered' else 'queued' end state,
   coalesce(sent_at,case when status in('pending','leased','sending','failed') then greatest(created_at,next_attempt_at) else created_at end) at,null::timestamptz clicked_at
  from service
  union all
  select 'marketing',journey,case status when 'sent' then 'sent' when 'failed' then 'not_delivered' else 'queued' end,
   coalesce(sent_at,scheduled_for),clicked_at from marketing
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('channel',channel,'kind',kind,'state',state,'at',at,'clickedAt',clicked_at) order by at desc)
   from (select * from items order by at desc limit 100) i),'[]'::jsonb),
  'total',(select count(*) from items),
  'checkedAt',now()) into result;
 return result;
end$$;
create function public.owner_customer_email_history(p_org uuid,p_customer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.owner_customer_email_history(p_org,p_customer)$$;
revoke all on function private.owner_customer_email_history(uuid,uuid),public.owner_customer_email_history(uuid,uuid) from public,anon,service_role;
grant execute on function private.owner_customer_email_history(uuid,uuid),public.owner_customer_email_history(uuid,uuid) to authenticated;
