set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.publish_hourly_quote('20000000-0000-4000-8000-000000000001',(select id from public.service_requests),(select revision from public.service_requests),'Synthetic agreed four-hour leaf management',240,false,false,null,'window-price-key-01');
select public.approve_quote('20000000-0000-4000-8000-000000000001',(select id from public.quotes),1,'Synthetic agreement to four hours, local test only');
do $$begin begin
 perform public.job_action('20000000-0000-4000-8000-000000000001',(select id from public.jobs),1,'start','Synthetic work','window-start-key-01');
 raise exception 'TEST FAILED: undersized calendar window allowed start';
 exception when raise_exception then if sqlerrm<>'WORK_WINDOW_TOO_SHORT' then raise;end if;end;
end$$;
reset role;
select pg_temp.assert_true((select count(*)=0 from public.work_sessions),'failed start creates no timer');
select pg_temp.assert_true((select status='approved' and revision=1 from public.jobs),'failed start preserves job and agreement');
select pg_temp.assert_true((select count(*)=1 from public.appointments where status='reserved'),'existing visit retained for replacement review');
set constraints all immediate;
rollback;
