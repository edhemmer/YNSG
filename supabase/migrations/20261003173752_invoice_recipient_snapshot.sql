-- Freeze only the linked customer presentation fields when an invoice is issued.
-- Runs in the existing guarded issuance transaction; no new callable privileged API.
create function private.freeze_invoice_recipient() returns trigger
language plpgsql security invoker set search_path='' as $$
declare submission jsonb; address public.properties;
begin
 select r.original_submission into submission from public.jobs j
 join public.quotes q on q.organization_id=j.organization_id and q.id=j.quote_id
 join public.service_requests r on r.organization_id=q.organization_id and r.id=q.request_id
 where j.organization_id=new.organization_id and j.id=new.job_id
 and j.customer_id=new.customer_id and q.customer_id=new.customer_id and r.customer_id=new.customer_id;
 select * into address from public.properties where organization_id=new.organization_id
 and id=(new.snapshot->>'propertyId')::uuid and customer_id=new.customer_id;
 if submission is null or address.id is null
 or length(trim(coalesce(submission->>'name','')))=0
 or length(trim(coalesce(submission->>'email','')))=0
 or length(trim(coalesce(submission->>'phone','')))=0 then raise exception 'INVOICE_CUSTOMER_DETAILS_REQUIRED';end if;
 new.snapshot:=new.snapshot||jsonb_build_object('recipient',jsonb_build_object(
 'name',submission->>'name','email',submission->>'email','phone',submission->>'phone',
 'street',address.street,'city',address.city,'region',address.region,'postalCode',coalesce(address.postal_code,'')));
 return new;
end$$;
revoke all on function private.freeze_invoice_recipient() from public,anon,authenticated,service_role;
create trigger invoice_recipient_snapshot before insert on public.invoices
for each row execute function private.freeze_invoice_recipient();
