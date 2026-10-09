-- Rollback for 001_init · DESTRUCTIVE: deletes ALL registrations (production and dev).
-- Export first: node --env-file=.env.local scripts/export-registrations.mjs > backup.csv
-- (The rls_auto_enable revoke is not undone: it's Supabase's helper and should stay locked.)
drop function if exists public.rate_limit_hit(text, integer, integer);
drop table if exists public.rate_limits;
drop function if exists public.ops_summary(text);
drop function if exists public.sheet_mark_synced(uuid[]);
drop function if exists public.sheet_pending(text, integer);
drop function if exists public.email_retry_batch(text, integer);
drop function if exists public.set_email_status(uuid, text, integer);
drop function if exists public.register_attendee(text, jsonb);
drop function if exists public.registration_details(public.registrations);
drop trigger if exists registrations_set_updated_at on public.registrations;
drop function if exists public.set_updated_at();
drop table if exists public.registrations;
