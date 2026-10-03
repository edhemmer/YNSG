-- Completion is a field record, independent of invoice issuance or customer delivery.
create function private.complete_service_call(p_org uuid,p_job uuid,p_revision integer,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.jobs; prior private.command_receipts; fingerprint text; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_revision is null or p_revision<1 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_job,p_revision)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':completion:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='CompleteServiceCall' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if j.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if j.status not in('working','paused') then raise exception 'TRANSITION';end if;
 if not exists(select 1 from public.approvals where organization_id=p_org and quote_id=j.quote_id and version=j.approved_version) then raise exception 'APPROVAL_REQUIRED';end if;
 update public.jobs set status='completed',revision=revision+1 where organization_id=p_org and id=p_job returning * into j;
 -- Preserve already recorded work at the new job revision, without creating charges.
 update private.invoice_labor_drafts set job_revision=j.revision where organization_id=p_org and job_id=p_job;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'job.completed',p_job,j.revision,gen_random_uuid());
 result:=jsonb_build_object('id',j.id,'status',j.status,'revision',j.revision);
 insert into private.command_receipts values(p_org,'CompleteServiceCall',p_key,fingerprint,result,now());
 return result;
end$$;
create function public.complete_service_call(p_org uuid,p_job uuid,p_revision integer,p_key text) returns jsonb
language sql security invoker set search_path='' as $$ select private.complete_service_call(p_org,p_job,p_revision,p_key) $$;

-- Existing issued snapshots and journals are unchanged. Close the former combined RPC.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('private.save_invoice_labor(uuid,uuid,integer,jsonb,text)'::regprocedure);
 old:='j.status not in (''working'',''paused'')';
 if strpos(d,old)=0 then raise exception 'draft status baseline changed';end if;
 execute replace(d,old,'j.status not in (''working'',''paused'',''completed'')');
 d:=pg_get_functiondef('private.complete_and_invoice(uuid,uuid,integer)'::regprocedure);
 old:='if j.status not in (''working'',''paused'') then raise exception ''TRANSITION'';end if;';
 if strpos(d,old)=0 then raise exception 'invoice status baseline changed';end if;
 d:=replace(d,old,'if j.status<>''completed'' then raise exception ''TRANSITION'';end if;');
 old:='select lines into work_lines from private.invoice_labor_drafts where organization_id=p_org and job_id=p_job;';
 if strpos(d,old)=0 then raise exception 'draft approval baseline changed';end if;
 d:=replace(d,old,'select lines into work_lines from private.invoice_labor_drafts where organization_id=p_org and job_id=p_job and job_revision=p_revision;
 if work_lines is null then raise exception ''INVOICE_DRAFT_REQUIRED'';end if;');
 -- Completion was already recorded. Issuance must not change the job again.
 old:='update public.jobs set status=''completed'',revision=revision+1 where organization_id=p_org and id=p_job;';
 if strpos(d,old)=0 then raise exception 'invoice job update baseline changed';end if;
 execute replace(d,old,'');
end $migration$;
revoke all on function public.complete_and_invoice(uuid,uuid,integer),private.complete_and_invoice(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function private.approve_invoice(p_org uuid,p_job uuid,p_revision integer,p_total integer,p_reviewed boolean,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.jobs; draft private.invoice_labor_drafts; prior private.command_receipts; fingerprint text; result jsonb; total bigint;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_reviewed is distinct from true then raise exception 'INVOICE_REVIEW_REQUIRED';end if;
 if p_key is null or length(p_key) not between 16 and 128 or p_total is null or p_total<0 or p_revision is null or p_revision<1 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_job,p_revision,p_total,p_reviewed)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':approve-invoice:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='ApproveInvoice' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into j from public.jobs where organization_id=p_org and id=p_job for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if j.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 if j.status<>'completed' then raise exception 'TRANSITION';end if;
 if exists(select 1 from public.invoices where organization_id=p_org and job_id=p_job) then raise exception 'INVOICE_ALREADY_ISSUED';end if;
 select * into draft from private.invoice_labor_drafts where organization_id=p_org and job_id=p_job;
 if not found or draft.job_revision is distinct from j.revision then raise exception 'INVOICE_DRAFT_REQUIRED';end if;
 select sum((value->>'chargedCents')::bigint) into total from jsonb_array_elements(draft.lines);
 if total is distinct from p_total::bigint then raise exception 'INVOICE_TOTAL_CHANGED';end if;
 result:=private.complete_and_invoice(p_org,p_job,p_revision);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'invoice.owner_approved',(result->>'id')::uuid,1,gen_random_uuid());
 insert into private.command_receipts values(p_org,'ApproveInvoice',p_key,fingerprint,result,now());
 return result;
end$$;
create function public.approve_invoice(p_org uuid,p_job uuid,p_revision integer,p_total integer,p_reviewed boolean,p_key text) returns jsonb
language sql security invoker set search_path='' as $$ select private.approve_invoice(p_org,p_job,p_revision,p_total,p_reviewed,p_key) $$;
revoke all on function private.complete_service_call(uuid,uuid,integer,text),public.complete_service_call(uuid,uuid,integer,text),private.approve_invoice(uuid,uuid,integer,integer,boolean,text),public.approve_invoice(uuid,uuid,integer,integer,boolean,text) from public,anon,authenticated,service_role;
grant execute on function private.complete_service_call(uuid,uuid,integer,text),public.complete_service_call(uuid,uuid,integer,text),private.approve_invoice(uuid,uuid,integer,integer,boolean,text),public.approve_invoice(uuid,uuid,integer,integer,boolean,text) to authenticated;
