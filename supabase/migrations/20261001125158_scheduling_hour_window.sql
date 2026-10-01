-- Preserve old day-based test/config versions while supporting exact hour windows.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.assert_schedule_evidence(uuid,uuid,uuid,timestamptz)'::regprocedure);
 if position('make_interval(days=>(rules->>''horizonDays'')::integer)' in definition)=0 then
  raise exception 'MIGRATION_REVIEW_REQUIRED: unexpected scheduling function';
 end if;
 definition:=replace(definition,'rules->>''horizonDays'' is null','(rules->>''horizonMinutes'' is null and rules->>''horizonDays'' is null)');
 definition:=replace(definition,'(rules->>''horizonDays'')::integer<=0','coalesce((rules->>''horizonMinutes'')::integer,(rules->>''horizonDays'')::integer*1440)<=(rules->>''leadMinutes'')::integer');
 definition:=replace(definition,'make_interval(days=>(rules->>''horizonDays'')::integer)','make_interval(mins=>coalesce((rules->>''horizonMinutes'')::integer,(rules->>''horizonDays'')::integer*1440))');
 execute definition;
end
$migration$;
