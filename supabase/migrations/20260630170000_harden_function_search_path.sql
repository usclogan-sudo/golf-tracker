-- Security hardening: pin search_path on every public function that lacks it.
--
-- A SECURITY DEFINER function with an unpinned search_path runs with the caller's
-- search_path, so an unqualified reference (e.g. `rounds`) could be resolved to an
-- attacker-controlled object earlier in their path. Pinning to `public, pg_temp`
-- closes that vector while keeping the existing unqualified references to public
-- objects working (no function body changes). pg_temp is listed LAST so a caller's
-- temp objects can't shadow real ones. anon/authenticated cannot create objects in
-- public, so `public` first is safe here.
--
-- Idempotent: only touches functions that don't already have a search_path set, via
-- ALTER FUNCTION (config only) — bodies are untouched. Clears the Supabase advisor
-- `function_search_path_mutable` lint.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'  -- plain functions only (skip procedures/aggregates/window)
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;
