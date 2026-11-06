-- Owner-controlled permanent delete for requests and customers that never produced money.
-- A request can be erased only when none of its jobs has an invoice (so no payment either), no mileage is
-- tied to it, no timer is running and it is not part of a recurring series. A customer can be erased only
-- when no request, quote, job or invoice remains under it and it has no uploaded files.
-- Invoices, payments, credits, journal entries and the audit log are never touched by this migration.

-- The tamper-proof trigger stays on every table. It now lets ONE kind of delete through: a delete made by
-- the erase functions below (transaction-local flag, never an app role) on the four agreement/history
-- tables that hang off a request or customer. Updates, and deletes on every other table, still fail.
create or replace function private.immutable_record() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE'
  and tg_table_name in ('approvals','quote_versions','customer_file_links','customer_record_changes')
  and coalesce(current_setting('ynsg.record_erase',true),'')='on'
  and current_user not in ('authenticated','anon','service_role')
 then return old;end if;
 raise exception 'IMMUTABLE_RECORD';
end $$;

create function private.erase_service_request(p_org uuid,p_id uuid,p_revision integer,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.command_receipts;fingerprint text;result jsonb;r public.service_requests;
 q_ids uuid[];j_ids uuid[];a_ids uuid[];l_ids uuid[];events integer;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_id is null or p_revision is null or p_revision<1 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,p_revision,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':erase:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='EraseRequest' and key=p_key;
 if found then
  if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return previous.result;
 end if;
 select * into r from public.service_requests where organization_id=p_org and id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if r.status not in ('submitted','reviewing','declined','canceled','quoted') then raise exception 'VALIDATION';end if;
 if to_jsonb(r)->>'recurring_series_id' is not null or exists(select 1 from private.recurring_series where organization_id=p_org and request_id=p_id) then raise exception 'ERASE_RECURRING';end if;

 q_ids:=array(select id from public.quotes where organization_id=p_org and request_id=p_id);
 j_ids:=array(
  select id from public.jobs where organization_id=p_org and quote_id=any(q_ids)
  union select job_id from public.owner_work_records where organization_id=p_org and request_id=p_id and job_id is not null
  union select job_id from public.appointments where organization_id=p_org and request_id=p_id and job_id is not null);
 a_ids:=array(select id from public.appointments where organization_id=p_org and (request_id=p_id or job_id=any(j_ids)));
 l_ids:=array(select id from private.customer_request_links where organization_id=p_org and (request_id=p_id or appointment_id=any(a_ids)));

 if exists(select 1 from public.invoices where organization_id=p_org and job_id=any(j_ids)) then raise exception 'ERASE_HAS_BILLING';end if;
 if exists(select 1 from private.mileage_trips where organization_id=p_org and job_id=any(j_ids)) then raise exception 'ERASE_HAS_MILEAGE';end if;
 if exists(select 1 from public.work_sessions where organization_id=p_org and job_id=any(j_ids) and ended_at is null) then raise exception 'ERASE_WORK_ACTIVE';end if;
 if exists(select 1 from public.outbox where organization_id=p_org and status in ('leased','sending')
   and object_id=any(array[p_id]||q_ids||j_ids||a_ids)) then raise exception 'ERASE_MESSAGE_BUSY';end if;

 select count(*) into events from private.google_projections where organization_id=p_org and appointment_id=any(a_ids) and event_id is not null;

 perform set_config('ynsg.record_erase','on',true);
 delete from private.customer_action_receipts where organization_id=p_org and link_id=any(l_ids);
 delete from private.customer_action_throttles where organization_id=p_org and link_id=any(l_ids);
 delete from private.customer_request_links where organization_id=p_org and id=any(l_ids);
 delete from private.google_projections where organization_id=p_org and appointment_id=any(a_ids);
 delete from private.recurring_occurrences where organization_id=p_org and (request_id=p_id or appointment_id=any(a_ids) or job_id=any(j_ids));
 delete from private.website_slot_holds where organization_id=p_org and appointment_id=any(a_ids);
 delete from public.appointment_tasks where organization_id=p_org and appointment_id=any(a_ids);
 delete from public.customer_schedule_preferences where organization_id=p_org and (request_id=p_id or appointment_id=any(a_ids));
 delete from public.resource_reservations where organization_id=p_org and appointment_id=any(a_ids);
 delete from public.route_segments where organization_id=p_org and appointment_id=any(a_ids);
 delete from public.schedule_holds where organization_id=p_org and appointment_id=any(a_ids);
 delete from public.appointments where organization_id=p_org and id=any(a_ids);

 delete from private.customer_file_links where organization_id=p_org and job_id=any(j_ids);
 delete from private.field_job_notes where organization_id=p_org and job_id=any(j_ids);
 delete from private.invoice_labor_drafts where organization_id=p_org and job_id=any(j_ids);
 delete from private.invoice_tax_assessments where organization_id=p_org and job_id=any(j_ids);
 delete from private.job_task_reviews where organization_id=p_org and task_id in (select id from private.job_task_plans where organization_id=p_org and job_id=any(j_ids));
 delete from private.job_task_sessions where organization_id=p_org and task_id in (select id from private.job_task_plans where organization_id=p_org and job_id=any(j_ids));
 delete from private.job_task_plans where organization_id=p_org and job_id=any(j_ids);
 delete from private.owner_work_records where organization_id=p_org and (request_id=p_id or job_id=any(j_ids));
 delete from public.work_sessions where organization_id=p_org and job_id=any(j_ids);
 delete from public.jobs where organization_id=p_org and id=any(j_ids);

 delete from public.approvals where organization_id=p_org and quote_id=any(q_ids);
 delete from public.quote_versions where organization_id=p_org and quote_id=any(q_ids);
 delete from public.quotes where organization_id=p_org and id=any(q_ids);

 delete from private.lead_assignment_history where organization_id=p_org and request_id=p_id;
 delete from private.lead_assignments where organization_id=p_org and request_id=p_id;
 delete from private.relationship_notes where organization_id=p_org and request_id=p_id;
 delete from private.scheduling_reviews where organization_id=p_org and request_id=p_id;
 delete from private.schedule_evidence where organization_id=p_org and request_id=p_id;
 delete from public.outbox where organization_id=p_org and object_id=any(array[p_id]||q_ids||j_ids||a_ids);
 delete from public.service_requests where organization_id=p_org and id=p_id;
 perform set_config('ynsg.record_erase','off',true);

 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,auth.uid(),'request.erased',p_id,p_revision,gen_random_uuid());
 result:=jsonb_build_object('id',p_id,'erased',true,'calendarEvents',events);
 insert into private.command_receipts values(p_org,'EraseRequest',p_key,fingerprint,result,now());
 return result;
