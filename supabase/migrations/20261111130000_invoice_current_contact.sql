-- An invoice is addressed to the customer's current requester contact, frozen at the moment it is issued.
-- Before this, the recipient always came from the original request, so correcting a mistyped email on
-- the customer record never reached the invoice. The original submission itself is never edited, and
-- invoices already issued keep their saved recipient. Only one unambiguous requester contact is used;
-- otherwise the original submission stays the source.
do $migration$ declare d text;old text;begin
 d:=pg_get_functiondef('private.freeze_invoice_recipient()'::regprocedure);
 old:=E' select * into address from public.properties';
 if strpos(d,old)=0 then raise exception 'recipient snapshot baseline changed';end if;
 d:=replace(d,'declare submission jsonb; address public.properties;','declare submission jsonb; address public.properties; current_contact public.contacts; contact_count integer;');
 d:=replace(d,old,E' select count(*) into contact_count from public.contacts where organization_id=new.organization_id and customer_id=new.customer_id and relationship=''requester'';
 if submission is not null and contact_count=1 then
  select * into current_contact from public.contacts where organization_id=new.organization_id and customer_id=new.customer_id and relationship=''requester'';
  if current_contact.email ~ ''^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'' then submission:=submission||jsonb_build_object(''email'',current_contact.email);end if;
  if length(trim(coalesce(current_contact.phone,'''')))>0 then submission:=submission||jsonb_build_object(''phone'',current_contact.phone);end if;
 end if;
'||old);
 execute d;
end $migration$;
