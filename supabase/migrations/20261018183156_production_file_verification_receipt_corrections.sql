-- Browser-uploaded metadata is not byte-verification evidence. Only the server
-- may finalize after reading and hashing stored bytes with the actor's access.
create or replace function public.finalize_customer_file(p_org uuid,p_file uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 raise exception 'SERVER_VERIFICATION_REQUIRED';
end$$;
create function public.confirm_verified_customer_file(p_org uuid,p_file uuid,p_actor uuid,p_session uuid,p_mime text,p_bytes integer,p_sha text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f private.customer_supporting_files;
begin
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.memberships m on m.user_id=u.id
  where s.id=p_session and s.user_id=p_actor and (s.not_after is null or s.not_after>now())
  and u.deleted_at is null and not u.is_anonymous and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
  and m.organization_id=p_org and m.role in('owner','admin') and m.revoked_at is null)
 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into f from private.customer_supporting_files where organization_id=p_org and id=p_file and actor_id=p_actor for update;
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if p_mime is null or p_mime not in('image/jpeg','image/png') or p_mime<>f.mime or p_bytes is distinct from f.bytes or p_sha is distinct from f.sha256 then raise exception 'FILE_VERIFICATION_MISMATCH';end if;
 if not exists(select 1 from storage.objects where bucket_id='ynsg-customer-files' and name=f.object_path) then raise exception 'UPLOAD_UNCONFIRMED';end if;
 if f.status='pending' then
  update private.customer_supporting_files set status='ready',ready_at=now() where organization_id=p_org and id=p_file;
  insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,p_actor,'customer.file_uploaded',p_file,1,gen_random_uuid());
 end if;
 return jsonb_build_object('id',p_file,'ready',true);
