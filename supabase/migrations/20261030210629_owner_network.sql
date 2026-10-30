-- Private referral directory. Never customer records, commercial approval or certification.
create function private.network_allowed(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.staff(p_org,array['owner','admin']) and exists(select 1 from public.organizations where id=p_org and status in('setup','active')) and exists(select 1 from public.entitlements where organization_id=p_org and module='crm' and enabled)
$$;
revoke all on function private.network_allowed(uuid) from public,anon,service_role;
grant execute on function private.network_allowed(uuid) to authenticated;

create function private.network_valid_profile(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v text;m integer;x jsonb;begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>50000 or (select count(*) from jsonb_object_keys(p))<>14 or exists(select 1 from jsonb_object_keys(p) a where a not in('name','businessName','title','phone','alternatePhone','email','website','address','referralSource','notes','social','categories','vettingStatus','vettingBasis')) then return false;end if;
 -- Fourteen scalar fields plus two arrays, bounded independently of the web API.
 foreach k in array array['name','businessName','title','phone','alternatePhone','email','website','address','referralSource','notes','vettingStatus','vettingBasis'] loop
  v:=p->>k;m:=case k when 'name' then 160 when 'businessName' then 160 when 'title' then 100 when 'phone' then 35 when 'alternatePhone' then 35 when 'email' then 254 when 'website' then 2048 when 'address' then 500 when 'referralSource' then 160 when 'notes' then 4000 when 'vettingStatus' then 20 else 1000 end;
  if jsonb_typeof(p->k) is distinct from 'string' or length(v)>m or v<>btrim(v) or v ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' then return false;end if;
  if k not in('address','notes','vettingBasis') and v ~ '[\n\r\t<>]' then return false;end if;
 end loop;
 if length(p->>'name')<2 or p->>'vettingStatus' not in('not_vetted','referred','known_work') or (p->>'vettingStatus'='known_work' and length(p->>'vettingBasis')<10) then return false;end if;
 foreach k in array array['phone','alternatePhone'] loop v:=p->>k;if v<>'' and (v !~ '^[+0-9() .xX#-]{7,35}$' or length(regexp_replace(v,'[^0-9]','','g'))<7) then return false;end if;end loop;
 if p->>'email'<>'' and p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false;end if;
 if p->>'website'<>'' and (p->>'website' !~* '^https?://[^/[:space:]@]+([/?#]|$)' or p->>'website' ~ '[[:space:]]') then return false;end if;
 if jsonb_typeof(p->'categories') is distinct from 'array' or jsonb_array_length(p->'categories')>12 or jsonb_typeof(p->'social') is distinct from 'array' or jsonb_array_length(p->'social')>8 then return false;end if;
 for x in select value from jsonb_array_elements(p->'categories') loop v:=x#>>'{}';if jsonb_typeof(x)<>'string' or length(v) not between 2 and 60 or v<>btrim(v) or v ~ '[[:cntrl:]<>]' then return false;end if;end loop;
 if (select count(distinct lower(regexp_replace(value,'\s+',' ','g'))) from jsonb_array_elements_text(p->'categories'))<>jsonb_array_length(p->'categories') then return false;end if;
 for x in select value from jsonb_array_elements(p->'social') loop
  if jsonb_typeof(x) is distinct from 'object' or (select count(*) from jsonb_object_keys(x))<>2 or jsonb_typeof(x->'label') is distinct from 'string' or jsonb_typeof(x->'url') is distinct from 'string' or length(x->>'label') not between 2 and 40 or x->>'label' ~ '[[:cntrl:]<>]' or length(x->>'url')>2048 or x->>'url' !~* '^https?://[^/[:space:]@]+([/?#]|$)' or x->>'url' ~ '[[:space:]]' then return false;end if;
 end loop;return true;
end $$;
revoke all on function private.network_valid_profile(jsonb) from public,anon,authenticated,service_role;

create table private.owner_network_contacts(
 organization_id uuid not null references public.organizations(id),id uuid not null,profile jsonb not null check(private.network_valid_profile(profile)),
 revision integer not null default 1 check(revision>0),vetted_at timestamptz,vetted_by uuid,archived_at timestamptz,updated_at timestamptz not null default clock_timestamp(),created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,id),check((profile->>'vettingStatus'='known_work')=(vetted_at is not null and vetted_by is not null))
);
create index network_contacts_list on private.owner_network_contacts(organization_id,archived_at,lower(profile->>'name'),id);
create table private.owner_network_categories(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(),name text not null check(length(name) between 2 and 60),normalized text not null,primary key(organization_id,id),unique(organization_id,normalized));
create table private.owner_network_contact_categories(organization_id uuid not null,contact_id uuid not null,category_id uuid not null,primary key(organization_id,contact_id,category_id),foreign key(organization_id,contact_id) references private.owner_network_contacts(organization_id,id),foreign key(organization_id,category_id) references private.owner_network_categories(organization_id,id));
create index network_category_contacts on private.owner_network_contact_categories(organization_id,category_id,contact_id);
create table private.owner_network_vetting_history(organization_id uuid not null,id uuid not null default gen_random_uuid(),contact_id uuid not null,actor_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),before_record jsonb not null,after_record jsonb not null,primary key(organization_id,id),foreign key(organization_id,contact_id) references private.owner_network_contacts(organization_id,id));
create index network_vetting_contact on private.owner_network_vetting_history(organization_id,contact_id,recorded_at);
create table private.owner_network_cards(
 organization_id uuid not null,id uuid not null default gen_random_uuid(),contact_id uuid not null,created_by uuid not null,original_name text not null check(length(original_name) between 1 and 180),mime text not null check(mime in('image/jpeg','image/png')),bytes integer not null check(bytes between 8 and 4194304),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),object_path text not null unique,status text not null default 'pending' check(status in('pending','ready')),created_at timestamptz not null default clock_timestamp(),ready_at timestamptz,verified_by uuid,archived_at timestamptz,
 primary key(organization_id,id),unique(organization_id,contact_id,sha256,mime,bytes),foreign key(organization_id,contact_id) references private.owner_network_contacts(organization_id,id),check(object_path=organization_id::text||'/'||id::text),check((status='ready')=(ready_at is not null and verified_by is not null))
);
create index network_cards_contact on private.owner_network_cards(organization_id,contact_id,created_at);
do $$declare t text;begin foreach t in array array['owner_network_contacts','owner_network_categories','owner_network_contact_categories','owner_network_vetting_history','owner_network_cards'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('create policy network_guard on private.%I for select to authenticated using(private.network_allowed(organization_id))',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
end loop;end$$;

create function private.owner_network_command(p_org uuid,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;a text;k uuid;cid uuid;rev integer;f text;ns text;prior private.command_receipts;c private.owner_network_contacts;p jsonb;r jsonb;cat text;catid uuid;review boolean;moment timestamptz:=clock_timestamp();begin
 if not private.network_allowed(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_body is null or octet_length(p_body)>65536 then raise exception 'VALIDATION';end if;d:=p_body::jsonb;a:=d->>'action';k:=(d->>'key')::uuid;cid:=(d->>'id')::uuid;rev:=(d->>'revision')::integer;
 if d->>'organization' is distinct from p_org::text or k is null or cid is null or rev is null or rev<0 or a is null or a not in('save','archive','restore','resolve') or exists(select 1 from jsonb_object_keys(d) q where q not in('organization','id','key','revision','action','profile','attestVetting','operation','fingerprint')) then raise exception 'VALIDATION';end if;
 ns:='OwnerNetwork:'||auth.uid()::text;f:=case when a='resolve' then d->>'fingerprint' else encode(sha256(convert_to(p_body,'UTF8')),'hex') end;
 if f is null or f !~ '^[a-f0-9]{64}$' or (a='resolve' and (d->>'operation' is null or d->>'operation' not in('save','archive','restore'))) then raise exception 'VALIDATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||k::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=k::text;
 if found then if prior.fingerprint<>f or prior.result->>'id'<>cid::text or prior.result->>'operation'<>(case when a='resolve' then d->>'operation' else a end) then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if a='resolve' then
  r:=jsonb_build_object('organization',p_org,'id',cid,'key',k,'fingerprint',f,'operation',d->>'operation','outcome','not_applied','revision',null);
  insert into private.command_receipts values(p_org,ns,k::text,f,r,now());return r;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':owner-network',0));
 select * into c from private.owner_network_contacts where organization_id=p_org and id=cid for update;
 if (c.id is null and rev<>0) or (c.id is not null and c.revision<>rev) then raise exception 'STALE_REVISION';end if;
 if a='save' then
  p:=d->'profile';if not private.network_valid_profile(p) or jsonb_typeof(d->'attestVetting') is distinct from 'boolean' then raise exception 'VALIDATION';end if;
  if c.archived_at is not null then raise exception 'ARCHIVED';end if;
  review:=(coalesce(c.profile->>'vettingStatus','not_vetted') is distinct from p->>'vettingStatus') or (coalesce(c.profile->>'vettingBasis','') is distinct from p->>'vettingBasis') or (p->>'vettingStatus'='known_work' and (c.profile->>'name' is distinct from p->>'name' or c.profile->>'businessName' is distinct from p->>'businessName' or c.profile->'categories' is distinct from p->'categories'));
  if review and (c.profile->>'vettingStatus'='known_work' or p->>'vettingStatus'='known_work') then
   if not private.staff(p_org,array['owner']) then raise exception 'OWNER_VETTING_REQUIRED' using errcode='42501';end if;
   if p->>'vettingStatus'='known_work' and d->>'attestVetting' is distinct from 'true' then raise exception 'ATTESTATION_REQUIRED';end if;
  end if;
  if c.id is null then
   insert into private.owner_network_contacts(organization_id,id,profile,vetted_at,vetted_by) values(p_org,cid,p,case when p->>'vettingStatus'='known_work' then moment end,case when p->>'vettingStatus'='known_work' then auth.uid() end);
  else
   update private.owner_network_contacts set profile=p,revision=revision+1,updated_at=moment,vetted_at=case when p->>'vettingStatus'<>'known_work' then null when review then moment else c.vetted_at end,vetted_by=case when p->>'vettingStatus'<>'known_work' then null when review then auth.uid() else c.vetted_by end where organization_id=p_org and id=cid;
  end if;
  delete from private.owner_network_contact_categories where organization_id=p_org and contact_id=cid;
  for cat in select value from jsonb_array_elements_text(p->'categories') loop
   insert into private.owner_network_categories(organization_id,name,normalized) values(p_org,cat,lower(regexp_replace(cat,'\s+',' ','g'))) on conflict(organization_id,normalized) do update set name=private.owner_network_categories.name returning id into catid;
   insert into private.owner_network_contact_categories values(p_org,cid,catid);
  end loop;
  if review then insert into private.owner_network_vetting_history(organization_id,contact_id,actor_id,before_record,after_record) values(p_org,cid,auth.uid(),coalesce(c.profile,'{}'),p);end if;
 else
  if c.id is null then raise exception 'NOT_FOUND';end if;
  if (a='archive' and c.archived_at is not null) or (a='restore' and c.archived_at is null) then raise exception 'TRANSITION';end if;
  update private.owner_network_contacts set archived_at=case when a='archive' then moment end,revision=revision+1,updated_at=moment where organization_id=p_org and id=cid;
 end if;
 r:=jsonb_build_object('organization',p_org,'id',cid,'key',k,'fingerprint',f,'operation',a,'outcome','saved','revision',rev+1);
 insert into private.command_receipts values(p_org,ns,k::text,f,r,now());
 insert into public.audit_events(organization_id,actor_id,action,object_id,object_revision,correlation_id) values(p_org,auth.uid(),'owner_network.'||a,cid,rev+1,k);return r;
end $$;

create function private.network_contact_json(c private.owner_network_contacts) returns jsonb language sql stable security invoker set search_path='' as $$
 select c.profile||jsonb_build_object('id',c.id,'revision',c.revision,'vettedAt',c.vetted_at,'vettedBy',c.vetted_by,'updatedAt',c.updated_at,'archivedAt',c.archived_at,'cardCount',(select count(*) from private.owner_network_cards where organization_id=c.organization_id and contact_id=c.id))
$$;
revoke all on function private.network_contact_json(private.owner_network_contacts) from public,anon,authenticated,service_role;
create function private.owner_network_read(p_org uuid,p_query jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;items jsonb;cats jsonb;total bigint;pg integer;search text;st text;vet text;category text;c private.owner_network_contacts;begin
 if not private.network_allowed(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 pg:=coalesce((p_query->>'page')::integer,0);search:=lower(coalesce(p_query->>'query',''));st:=coalesce(p_query->>'status','active');vet:=coalesce(p_query->>'vetting','all');category:=p_query->>'category';
 if pg not between 0 and 10000 or length(search)>100 or st not in('active','archived','all') or vet not in('all','not_vetted','referred','known_work') then raise exception 'VALIDATION';end if;
 r:=jsonb_build_object('organization',p_org,'actor',auth.uid(),'canVet',private.staff(p_org,array['owner']),'checkedAt',now());
 if p_query->>'id' is not null then
  select * into c from private.owner_network_contacts where organization_id=p_org and id=(p_query->>'id')::uuid;if not found then raise exception 'NOT_FOUND';end if;
  return r||jsonb_build_object('view','contact','contact',private.network_contact_json(c),'cards',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',original_name,'mime',mime,'bytes',bytes,'status',status,'archivedAt',archived_at,'createdAt',created_at) order by created_at,id) from private.owner_network_cards where organization_id=p_org and contact_id=c.id),'[]'));
 end if;
 with matching as (select c2.* from private.owner_network_contacts c2 where organization_id=p_org
  and (st='all' or (st='active')=(archived_at is null)) and (vet='all' or profile->>'vettingStatus'=vet)
  and (category is null or (category='uncategorized' and not exists(select 1 from private.owner_network_contact_categories l where l.organization_id=p_org and l.contact_id=c2.id)) or exists(select 1 from private.owner_network_contact_categories l where l.organization_id=p_org and l.contact_id=c2.id and l.category_id::text=category))
  and (search='' or strpos(lower(concat_ws(' ',profile->>'name',profile->>'businessName',profile->>'phone',profile->>'email',profile->>'title',profile->>'notes',profile->>'referralSource',profile->'categories'::text)),search)>0))
 select count(*),coalesce((select jsonb_agg(private.network_contact_json((m.*)::private.owner_network_contacts) order by lower(m.profile->>'name'),m.id) from (select x.* from matching x order by lower(profile->>'name'),id limit 20 offset pg*20) m),'[]') into total,items from matching;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'count',n) order by lower(name),id),'[]') into cats from (select cat.id,cat.name,count(c3.id) n from private.owner_network_categories cat left join private.owner_network_contact_categories l on l.organization_id=cat.organization_id and l.category_id=cat.id left join private.owner_network_contacts c3 on c3.organization_id=l.organization_id and c3.id=l.contact_id and (st='all' or (st='active')=(c3.archived_at is null)) where cat.organization_id=p_org group by cat.id,cat.name having count(c3.id)>0 order by lower(cat.name),cat.id limit 501) q;
 return r||jsonb_build_object('view','list','items',items,'categories',case when jsonb_array_length(cats)>500 then cats-500 else cats end,'categoriesMore',jsonb_array_length(cats)>500,'matching',total,'page',pg,'hasMore',total>(pg+1)*20);
end $$;
create function public.owner_network_command(p_org uuid,p_body text) returns jsonb language sql security invoker set search_path='' as $$select private.owner_network_command(p_org,p_body)$$;
create function public.owner_network_read(p_org uuid,p_query jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.owner_network_read(p_org,p_query)$$;
revoke all on function private.owner_network_command(uuid,text),public.owner_network_command(uuid,text),private.owner_network_read(uuid,jsonb),public.owner_network_read(uuid,jsonb) from public,anon,service_role;
grant execute on function private.owner_network_command(uuid,text),public.owner_network_command(uuid,text),private.owner_network_read(uuid,jsonb),public.owner_network_read(uuid,jsonb) to authenticated;

create function private.network_card_permission(p_path text,p_insert boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.owner_network_cards f join private.owner_network_contacts c on c.organization_id=f.organization_id and c.id=f.contact_id where f.object_path=p_path and private.network_allowed(f.organization_id) and (not p_insert or (f.status='pending' and c.archived_at is null)))
$$;
revoke all on function private.network_card_permission(text,boolean) from public,anon,service_role;
grant execute on function private.network_card_permission(text,boolean) to authenticated;
create policy network_cards_read on storage.objects for select to authenticated using(bucket_id='ynsg-customer-files' and private.network_card_permission(name,false));
create policy network_cards_insert on storage.objects for insert to authenticated with check(bucket_id='ynsg-customer-files' and private.network_card_permission(name,true));

create function private.owner_network_card(p_org uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f private.owner_network_cards;c private.owner_network_contacts;k uuid;ns text;digest text;prior private.command_receipts;r jsonb;a text:=p_data->>'action';begin
 if not private.network_allowed(p_org) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_data is null or octet_length(p_data::text)>4000 or a is null or a not in('reserve','access','archive') then raise exception 'VALIDATION';end if;
 if a='access' then
  select * into f from private.owner_network_cards where organization_id=p_org and id=(p_data->>'file')::uuid and status='ready' and archived_at is null;
  if not found then raise exception 'NOT_FOUND';end if;
  return jsonb_build_object('organization',p_org,'contact',f.contact_id,'id',f.id,'path',f.object_path,'name',f.original_name,'mime',f.mime,'bytes',f.bytes,'sha256',f.sha256);
 end if;
 k:=(p_data->>'key')::uuid;ns:='OwnerNetworkCard:'||auth.uid()::text;
 if k is null then raise exception 'VALIDATION';end if;
 digest:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||ns||k::text,0));
 select * into prior from private.command_receipts where organization_id=p_org and command=ns and key=k::text;
 if found then if prior.fingerprint<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':owner-network',0));
 select * into c from private.owner_network_contacts where organization_id=p_org and id=(p_data->>'contact')::uuid for update;
 if not found or c.archived_at is not null then raise exception 'NOT_FOUND';end if;
 if a='archive' then
  if jsonb_typeof(p_data->'archived') is distinct from 'boolean' then raise exception 'VALIDATION';end if;
  update private.owner_network_cards set archived_at=case when (p_data->>'archived')::boolean then clock_timestamp() end where organization_id=p_org and contact_id=c.id and id=(p_data->>'file')::uuid and status='ready' returning * into f;
  if not found then raise exception 'NOT_FOUND';end if;
  r:=jsonb_build_object('organization',p_org,'contact',c.id,'id',f.id,'archived',(f.archived_at is not null));
 else
  if p_data->>'name' is null or length(p_data->>'name') not between 1 and 180 or p_data->>'name' ~ '[[:cntrl:]]' or p_data->>'mime' is null or p_data->>'mime' not in('image/jpeg','image/png') or coalesce((p_data->>'bytes')::integer,0) not between 8 and 4194304 or p_data->>'sha256' is null or p_data->>'sha256' !~ '^[a-f0-9]{64}$' then raise exception 'VALIDATION';end if;
  select * into f from private.owner_network_cards where organization_id=p_org and contact_id=c.id and sha256=p_data->>'sha256' and mime=p_data->>'mime' and bytes=(p_data->>'bytes')::integer;
  if not found then
   if (select count(*) from private.owner_network_cards where organization_id=p_org and contact_id=c.id)>=12 then raise exception 'CARD_LIMIT';end if;
   f.id:=gen_random_uuid();insert into private.owner_network_cards(organization_id,id,contact_id,created_by,original_name,mime,bytes,sha256,object_path) values(p_org,f.id,c.id,auth.uid(),p_data->>'name',p_data->>'mime',(p_data->>'bytes')::integer,p_data->>'sha256',p_org::text||'/'||f.id::text) returning * into f;
  end if;
  r:=jsonb_build_object('organization',p_org,'contact',c.id,'id',f.id,'path',f.object_path,'ready',f.status='ready');
 end if;
 insert into private.command_receipts values(p_org,ns,k::text,digest,r,now());return r;
