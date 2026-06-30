# Legacy SQL (archived)

These are the original hand-run schema/migration scripts that built the
production database incrementally (applied manually via the Supabase SQL
editor over the course of development).

They are **superseded** by the CLI-tracked baseline at
`supabase/migrations/20260630120000_baseline_remote_schema.sql`, which is an
authoritative `pg_dump` of the live production schema and is what Supabase
branching replays onto preview branches.

Kept for historical reference only. Do not run these against the database.
