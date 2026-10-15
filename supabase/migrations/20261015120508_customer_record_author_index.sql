-- Cover the immutable history author foreign key without changing history or access.
create index customer_record_changes_author on private.customer_record_changes(actor_id);
