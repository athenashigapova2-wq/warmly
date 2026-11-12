# Staging backup and restore drill

This runbook is NOT a record of a successful hosted restore. Record evidence below
only after executing it. The automated PGlite test covers synthetic application
data and RLS locally; its Auth schema is a stub and cannot prove Supabase login.

## Scope and prerequisites

- Source: Warmly Staging with synthetic users only, never production.
- Target: a DIFFERENT newly created empty disposable Supabase project, e.g.
  Warmly Restore Test. Do not restore over staging or production. Check costs.
- Supabase CLI, Docker and PostgreSQL `psql` installed locally. Check the CLI's
  `db dump --help`; current documentation uses `--remote=CONNECTION_STRING`,
  older CLI releases use `--db-url CONNECTION_STRING`. Use the installed syntax.
- Use Direct or Session pooler connection from Connect, not Transaction pooler.
  Keep database URLs/passwords locally. Use a password manager, not chat/GitHub.
- Configure matching extensions/Postgres compatibility. Check current official
  instructions for Auth encryption-key handling before restoring Auth data:
  https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Stop test clients during the three exports; they are separate snapshots and
  must not race writes. Record source ref, target ref, Git commit and UTC time.

## Export

Create a unique local directory under ignored `backups/`. Run
`supabase/staging-fingerprint.sql` in staging SQL Editor and save its results
locally. For this small fixture dataset it records counts, content hashes and
RLS policies. Do not use its string aggregates for a large production database.

Following the CLI documentation, export three files into that backup directory:

```text
supabase db dump --remote=SOURCE_DB_URL -f roles.sql --role-only
supabase db dump --remote=SOURCE_DB_URL -f schema.sql
supabase db dump --remote=SOURCE_DB_URL -f data.sql --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
```

`SOURCE_DB_URL` is a placeholder, not a committed value. Run commands locally;
do not paste their expanded connection strings into tickets or chat.
Check all three exit statuses. Confirm data.sql contains Auth users AND identities,
and all app tables; schema.sql must include RLS, functions, grants and sequences.
Save SHA256 hashes with `Get-FileHash`. Keep an encrypted off-machine copy with
restricted access; the dump contains authentication data even for test users.

If CLI migration history exists, export its schema/data separately per official
instructions. The manual staging bootstrap currently has no CLI ledger.

## Restore into the EMPTY target

Do not run the app bootstrap on the target first: the dump provides the schema.
Follow the official Auth encryption-root-key instructions where applicable.
After verifying target ref differs from BOTH staging and production:

```text
psql --dbname TARGET_DB_URL --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command "SET session_replication_role = replica" --file data.sql
```

Exit status must be zero. This replication setting is session-local and suppresses
restore-time triggers; normal new connections must use `origin`. If errors occur,
stop and diagnose them; do not continue with a partial restore or broadly remove
permissions. Do not seed the target to make missing records look restored.

Auth provider settings, redirect allowlists, API keys and external configuration
are not recreated by these SQL files. Configure the RESTORE project separately.
Database backups also do not contain Storage object bytes. Current app images
are inline database values; if Storage is introduced, copy objects separately
and verify object counts/checksums. Back up function code and hosting settings
through source/configuration management.

## Verify recovery before calling it successful

1. Run `staging-fingerprint.sql` on target BEFORE any login or test writes; all
   source app/Auth fingerprints, RLS flags and policy definitions must match.
2. Build a separate protected restore Preview pointing only at target with its
   own publishable key. Keep the production ref unchanged; set the staging
   allowlist ref to the restore ref only for this isolated verification build.
3. Sign in with an ORIGINAL seeded email/password. Do not create a replacement
   account or reset its password. Confirm the same user UUID/profile/history.
4. Test Alice/Ben DM, outsider denied access, private listing privacy, visitor
   denied publishing, pending university denied events, approved university
   permitted events, registration capacity and cancellation. Use ordinary user
   sessions, not admin credentials.
5. Send a NEW message after restore: its generated ID must not collide. Test
   retry idempotency. Check restored event registrations and image content.
6. If staging Google OAuth is configured, separately configure/test the restore
   callback with an invited tester. Password tests do not prove Google works.

Record measured restore duration (RTO observation), snapshot age (RPO observation),
command versions/statuses, fingerprint comparison, login/RLS outcomes and gaps.
Only then decide retention/automated schedule and a production recovery plan.
Delete the disposable target only after retaining the report and explicit owner
decision; this runbook does not automatically delete any project or backup.

## Evidence status

| Check | Status |
| --- | --- |
| Hosted staging created and populated | Pending |
| Hosted backup exported and checksummed | Pending |
| Restore into separate hosted target | Pending |
| Original Auth credentials work after restore | Pending |
| Hosted RLS and new writes verified | Pending |
| Recovery timing and off-machine copy | Pending |
