-- Intentionally no browser exposure. Explicit deny policies make the posture visible to advisors.
create policy command_receipts_deny on private.command_receipts for all to anon,authenticated using(false) with check(false);
create policy intake_throttles_deny on private.intake_throttles for all to anon,authenticated using(false) with check(false);
create policy availability_exceptions_deny on public.availability_exceptions for all to anon,authenticated using(false) with check(false);
create policy schedule_holds_deny on public.schedule_holds for all to anon,authenticated using(false) with check(false);
