-- Owner-only "home profile" for each customer: how to get in, pets, parking and preferences.
-- Internal operational notes; never exposed to the customer portal, website or public metadata.
create table private.customer_home_profiles (
 organization_id uuid not null references public.organizations(id),
 customer_id uuid not null,
 access_notes text not null default '' check(length(access_notes)<=500),
 pets text not null default '' check(length(pets)<=300),
 parking text not null default '' check(length(parking)<=300),
 preferences text not null default '' check(length(preferences)<=1000),
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,customer_id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index customer_home_profiles_updated_by on private.customer_home_profiles(updated_by);
alter table private.customer_home_profiles enable row level security;
revoke all on private.customer_home_profiles from public,anon,authenticated,service_role;
create policy customer_home_profiles_deny on private.customer_home_profiles to anon,authenticated using(false) with check(false);

create function private.read_home_profile(p_org uuid,p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p private.customer_home_profiles;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_customer is null then raise exception 'VALIDATION';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND';end if;
 select * into p from private.customer_home_profiles where organization_id=p_org and customer_id=p_customer;
 if not found then return jsonb_build_object('accessNotes','','pets','','parking','','preferences','','revision',0,'updatedAt',null);end if;
 return jsonb_build_object('accessNotes',p.access_notes,'pets',p.pets,'parking',p.parking,'preferences',p.preferences,'revision',p.revision,'updatedAt',p.updated_at);
end$$;
create function public.read_home_profile(p_org uuid,p_customer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.read_home_profile(p_org,p_customer)$$;
revoke all on function private.read_home_profile(uuid,uuid),public.read_home_profile(uuid,uuid) from public,anon,service_role;
grant execute on function private.read_home_profile(uuid,uuid),public.read_home_profile(uuid,uuid) to authenticated;

-- p_revision is the revision the owner edited (0 = no profile yet). A stale revision is rejected
-- so an older screen can never overwrite newer details; the same retry key replays its result.
create function private.save_home_profile(p_org uuid,p_customer uuid,p_revision integer,p_access text,p_pets text,p_parking text,p_preferences text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous private.command_receipts;fingerprint text;result jsonb;current_revision integer;next_revision integer;
begin
 if not private.staff(p_org,array['owner','admin']) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled) then raise exception 'SETUP_REQUIRED';end if;
 if p_customer is null or p_revision is null or p_revision<0 or p_key is null or length(p_key) not between 16 and 128
 or p_access is null or p_pets is null or p_parking is null or p_preferences is null
 or length(trim(p_access))>500 or length(trim(p_pets))>300 or length(trim(p_parking))>300 or length(trim(p_preferences))>1000 then raise exception 'VALIDATION';end if;
 if not exists(select 1 from public.customers where organization_id=p_org and id=p_customer) then raise exception 'NOT_FOUND';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_customer,p_revision,trim(p_access),trim(p_pets),trim(p_parking),trim(p_preferences),auth.uid())::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':home-profile:'||p_customer::text,0));
 select * into previous from private.command_receipts where organization_id=p_org and command='SaveHomeProfile' and key=p_key;
 if found then if previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;return previous.result;end if;
 select revision into current_revision from private.customer_home_profiles where organization_id=p_org and customer_id=p_customer for update;
 if coalesce(current_revision,0)<>p_revision then raise exception 'STALE_REVISION';end if;
 next_revision:=p_revision+1;
 insert into private.customer_home_profiles(organization_id,customer_id,access_notes,pets,parking,preferences,revision,updated_by,updated_at)
 values(p_org,p_customer,trim(p_access),trim(p_pets),trim(p_parking),trim(p_preferences),next_revision,auth.uid(),clock_timestamp())
 on conflict(organization_id,customer_id) do update set access_notes=excluded.access_notes,pets=excluded.pets,parking=excluded.parking,preferences=excluded.preferences,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id)
 values(p_org,auth.uid(),'customer.home_profile_saved',p_customer,next_revision,p_customer);
 result:=jsonb_build_object('saved',true,'revision',next_revision);
 insert into private.command_receipts values(p_org,'SaveHomeProfile',p_key,fingerprint,result,clock_timestamp());return result;
end$$;
create function public.save_home_profile(p_org uuid,p_customer uuid,p_revision integer,p_access text,p_pets text,p_parking text,p_preferences text,p_key text) returns jsonb
language sql security invoker set search_path='' as $$select private.save_home_profile(p_org,p_customer,p_revision,p_access,p_pets,p_parking,p_preferences,p_key)$$;
revoke all on function private.save_home_profile(uuid,uuid,integer,text,text,text,text,text),public.save_home_profile(uuid,uuid,integer,text,text,text,text,text) from public,anon,service_role;
grant execute on function private.save_home_profile(uuid,uuid,integer,text,text,text,text,text),public.save_home_profile(uuid,uuid,integer,text,text,text,text,text) to authenticated;

-- Deleting an eligible customer also deletes their home profile (guarded patch of the erase command).
do $migration$
declare d text;old text;sig regprocedure:='private.erase_customer(uuid,uuid,text)'::regprocedure;
begin
 d:=pg_get_functiondef(sig);
 old:='delete from private.relationship_notes where organization_id=p_org and customer_id=p_id;';
 if strpos(d,old)=0 then raise exception 'ERASE_CUSTOMER_CHANGED';end if;
 d:=replace(d,old,old||' delete from private.customer_home_profiles where organization_id=p_org and customer_id=p_id;');
 execute d;
end $migration$;
