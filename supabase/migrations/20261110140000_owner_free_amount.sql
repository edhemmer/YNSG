-- Owner invoices: the owner may type any charge. The approved estimate stays on
-- record as the private "suggested" value; field/crew drafts keep the cap.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('private.save_invoice_labor(uuid,uuid,integer,jsonb,text)'::regprocedure);
 old:='if total>q.labor_cents then raise exception ''CHANGE_ORDER_REQUIRED'';end if;';
 if strpos(d,old)=0 then raise exception 'invoice cap baseline changed';end if;
 execute replace(d,old,'if total>q.labor_cents and not private.staff(p_org,array[''owner'',''admin'']) then raise exception ''CHANGE_ORDER_REQUIRED'';end if;');

 d:=pg_get_functiondef('private.complete_and_invoice(uuid,uuid,integer)'::regprocedure);
 old:='if charged>q.labor_cents or charged<0 then raise exception ''CHANGE_ORDER_REQUIRED'';end if;';
 if strpos(d,old)=0 then raise exception 'invoice completion cap baseline changed';end if;
 -- complete_and_invoice is already restricted to owner/admin staff.
 execute replace(d,old,'if charged<0 then raise exception ''CHANGE_ORDER_REQUIRED'';end if;');

 d:=pg_get_functiondef('private.validate_invoice_owner_pricing(jsonb,jsonb)'::regprocedure);
 old:='or (item->>''billedCents'')::bigint>(item->>''standardCents'')::bigint';
 if strpos(d,old)=0 then raise exception 'owner pricing baseline changed';end if;
 d:=replace(d,old,'');
 old:='if standard_total>billed_total and length(btrim(p_breakdown->>''reason''))<2 then raise exception ''OWNER_DISCOUNT_REASON_REQUIRED'';end if;';
 if strpos(d,old)=0 then raise exception 'owner pricing reason baseline changed';end if;
 execute replace(d,old,'');
end $migration$;

-- Owner working price: a private override of the approved amount. The customer's accepted quote is untouched;
-- the working price only pre-fills the invoice and the approved amount stays the "suggested" value.
create table if not exists private.job_working_price (
 organization_id uuid not null,
 job_id uuid not null,
 cents integer not null check(cents between 0 and 999999999),
 note text not null default '' check(length(note)<=500),
 updated_by uuid not null,
 updated_at timestamptz not null default now(),
 primary key(organization_id,job_id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id)
);
alter table private.job_working_price enable row level security;
revoke all on private.job_working_price from public,anon,authenticated,service_role;
drop policy if exists job_working_price_deny on private.job_working_price;
create policy job_working_price_deny on private.job_working_price to anon,authenticated using(false) with check(false);

create or replace function private.set_job_working_price(p_org uuid,p_job uuid,p_cents integer,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare j public.jobs;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_cents is null or p_cents not between 0 and 999999999 or p_note is null or length(p_note)>500 then raise exception 'VALIDATION';end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.invoices where organization_id=p_org and job_id=p_job) then raise exception 'TRANSITION';end if;
 insert into private.job_working_price(organization_id,job_id,cents,note,updated_by) values(p_org,p_job,p_cents,btrim(p_note),auth.uid())
 on conflict(organization_id,job_id) do update set cents=excluded.cents,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'job.working_price_set',p_job,j.revision,gen_random_uuid());
 return jsonb_build_object('cents',p_cents,'note',btrim(p_note));
end $body$;
revoke all on function private.set_job_working_price(uuid,uuid,integer,text) from public,anon,service_role;
grant execute on function private.set_job_working_price(uuid,uuid,integer,text) to authenticated;
create or replace function public.set_job_working_price(p_org uuid,p_job uuid,p_cents integer,p_note text)
returns jsonb language sql security invoker set search_path='' as $body$select private.set_job_working_price(p_org,p_job,p_cents,p_note)$body$;
revoke all on function public.set_job_working_price(uuid,uuid,integer,text) from public,anon,service_role;
grant execute on function public.set_job_working_price(uuid,uuid,integer,text) to authenticated;

create or replace function private.job_working_price(p_org uuid,p_job uuid)
returns jsonb language plpgsql security definer set search_path='' as $body$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return (select jsonb_build_object('cents',cents,'note',note) from private.job_working_price where organization_id=p_org and job_id=p_job);
end $body$;
revoke all on function private.job_working_price(uuid,uuid) from public,anon,service_role;
grant execute on function private.job_working_price(uuid,uuid) to authenticated;
create or replace function public.job_working_price(p_org uuid,p_job uuid)
returns jsonb language sql security invoker set search_path='' as $body$select private.job_working_price(p_org,p_job)$body$;
revoke all on function public.job_working_price(uuid,uuid) from public,anon,service_role;
grant execute on function public.job_working_price(uuid,uuid) to authenticated;
