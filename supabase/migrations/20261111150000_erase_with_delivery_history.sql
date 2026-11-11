-- Permanent delete of an unbilled request failed once any email about it had been tried: the saved
-- delivery attempts still pointed at the message rows being removed, so the whole delete rolled back.
-- Delivery attempts for the removed messages are now removed with them, inside the same action.
do $migration$ declare d text;old text;begin
 d:=pg_get_functiondef('private.erase_service_request(uuid,uuid,integer,text)'::regprocedure);
 old:=E' delete from public.outbox where organization_id=p_org';
 if strpos(d,old)=0 then raise exception 'erase request baseline changed';end if;
 d:=replace(d,old,E' delete from public.delivery_attempts where organization_id=p_org and outbox_id in (select id from public.outbox where organization_id=p_org and object_id=any(array[p_id]||q_ids||j_ids||a_ids));
'||old);
 execute d;
end $migration$;
