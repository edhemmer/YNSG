# Restored private-file catalog reconciliation

Advances WEB-12 / #37. The encrypted bundle authenticates every listed object, but a valid bundle can still omit a canonical ready file. Recovery now has an independent completeness check against the database actually restored from its dump.

## Scope checklist

- Compare every ready file across all organizations, including exact organization, ID, object path, byte length, MIME and SHA-256. Order does not matter; duplicates, omissions, extra entries and same-count substitutions fail.
- Count pending uploads separately. Pending metadata is retained in the database, but is not a ready object or a promised recovered upload. This check does not certify pending/orphan storage object recovery.
- Use one read-only SQL statement so counts and rows share a snapshot. Never silently truncate: the query includes up to 10,001 rows, while validation permits at most 10,000 and requires the full ready count to match. Evidence JSON has a 4 MiB ceiling, matching the bundle manifest limit.
- Require private regular evidence files, bounded reads and no symlink paths. Independently hash and check recovered image bytes after catalog comparison. Return counts only; failures emit no customer metadata or paths.
- Run only isolated synthetic checks during engineering. No production extraction, credential access, database migration, activation, messaging, public/practice UI change, fee, provider or business-rule change.

## Prepared operator procedure

Use only an authorized isolated restored database with application workers disabled and live outbound credentials removed. Do not point this procedure at production or a running restored app. The operator must independently verify the database target and the origin of the restored dump. The checker accepts supplied evidence; it cannot authenticate a database connection or prove source snapshot consistency.

1. Restore the authenticated recovered custom dump using the restricted recovery runbook. Keep the recovered manifest and object bytes private.
2. In a private working directory, run the following with `psql` already configured for that isolated database. `umask 077` protects new evidence; choose a new catalog path and use shell noclobber to avoid replacing prior evidence. No password or database URL belongs in command arguments or chat.

```sh
umask 077
set -C
psql -X -q -A -t -v ON_ERROR_STOP=1 -f scripts/recovery-file-catalog.sql > /private/recovery/new-restored-catalog.json
node scripts/verify-recovery-catalog.mjs /private/recovery/new-restored-catalog.json /private/recovery/verified/manifest.json /private/recovery/verified/files
```

3. Require both commands to succeed. A failed export can leave a partial evidence file; its existence is not success. Preserve it for restricted review and use a new path for a deliberate retry. Verification failures keep the recovery isolated; never repair discrepancies by editing canonical metadata or omitting rows.
4. Success returns `ok`, `verified` and `pendingExcluded` counts. It does not start an app, import a database, delete anything, upload files or send a message. It proves agreement of the supplied catalog, manifest and bytes, not their independent provenance or operational acceptance.

## Executed engineering checks and remaining gates

Tests exercise multi-organization same-ID files, ordering, empty ready sets, pending counts, omitted/extra/substituted objects, digest/size/type/path differences, invalid counts/schema, corrupt recovered bytes and unsafe evidence inputs. Native PostgreSQL CI executes the actual catalog SQL against the isolated database restored from the encrypted synthetic dump, runs the byte checker and deliberately rejects an otherwise valid incomplete manifest and same-count digest change. Existing financial, file-link, scheduling, capacity and ledger restore comparisons remain required.

Consistent authorized source extraction, off-provider destination, operator, retention, key custody, RPO/RTO, scheduling, received failure alerts and a restricted actual restore remain open. Full WEB-12 acceptance and independent human security review are not inferred from these tests.
