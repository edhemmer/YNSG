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
