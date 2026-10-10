-- Keep the bigint storage contract and stable UUIDs. New numbers encode
-- YYYYMM plus a six-digit counter; presentation pads the counter to four digits.
-- Historical invoice numbers and ledger references are not rewritten.
create function private.next_monthly_invoice_number(p_org uuid,p_issued timestamptz,p_timezone text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare base bigint; candidate bigint;
begin
 if p_issued is null or p_timezone is null then raise exception 'INVOICE_TIMEZONE_REQUIRED';end if;
 base:=to_char(p_issued at time zone p_timezone,'YYYYMM')::bigint*1000000;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':invoice-number',0));
 select coalesce(max(number),base)+1 into candidate from public.invoices
 where organization_id=p_org and number>base and number<base+1000000;
 if candidate>=base+1000000 then raise exception 'INVOICE_MONTH_CAPACITY_REACHED';end if;
 return candidate;
end$$;
revoke all on function private.next_monthly_invoice_number(uuid,timestamptz,text) from public,anon,authenticated,service_role;
do $$declare definition text; old text:='select coalesce(max(number),0)+1 into n from public.invoices where organization_id=p_org;';begin
 definition:=pg_get_functiondef('private.complete_and_invoice(uuid,uuid,integer)'::regprocedure);
 if strpos(definition,old)=0 then raise exception 'invoice allocator baseline changed';end if;
 execute replace(definition,old,'n:=private.next_monthly_invoice_number(p_org,now(),coalesce(cfg->>''timezone'',''UTC''));');
end$$;
