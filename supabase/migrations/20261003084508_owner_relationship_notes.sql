-- Internal append-only relationship history; never included in customer portal or platform metadata.
create table private.relationship_notes (
 organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(),
 customer_id uuid,request_id uuid,author_id uuid not null references auth.users(id),
 body text not null check(length(trim(body)) between 1 and 4000),created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,request_id) references public.service_requests(organization_id,id),
 check((customer_id is null)<>(request_id is null))
);
create index relationship_notes_customer on private.relationship_notes(organization_id,customer_id,created_at desc,id);
create index relationship_notes_request on private.relationship_notes(organization_id,request_id,created_at desc,id);
create index relationship_notes_author on private.relationship_notes(author_id);
alter table private.relationship_notes enable row level security;
revoke all on private.relationship_notes from public,anon,authenticated,service_role;
create policy relationship_notes_deny on private.relationship_notes to anon,authenticated using(false) with check(false);

create function private.read_relationship_notes(p_org uuid,p_type text,p_target uuid,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_type not in('request','customer') or p_type is null or p_target is null or p_page is null or p_page not between 0 and 100000 then raise exception 'VALIDATION';end if;
 if (p_type='request' and not exists(select 1 from public.service_requests where organization_id=p_org and id=p_target))
 or (p_type='customer' and not exists(select 1 from public.customers where organization_id=p_org and id=p_target)) then raise exception 'NOT_FOUND';end if;
 select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id),'[]'::jsonb) into result from (
  select n.id,n.body,n.created_at,n.request_id from private.relationship_notes n where n.organization_id=p_org and
   ((p_type='request' and n.request_id=p_target) or (p_type='customer' and (n.customer_id=p_target or exists(select 1 from public.service_requests r where r.organization_id=p_org and r.id=n.request_id and r.customer_id=p_target))))
  order by n.created_at desc,n.id offset p_page*50 limit 51
 ) n;
 return jsonb_build_object('notes',result,'page',p_page);
end$$;
create function public.read_relationship_notes(p_org uuid,p_type text,p_target uuid,p_page integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$select private.read_relationship_notes(p_org,p_type,p_target,p_page)$$;
revoke all on function private.read_relationship_notes(uuid,text,uuid,integer),public.read_relationship_notes(uuid,text,uuid,integer) from public,anon,service_role;
grant execute on function private.read_relationship_notes(uuid,text,uuid,integer),public.read_relationship_notes(uuid,text,uuid,integer) to authenticated;

create function private.add_relationship_note(p_org uuid,p_type text,p_target uuid,p_body text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous private.command_receipts;fingerprint text;result jsonb;note_id uuid;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_type not in('request','customer') or p_type is null or p_target is null or length(trim(coalesce(p_body,''))) not between 1 and 4000
 or p_key is null or length(p_key) not between 16 and 128 then raise exception 'VALIDATION';end if;
 p_body:=trim(p_body);
 if (p_type='request' and not exists(select 1 from public.service_requests where organization_id=p_org and id=p_target))
 or (p_type='customer' and not exists(select 1 from public.customers where organization_id=p_org and id=p_target)) then raise exception 'NOT_FOUND';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_type,p_target,p_body,auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':note:'||p_key,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='AddRelationshipNote' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 insert into private.relationship_notes(organization_id,customer_id,request_id,author_id,body)
 values(p_org,case when p_type='customer' then p_target end,case when p_type='request' then p_target end,auth.uid(),p_body) returning id into note_id;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'relationship.note_added',note_id,1,note_id);
 result:=jsonb_build_object('id',note_id,'saved',true);
 insert into private.command_receipts values(p_org,'AddRelationshipNote',p_key,fingerprint,result,clock_timestamp());return result;
end$$;
create function public.add_relationship_note(p_org uuid,p_type text,p_target uuid,p_body text,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.add_relationship_note(p_org,p_type,p_target,p_body,p_key)$$;
revoke all on function private.add_relationship_note(uuid,text,uuid,text,text),public.add_relationship_note(uuid,text,uuid,text,text) from public,anon,service_role;
grant execute on function private.add_relationship_note(uuid,text,uuid,text,text),public.add_relationship_note(uuid,text,uuid,text,text) to authenticated;
