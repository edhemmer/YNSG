-- Diagnostic messages retain the existing enabled-company gate and lease.
do $$
declare definition text;needle text := 'o.kind in(''request.declined''';
begin
 definition:=pg_get_functiondef('private.claim_mail_company()'::regprocedure);
 if position(needle in definition)=0 then raise exception 'MIGRATION_REVIEW_REQUIRED';end if;
 definition:=replace(definition,'and (o.kind<>''invoice.paid''','and (o.kind<>''diagnostic.template_preview'' or o.status in(''pending'',''sending'')) and (o.kind<>''invoice.paid''');
 execute replace(definition,needle,'o.kind in(''diagnostic.template_preview'',''request.declined''');
end$$;
