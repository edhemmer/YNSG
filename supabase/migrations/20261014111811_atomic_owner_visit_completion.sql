-- Work saving and completion share one transaction; no invoice or payment is created.
do $migration$
declare d text; anchor text := ' update public.jobs set status=''completed'',revision=revision+1 where organization_id=p_org and id=p_job returning * into j;';
begin
 d:=pg_get_functiondef('private.complete_service_call(uuid,uuid,integer,text)'::regprocedure);
 if strpos(d,anchor)=0 then raise exception 'completion baseline changed';end if;
 execute replace(d,anchor,' update public.work_sessions set ended_at=clock_timestamp() where organization_id=p_org and job_id=p_job and ended_at is null;'||chr(10)||anchor);
end $migration$;
create function private.complete_owner_visit(p_org uuid,p_job uuid,p_revision integer,p_lines jsonb,p_reviewed boolean,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.command_receipts; fingerprint text; draft jsonb; result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_reviewed is distinct from true then raise exception 'WORK_REVIEW_REQUIRED';end if;
 if p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_job,p_revision,p_lines,p_reviewed)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':owner-visit:'||p_key,0));
 select * into prior from private.command_receipts where organization_id=p_org and command='CompleteOwnerVisit' and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 draft:=private.save_invoice_labor(p_org,p_job,p_revision,p_lines,encode(sha256(convert_to('work:'||p_key,'UTF8')),'hex'));
 result:=private.complete_service_call(p_org,p_job,(draft->>'revision')::integer,encode(sha256(convert_to('complete:'||p_key,'UTF8')),'hex'));
 insert into private.command_receipts values(p_org,'CompleteOwnerVisit',p_key,fingerprint,result,now());
 return result;
end$$;
create function public.complete_owner_visit(p_org uuid,p_job uuid,p_revision integer,p_lines jsonb,p_reviewed boolean,p_key text) returns jsonb
language sql security invoker set search_path='' as $$ select private.complete_owner_visit(p_org,p_job,p_revision,p_lines,p_reviewed,p_key) $$;
revoke all on function private.complete_owner_visit(uuid,uuid,integer,jsonb,boolean,text),public.complete_owner_visit(uuid,uuid,integer,jsonb,boolean,text) from public,anon,authenticated,service_role;
grant execute on function private.complete_owner_visit(uuid,uuid,integer,jsonb,boolean,text),public.complete_owner_visit(uuid,uuid,integer,jsonb,boolean,text) to authenticated;
