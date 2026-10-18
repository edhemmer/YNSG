# Encrypted offline database and file recovery bundle

Advances WEB-12 and issue #37. This operator tool packages an already-authorized custom-format PostgreSQL dump plus a private-file manifest and its actual bytes. It opens no network connection, reads no database credentials, schedules no job and never executes a dump, starts a restored app or sends a message. Live source extraction, a consistent DB/object snapshot, off-provider destination, retention, key custody, alert recipient, RPO/RTO and operator acceptance remain separate requirements. WEB-12 is not accepted by this component.

## Scope and constraint checklist

- Preserve approved public copy, brand, services, rates, optional accounts and existing workflows. No practice-workspace expansion, Stripe/model/paid activation or required MFA.
- Use isolated synthetic fixtures only. No production customer dump, photo, financial record or credential is used for engineering QA.
- Stream the database and encrypted output; bound manifest/header to 4 MiB, 10,000 files, each image to 8 MiB and total content to 32 GiB. Larger sets fail explicitly. Supported input is a custom-format dump (PGDMP marker) and the existing `ynsg-customer-file-backup-v1` manifest with exact UUID paths, MIME, bytes and SHA-256. Marker/hash checks alone do not prove a usable database restore.
- Use Node's AES-256-GCM with a random 96-bit nonce, 128-bit tag and authenticated version/nonce prefix. A fresh nonce is generated for every bundle; contents/paths remain encrypted. Keys are exactly 32 random bytes in a separate private file; never place a key in chat, Git, command arguments as raw content or the backup bundle.
- Require real regular inputs, refuse symlinks and require private key/destination permissions. Outputs use mode 0600, recovery directories 0700. Do not overwrite keys, bundles or existing recovery directories. Stage encrypted creation privately and publish using an exclusive hard link on the same filesystem only after source hash/size validation and sync.
- Authenticate the whole encrypted payload before parsing its metadata. Recover into a new private directory, verify hashes, sizes, allowed paths and image signatures, then publish its `verified` child. Normal failure removes owned staging; a killed process may leave private hidden staging that the operator must review. Do not treat existence of a partial file/directory as success. On an uncertain filesystem result, inspect the destination before retrying; no blind overwrite.
- Preserve source files. Recovery produces files for independent review and an isolated restore; it never connects to production or enables workers. Do not start a restored application with live credentials. Authorized database import, revoked outbound credentials and ledger/permission checks remain deliberate operator steps.
- Test wrong keys, ciphertext/header/tag tampering, truncation, bad digest, duplicates/traversal, symlinks, non-private keys and existing destinations. Native PostgreSQL CI must package a real synthetic pg_dump plus every ready fixture file, decrypt, compare every object byte, pg_restore into a second isolated database and compare financial/scheduling/file snapshots and balanced ledger.

## Operator commands (not activation)

Requires Node.js 20+ on a private POSIX filesystem supporting exclusive hard links; the tool uses only built-in modules and works without a package install. Prepare a private directory on an operator-approved filesystem before use. The paths below are examples, not selected production destinations. A backup key must have a separately controlled recovery copy before relying on a backup; losing it loses access to the bundle. Never commit any generated key, dump, manifest, bundle or recovered output.

```sh
node scripts/recovery-bundle.mjs keygen /private/keys/ynsg-recovery.key
node scripts/recovery-bundle.mjs pack /private/keys/ynsg-recovery.key /private/export/database.dump /private/export/manifest.json /private/export/files /private/backups/recovery.ynsg FULL_SOURCE_COMMIT_SHA
node scripts/recovery-bundle.mjs unpack /private/keys/ynsg-recovery.key /private/backups/recovery.ynsg /private/recovery/new-isolated-directory
```

Each parent directory must exist with no group/other permissions. Key/bundle files and the unpack destination must not already exist. A successful unpack produces `verified/database.dump`, `verified/files/<organization>/<file>`, `verified/manifest.json` and `verified/recovery.json`. JSON command output contains only counts, sizes and the supplied source commit; no key, file path, customer name or source data is logged. The commit is an operator-supplied provenance label, not independent proof of export origin or snapshot consistency.

The recovered manifest also works with the existing `verify-customer-file-restore.mjs` checker; native CI runs that independent checker before importing the dump.

The manifest records only `format` and `files`; each file has `organization`, `id`, `path`, `bytes`, `mime`, `sha256`. Its list must come from the same authorized snapshot as the dump and be reconciled against canonical ready-file rows. An empty list is valid only when actual source evidence proves no ready objects; the tool does not infer completeness of a provided manifest.

## Format and independent checks

Encrypted file: 8-byte ASCII `YNSGREC1`, 12-byte nonce, AES-256-GCM ciphertext, 16-byte authentication tag. The 20-byte prefix is authenticated additional data. Plaintext: 4-byte big-endian JSON-header length, strict versioned JSON header, exact database bytes, then exact image bytes in manifest order; trailing/missing bytes are rejected. The header records creation time, source commit label, database bytes/hash and canonical file manifest. Recovery verifies GCM before header parsing, then strict bounds and exact length/hash/signatures before exposing `verified`.

Official implementation reference checked October 18, 2026: https://nodejs.org/api/crypto.html (createCipheriv/createDecipheriv, setAAD, getAuthTag/setAuthTag and final verification). This is engineering evidence, not an independent human cryptographic/security review or an accepted production disaster-recovery rehearsal. Release PR records executed checks, source mapping and remaining gate work.