end$$;
revoke all on function public.confirm_verified_customer_file(uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.confirm_verified_customer_file(uuid,uuid,uuid,uuid,text,integer,text) to service_role;
-- Legacy files remain retained. Download authorization supplies the frozen
-- digest so the server can verify old and new objects before signing access.
create function public.verified_customer_file_access(p_org uuid,p_file uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f private.customer_supporting_files;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into f from private.customer_supporting_files where organization_id=p_org and id=p_file and status='ready';
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 return jsonb_build_object('path',f.object_path,'name',f.original_name,'mime',f.mime,'bytes',f.bytes,'sha256',f.sha256);
end$$;
revoke all on function public.verified_customer_file_access(uuid,uuid) from public,anon,service_role;
grant execute on function public.verified_customer_file_access(uuid,uuid) to authenticated;
-- Match supported image contracts; retained legacy metadata is not rewritten.
update storage.buckets set file_size_limit=4194304,allowed_mime_types=array['image/jpeg','image/png'] where id='ynsg-customer-files';
do $$declare d text;begin
 d:=pg_get_functiondef('public.reserve_customer_file(uuid,uuid,uuid,text,text,text,integer,text)'::regprocedure);
 d:=replace(d,'''image/jpeg'',''image/png'',''application/pdf''','''image/jpeg'',''image/png''');
 d:=replace(d,'p_bytes not between 1 and 8388608','p_bytes not between 1 and 4194304');
 execute d;
end$$;

-- Corrections append an opposite receipt. Issued invoices, original receipts
-- and their journals stay immutable. This is a data correction, not a refund.
alter table public.payments add column reverses_payment_id uuid;
alter table public.payments add constraint payment_correction_original foreign key(organization_id,reverses_payment_id) references public.payments(organization_id,id);
create unique index one_payment_correction on public.payments(organization_id,reverses_payment_id) where reverses_payment_id is not null;
alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check check(method in('cash','zelle','stripe','stripe_refund','cash_correction','zelle_correction'));
alter table public.payments drop constraint payments_cents_check;
alter table public.payments add constraint payments_cents_check check(
 (method in('cash_correction','zelle_correction') and cents<0 and reverses_payment_id is not null)
 or (method='stripe_refund' and cents<0 and reverses_payment_id is null)
 or (method in('cash','zelle','stripe') and cents>0 and reverses_payment_id is null));
create function private.reverse_recorded_payment(p_org uuid,p_invoice uuid,p_payment uuid,p_reason text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.invoices;p public.payments;paid bigint;pid uuid;jid uuid;previous private.command_receipts;fingerprint text;result jsonb;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 300 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_invoice,p_payment,trim(p_reason),auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':receipt-correction:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='ReverseRecordedPayment' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 select * into i from public.invoices where organization_id=p_org and id=p_invoice for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from private.card_orders where organization_id=p_org and invoice_id=p_invoice and status in('prepared','open')) then raise exception 'CARD_PAYMENT_PENDING';end if;
 select * into p from public.payments where organization_id=p_org and invoice_id=p_invoice and id=p_payment;
 if not found then raise exception 'NOT_FOUND';end if;
 if p.method not in('cash','zelle') or p.cents<=0 or p.reverses_payment_id is not null then raise exception 'UNSUPPORTED_PAYMENT_CORRECTION';end if;
 if exists(select 1 from public.payments where organization_id=p_org and reverses_payment_id=p.id) then raise exception 'PAYMENT_ALREADY_REVERSED';end if;
 select coalesce(sum(cents::bigint),0) into paid from public.payments where organization_id=p_org and invoice_id=p_invoice;
 if paid<p.cents then raise exception 'PAYMENT_BALANCE_REVIEW_REQUIRED';end if;
 insert into public.payments(organization_id,invoice_id,cents,method,collector,reference,received_at,reverses_payment_id)
 values(p_org,p_invoice,-p.cents,p.method||'_correction',auth.uid(),trim(p_reason),now(),p.id) returning id into pid;
 insert into public.journal_entries(organization_id,source_kind,source_id) values(p_org,'reversal',pid) returning id into jid;
 insert into public.journal_lines(organization_id,entry_id,account,debit_cents,credit_cents) values(p_org,jid,'receivable',p.cents,0),(p_org,jid,'cash',0,p.cents);
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'payment.corrected',p.id,2,gen_random_uuid());
 update public.outbox set status='suppressed',lease_token=null,lease_until=null where organization_id=p_org and object_id=p_invoice and kind='invoice.paid' and status in('pending','failed','leased');
 result:=jsonb_build_object('id',pid,'paymentId',p.id,'invoiceId',p_invoice,'reversed',true,'cents',-p.cents,'balanceCents',i.total_cents-paid+p.cents);
 insert into private.command_receipts values(p_org,'ReverseRecordedPayment',p_key,fingerprint,result,now());return result;
end$$;
create function public.reverse_recorded_payment(p_org uuid,p_invoice uuid,p_payment uuid,p_reason text,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.reverse_recorded_payment(p_org,p_invoice,p_payment,p_reason,p_key)$$;
revoke all on function public.reverse_recorded_payment(uuid,uuid,uuid,text,text),private.reverse_recorded_payment(uuid,uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.reverse_recorded_payment(uuid,uuid,uuid,text,text),private.reverse_recorded_payment(uuid,uuid,uuid,text,text) to authenticated;
-- A second correct settlement must not roll back because the original paid
-- milestone already exists. Only a definitely suppressed notice can requeue;
-- accepted/sending/uncertain delivery is never duplicated or overwritten.
do $$declare d text;needle text;replacement text;begin
 d:=pg_get_functiondef('private.record_payment(uuid,uuid,integer,text,text,timestamptz,boolean,text)'::regprocedure);
 needle:='from public.configuration_versions where organization_id=p_org order by version desc limit 1)));';
 replacement:='from public.configuration_versions where organization_id=p_org order by version desc limit 1))) on conflict (organization_id,event_key) do update set status=''pending'',payload=excluded.payload,next_attempt_at=now(),lease_token=null,lease_until=null where public.outbox.status=''suppressed'';';
 if position(needle in d)=0 then raise exception 'PAYMENT_NOTICE_BASELINE_CHANGED';end if;
 execute replace(d,needle,replacement);
 d:=pg_get_functiondef('private.invoice_payment_context(uuid,uuid)'::regprocedure);
 needle:='''receivedAt'',received_at';
 if position(needle in d)=0 then raise exception 'PAYMENT_CONTEXT_BASELINE_CHANGED';end if;
 execute replace(d,needle,'''receivedAt'',received_at,''reversesPayment'',reverses_payment_id');
end$$;

create index journal_export_window on public.journal_entries(organization_id,posted_at,id);
-- Complete transaction-level double-entry export in one database snapshot.
-- This is an accounting journal, not a tax return or a QuickBooks connection.
create function private.accounting_journal_export(p_org uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text;rows jsonb;row_count integer;
begin
 if not private.staff(p_org,array['owner','admin','bookkeeper']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='finance' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'VALIDATION';end if;
 select timezone into tz from public.organizations where id=p_org;
 select coalesce(jsonb_agg(value order by posted_at,entry_id,line_id),'[]'),count(*) into rows,row_count from (
  select e.posted_at,e.id entry_id,l.id line_id,jsonb_build_object('lineId',l.id,'entryId',e.id,'postedAt',e.posted_at,'businessDate',(e.posted_at at time zone tz)::date,'sourceKind',e.source_kind,'sourceId',e.source_id,'account',l.account,'debitCents',l.debit_cents,'creditCents',l.credit_cents) value
  from public.journal_entries e join public.journal_lines l on l.organization_id=e.organization_id and l.entry_id=e.id
  where e.organization_id=p_org and e.posted_at>=(p_from::timestamp at time zone tz) and e.posted_at<((p_to+1)::timestamp at time zone tz)
  order by e.posted_at,e.id,l.id limit 10001
 ) bounded;
 if row_count>10000 then raise exception 'EXPORT_RANGE_TOO_LARGE';end if;
 return jsonb_build_object('organization',p_org,'from',p_from,'to',p_to,'timezone',tz,'complete',true,'rows',rows);
end$$;
create function public.accounting_journal_export(p_org uuid,p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select private.accounting_journal_export(p_org,p_from,p_to)$$;
revoke all on function public.accounting_journal_export(uuid,date,date),private.accounting_journal_export(uuid,date,date) from public,anon,service_role;
grant execute on function public.accounting_journal_export(uuid,date,date),private.accounting_journal_export(uuid,date,date) to authenticated;
