# Consistent recovery source capture

Advances WEB-12 / issue #37. `scripts/capture-recovery.mjs` takes one read-only PostgreSQL snapshot, reads the complete ready-file catalog inside that transaction, and passes the exported snapshot identity to a streaming custom-format `pg_dump`. It downloads each catalogued object, verifies its exact byte count and SHA-256, then uses the existing authenticated encrypted bundle writer. It does not restore a database, alter records, send messages, enable workers, upload data, schedule backups or select an off-provider destination.

## Pass/fail checklist

- Preserve business rules, services, prices, public copy and existing invoice/request/file evidence. No schema migration, paid activation, account permission change, production extraction or customer fixture.
- Require the same direct Supabase project for PostgreSQL and Storage. Direct host `db.<project-ref>.supabase.co`, database/user `postgres`, port 5432 and `PGSSLMODE=verify-full` are deliberate restrictions. Transaction poolers are unsupported. Existing libpq environment/credential files configure the database connection; no connection URL/password is accepted as a command argument.
- Use `psql -X -w` with no shell or startup commands. Hold a repeatable-read, read-only transaction through dump and object capture. Use its `pg_export_snapshot()` result in `pg_dump --snapshot`. Loss of that transaction, SQL failure or dump failure prevents publication. Timeout/cancellation terminates subprocesses.
- Compare catalog counts and every immutable ready-file descriptor. Pending uploads are explicitly excluded and counted. Bound catalog to 4 MiB/10,000 files, each image to 8 MiB and the encrypted payload to 32 GiB. Never silently truncate or assume an empty catalog on failure.
- Storage requests are GET-only to the selected project's fixed bucket, with redirects refused. No file-supplied URLs. Require exact bytes/digest; existing packer independently checks supported image signatures. Missing, changed or overlong bytes fail the whole capture.
- Protect staging with 0700 and files with 0600; require private real key/destination paths. Publish only an authenticated encrypted bundle using the existing exclusive, synced writer. Do not replace an earlier bundle. Remove owned plaintext staging after success or ordinary failure. Forced process/host termination can leave private staging; operators must review it. A partial file is never proof of a successful backup.
- Log counts/candidate only and generic failure. No database stderr, credentials, file paths, customer metadata or raw file bytes in status output.
- Verify with isolated synthetic application tests and native PostgreSQL capture → encrypted bundle → isolated restore. A later committed write must appear in the live fixture but be absent from the restored capture. Reconcile restored financial records, reservations and the complete private-file catalog.

## Prepared execution

Requires compatible PostgreSQL client tools, Node.js 20+, an operator-controlled private POSIX filesystem, direct database network reachability and an approved separately held encryption key. Run only from the restricted backup operator environment. Set `YNSG_BACKUP_PROJECT_REF`, libpq settings including certificate trust, and `SUPABASE_SERVICE_ROLE_KEY` through that environment's protected credential mechanism. Never place values in Git, chat, logs or command arguments. The Storage credential is server-side and must never be placed in either app.

```sh
node scripts/capture-recovery.mjs /private/keys/ynsg-recovery.key /private/backups/new-backup.ynsg FULL_RELEASE_SHA
```

Exit zero plus `ok:true` means this capture verified and published its bundle. It does not prove the selected storage is off-provider, retention/key custody, scheduled future runs, received failure alerts, recovery time or operational acceptance. Use the existing encrypted recovery and restored-catalog procedures to test an isolated restore with all live outbound credentials removed. The dump contains confidential managed auth/application records; restore target and role/extension compatibility require operator review.

The snapshot synchronizes PostgreSQL rows, not Storage internals. Ready file metadata and digests are frozen; downloads must match those exact bytes. If an object disappears or changes during capture, the run fails instead of claiming a partial backup. Pending/orphan object recovery remains outside this ready-file contract.

References: https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION and https://www.postgresql.org/docs/17/app-pgdump.html .

No production capture or credential access was performed during engineering. Custodian, destination, retention, key custody, approved recovery targets, scheduled execution and received alerts remain explicit WEB-12/13 operator decisions and acceptance.
