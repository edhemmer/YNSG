-- Synthetic data is rolled back and never creates a real franchise.
update public.organizations set display_name='Your Neighborhood Service Guy' where id='20000000-0000-4000-8000-000000000001';
create temporary table brand_fixture as select settings||jsonb_build_object('displayName','Your Neighborhood Service Guy','brand',jsonb_build_object('navy','#10283c','forest','#315842','gold','#edbd6b','cream','#f8f6ef','logoUrl','https://www.yourneighborhoodserviceguy.com/assets/logo.jpg','ownerName','Synthetic Local Owner')) as settings from public.configuration_versions where organization_id='20000000-0000-4000-8000-000000000001';
insert into public.configuration_versions(organization_id,version,settings) select '20000000-0000-4000-8000-000000000001',2,settings from brand_fixture;
do $$declare field text;candidate jsonb;begin
 foreach field in array array['navy','forest','gold','cream','logoUrl'] loop
  select jsonb_set(settings,array['brand',field],to_jsonb(case when field='logoUrl' then 'https://example.invalid/other.png' else '#000000' end)) into candidate from brand_fixture;
  begin insert into public.configuration_versions(organization_id,version,settings) values('20000000-0000-4000-8000-000000000001',3,candidate);raise exception 'TEST FAILED changed brand';exception when raise_exception then if sqlerrm<>'LICENSED_BRAND_PROTECTED' then raise;end if;end;
 end loop;
 begin insert into public.configuration_versions(organization_id,version,settings) select '20000000-0000-4000-8000-000000000001',3,jsonb_set(settings,'{displayName}','"Other Brand"') from brand_fixture;raise exception 'TEST FAILED brand rename';exception when raise_exception then if sqlerrm<>'LICENSED_BRAND_PROTECTED' then raise;end if;end;
end $$;
insert into public.configuration_versions(organization_id,version,settings) select '20000000-0000-4000-8000-000000000001',3,jsonb_set(settings,'{brand,ownerName}','"Another Local Owner"') from brand_fixture;
select pg_temp.assert_true((select settings->'brand'->>'ownerName'='Another Local Owner' from public.configuration_versions where version=3),'local personalization remains available');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.guard_licensed_brand()','execute'),'brand trigger is not an owner API');
rollback;