end $$;

create function private.erase_customer(p_org uuid,p_id uuid,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.command_receipts;fingerprint text;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_id is null or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_id,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':erase:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='EraseCustomer' and key=p_key;
 if found then
  if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return previous.result;
 end if;
 perform 1 from public.customers where organization_id=p_org and id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.service_requests where organization_id=p_org and customer_id=p_id)
  or exists(select 1 from public.quotes where organization_id=p_org and customer_id=p_id)
  or exists(select 1 from public.jobs where organization_id=p_org and customer_id=p_id)
  or exists(select 1 from public.invoices where organization_id=p_org and customer_id=p_id)
 then raise exception 'ERASE_HAS_RECORDS';end if;
 if exists(select 1 from private.customer_supporting_files where organization_id=p_org and customer_id=p_id) then raise exception 'ERASE_HAS_FILES';end if;

 perform set_config('ynsg.record_erase','on',true);
 delete from private.customer_account_invitations where organization_id=p_org and customer_id=p_id;
 delete from private.customer_record_changes where organization_id=p_org and customer_id=p_id;
 delete from private.relationship_notes where organization_id=p_org and customer_id=p_id;
 delete from public.contacts where organization_id=p_org and customer_id=p_id;
 delete from public.customer_access where organization_id=p_org and customer_id=p_id;
 delete from public.properties where organization_id=p_org and customer_id=p_id;
 delete from public.customers where organization_id=p_org and id=p_id;
 perform set_config('ynsg.record_erase','off',true);

 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
  values(p_org,auth.uid(),'customer.erased',p_id,1,gen_random_uuid());
 result:=jsonb_build_object('id',p_id,'erased',true);
 insert into private.command_receipts values(p_org,'EraseCustomer',p_key,fingerprint,result,now());
 return result;
end $$;

create function public.erase_service_request(p_org uuid,p_id uuid,p_revision integer,p_key text) returns jsonb
language sql set search_path='' as $$select private.erase_service_request(p_org,p_id,p_revision,p_key)$$;
create function public.erase_customer(p_org uuid,p_id uuid,p_key text) returns jsonb
language sql set search_path='' as $$select private.erase_customer(p_org,p_id,p_key)$$;

revoke all on function private.erase_service_request(uuid,uuid,integer,text),public.erase_service_request(uuid,uuid,integer,text),
 private.erase_customer(uuid,uuid,text),public.erase_customer(uuid,uuid,text) from public,anon,service_role;
grant execute on function private.erase_service_request(uuid,uuid,integer,text),public.erase_service_request(uuid,uuid,integer,text),
 private.erase_customer(uuid,uuid,text),public.erase_customer(uuid,uuid,text) to authenticated;
