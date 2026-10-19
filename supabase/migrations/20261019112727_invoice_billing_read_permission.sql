-- Invoice administration/receipt reads require the customer's billing capability,
-- independently of whether the customer can approve commercial proposals.
do $$declare d text;old text;begin
 d:=pg_get_functiondef('private.invoice_payment_context(uuid,uuid)'::regprocedure);
 old:='private.customer_allowed(p_org,i.customer_id,false,true)';
 if position(old in d)=0 then raise exception 'INVOICE_READ_PERMISSION_BASELINE_CHANGED';end if;
 execute replace(d,old,'private.customer_allowed(p_org,i.customer_id,true,false)');
end$$;
-- Existing wrapper, locked search_path and role grants are retained. No rows,
-- commercial commands, provider activation or financial snapshots are changed.