end $$;

create function private.confirm_network_card(p_org uuid,p_file uuid,p_actor uuid,p_session uuid,p_mime text,p_bytes integer,p_sha text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f private.owner_network_cards;moment timestamptz:=clock_timestamp();begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.memberships m on m.user_id=u.id and m.organization_id=p_org join public.organizations o on o.id=p_org join public.entitlements e on e.organization_id=p_org and e.module='crm' and e.enabled
 where s.id=p_session and s.user_id=p_actor and (s.not_after is null or s.not_after>moment) and u.deleted_at is null and not u.is_anonymous and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=moment) and m.revoked_at is null and m.role in('owner','admin') and o.status in('setup','active')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into f from private.owner_network_cards where organization_id=p_org and id=p_file for update;
 if not found or f.mime is distinct from p_mime or f.bytes is distinct from p_bytes or f.sha256 is distinct from p_sha or not exists(select 1 from storage.objects where bucket_id='ynsg-customer-files' and name=f.object_path) then raise exception 'UNVERIFIED';end if;
 if not exists(select 1 from private.owner_network_contacts where organization_id=p_org and id=f.contact_id and archived_at is null) then raise exception 'NOT_FOUND';end if;
 if f.status<>'ready' then update private.owner_network_cards set status='ready',ready_at=moment,verified_by=p_actor where organization_id=p_org and id=p_file;end if;
 return jsonb_build_object('organization',p_org,'contact',f.contact_id,'id',p_file,'ready',true);
end $$;
create function public.owner_network_card(p_org uuid,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.owner_network_card(p_org,p_data)$$;
create function public.confirm_network_card(p_org uuid,p_file uuid,p_actor uuid,p_session uuid,p_mime text,p_bytes integer,p_sha text) returns jsonb language sql security invoker set search_path='' as $$select private.confirm_network_card(p_org,p_file,p_actor,p_session,p_mime,p_bytes,p_sha)$$;
revoke all on function private.owner_network_card(uuid,jsonb),public.owner_network_card(uuid,jsonb) from public,anon,service_role;
grant execute on function private.owner_network_card(uuid,jsonb),public.owner_network_card(uuid,jsonb) to authenticated;
revoke all on function private.confirm_network_card(uuid,uuid,uuid,uuid,text,integer,text),public.confirm_network_card(uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function private.confirm_network_card(uuid,uuid,uuid,uuid,text,integer,text),public.confirm_network_card(uuid,uuid,uuid,uuid,text,integer,text) to service_role;
