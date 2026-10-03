-- Appointment history follows explicit customer relationships, independently of job creation.
alter policy appointment_read on public.appointments using (
 private.staff(organization_id,array['owner','admin','dispatcher'])
 or exists(select 1 from public.jobs j where j.organization_id=appointments.organization_id and j.id=appointments.job_id and private.customer_allowed(j.organization_id,j.customer_id))
 or exists(select 1 from public.service_requests r where r.organization_id=appointments.organization_id and r.id=appointments.request_id and private.customer_allowed(r.organization_id,r.customer_id))
);
