-- 001_init · ADDITIVE (new tables and functions on an empty database)
-- Wives Hangout registration. Merges The Awakening's migrations 001–004 (no raffle code).
-- Run once in the Supabase SQL editor of the `wives-hangout` project.
-- Rollback: 001_init.down.sql (DESTRUCTIVE).
--
-- ONE database serves production and dev/preview; rows are kept apart by `event`
-- (wives-hangout-2026 vs wives-hangout-2026-dev). Every function takes the event explicitly.

create table public.registrations (
  id                uuid primary key default gen_random_uuid(),
  event             text not null check (event ~ '^[a-z0-9-]{1,40}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  full_name         text not null check (char_length(full_name) between 2 and 80),
  years_married     integer not null check (years_married between 0 and 80),
  phone             text not null check (phone ~ '^0[789][01][0-9]{8}$'),
  email             text not null check (email = lower(email) and char_length(email) <= 120 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  church            text not null check (church in ('Citizens of Light Church', 'Other')),
  church_other      text not null default '' check (char_length(church_other) <= 80),
  heard_via         text not null check (heard_via in ('WhatsApp', 'Instagram/Facebook', 'A friend or family member', 'Church announcement', 'Flyer', 'Other')),
  heard_other       text not null default '' check (char_length(heard_other) <= 60),
  bringing_child    boolean not null,
  consent_at        timestamptz not null,
  source            text not null default '' check (char_length(source) <= 40),
  email_status      text not null default 'PENDING' check (email_status in ('PENDING', 'SENT', 'FAILED', 'LOGGED')),
  email_attempts    integer not null default 0,
  emailed_at        timestamptz,
  last_resend_at    timestamptz,
  retry_claimed_at  timestamptz,
  -- Set when Gmail reports its daily sending limit: retry after this, without using up an attempt.
  retry_not_before  timestamptz,
  sheet_synced_at   timestamptz,
  constraint registrations_event_phone_key unique (event, phone),
  constraint registrations_event_email_key unique (event, email),
  constraint registrations_church_other_required check (church <> 'Other' or char_length(church_other) >= 2),
  constraint registrations_heard_other_required  check (heard_via <> 'Other' or char_length(heard_other) >= 2)
);

create index registrations_sheet_pending_idx on public.registrations (event, created_at) where sheet_synced_at is null;
create index registrations_email_status_idx on public.registrations (event, email_status);

-- Locked down: only the server (secret / service_role key) may touch this table.
alter table public.registrations enable row level security;
revoke all on table public.registrations from anon, authenticated;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger registrations_set_updated_at
  before update on public.registrations
  for each row execute function public.set_updated_at();

-- The fields the confirmation email needs (also used for re-sends and retries).
create function public.registration_details(r public.registrations) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'full_name', r.full_name, 'years_married', r.years_married, 'phone', r.phone, 'email', r.email,
    'church', r.church, 'church_other', r.church_other, 'heard_via', r.heard_via,
    'heard_other', r.heard_other, 'bringing_child', r.bringing_child);
$$;

-- One round trip per registration. Uniqueness comes from the constraints above, so
-- simultaneous submits are safe without any application lock.
create function public.register_attendee(p_event text, p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_existing public.registrations%rowtype;
  v_resend   boolean;
  v_id       uuid;
begin
  for attempt in 1..3 loop
    select * into v_existing
      from public.registrations
     where event = p_event and (phone = p->>'phone' or email = lower(p->>'email'))
     limit 1;

    if found then
      -- At most one re-send per 10 minutes (atomic). Details go to the server only, never the browser.
      update public.registrations
         set last_resend_at = now()
       where id = v_existing.id
         and (last_resend_at is null or last_resend_at < now() - interval '10 minutes')
      returning true into v_resend;
      return jsonb_build_object(
        'status', 'duplicate', 'id', v_existing.id, 'resend', coalesce(v_resend, false),
        'details', public.registration_details(v_existing));
    end if;

    begin
      insert into public.registrations (
        event, full_name, years_married, phone, email, church, church_other,
        heard_via, heard_other, bringing_child, consent_at, source, last_resend_at)
      values (
        p_event, p->>'full_name', (p->>'years_married')::integer, p->>'phone', lower(p->>'email'),
        p->>'church', coalesce(p->>'church_other', ''), p->>'heard_via', coalesce(p->>'heard_other', ''),
        (p->>'bringing_child')::boolean, now(), coalesce(p->>'source', ''),
        now()) -- no re-send within 10 minutes of the first email
      returning id into v_id;
      return jsonb_build_object('status', 'created', 'id', v_id);
    exception when unique_violation then
      -- Phone/email race: the next pass finds the winner's row.
      continue;
    end;
  end loop;
  raise exception 'register_attendee: gave up after 3 attempts';
end $$;

-- p_defer_minutes > 0: Gmail's daily limit was hit. Keep FAILED, don't count the attempt, retry later.
create function public.set_email_status(p_id uuid, p_status text, p_defer_minutes integer default 0) returns void
language sql set search_path = '' as $$
  update public.registrations
     set email_status = p_status,
         email_attempts = email_attempts + case when p_defer_minutes > 0 then 0 else 1 end,
         retry_not_before = case when p_defer_minutes > 0 then now() + make_interval(mins => p_defer_minutes) else null end,
         emailed_at = case when p_status = 'SENT' then now() else emailed_at end
   where id = p_id;
$$;

-- Claims rows so overlapping retry runs can't double-send.
create function public.email_retry_batch(p_event text, p_limit integer default 10)
returns table (id uuid, details jsonb)
language sql set search_path = '' as $$
  with picked as (
    select r.id
      from public.registrations r
     where r.event = p_event
       and r.email_attempts < 5
       and (r.email_status = 'FAILED'
            or (r.email_status = 'PENDING' and r.created_at < now() - interval '10 minutes'))
       and (r.retry_claimed_at is null or r.retry_claimed_at < now() - interval '5 minutes')
       and (r.retry_not_before is null or r.retry_not_before <= now())
     order by r.created_at
     limit p_limit
     for update skip locked)
  update public.registrations r
     set retry_claimed_at = now()
    from picked
   where r.id = picked.id
  returning r.id, public.registration_details(r);
$$;

-- Rows not yet copied to the Google Sheet, shaped like the Sheet's columns.
create function public.sheet_pending(p_event text, p_limit integer default 500)
returns table (
  id uuid, created_at text, full_name text, years_married integer, phone text, email text,
  church text, church_other text, heard_via text, heard_other text, bringing_child text,
  consent_at text, source text)
language sql set search_path = '' as $$
  select r.id,
         to_char(r.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI:SS'),
         r.full_name, r.years_married, r.phone, r.email,
         r.church, r.church_other, r.heard_via, r.heard_other,
         case when r.bringing_child then 'Yes' else 'No' end,
         to_char(r.consent_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI:SS'),
         r.source
    from public.registrations r
   where r.event = p_event and r.sheet_synced_at is null
   order by r.created_at
   limit p_limit;
$$;

create function public.sheet_mark_synced(p_ids uuid[]) returns integer
language sql set search_path = '' as $$
  with done as (
    update public.registrations set sheet_synced_at = now()
     where id = any(p_ids) and sheet_synced_at is null
    returning 1)
  select count(*)::integer from done;
$$;

-- Counts for the Apps Script alerts and daily summary.
create function public.ops_summary(p_event text) returns jsonb
language sql set search_path = '' as $$
  select jsonb_build_object(
    'total',            count(*),
    'bringing_child',   count(*) filter (where bringing_child),
    'last_hour',        count(*) filter (where created_at > now() - interval '1 hour'),
    'last_24h',         count(*) filter (where created_at > now() - interval '24 hours'),
    'unsynced',         count(*) filter (where sheet_synced_at is null),
    'unsynced_oldest_minutes',
      coalesce(floor(extract(epoch from now() - min(created_at) filter (where sheet_synced_at is null)) / 60)::int, 0),
    'pending_stale',    count(*) filter (where email_status = 'PENDING' and created_at < now() - interval '10 minutes'),
    'failed',           count(*) filter (where email_status = 'FAILED' and email_attempts < 5),
    'deferred',         count(*) filter (where email_status = 'FAILED' and retry_not_before > now()),
    'exhausted',        count(*) filter (where email_status = 'FAILED' and email_attempts >= 5),
    'logged',           count(*) filter (where email_status = 'LOGGED'),
    'sent',             count(*) filter (where email_status = 'SENT'))
  from public.registrations
  where event = p_event;
$$;

-- Per-network attempt limit for /api/register.
-- key = sha256(secret-salted client IP), computed in api/; raw IPs are never stored.
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

-- Counts one attempt; returns true while the key is within p_max per fixed window.
create function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  -- Occasional housekeeping keeps the table tiny.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;

-- Supabase grants EXECUTE to anon/authenticated by default; take it back.
revoke execute on function public.set_updated_at()                              from public, anon, authenticated;
revoke execute on function public.registration_details(public.registrations)    from public, anon, authenticated;
revoke execute on function public.register_attendee(text, jsonb)               from public, anon, authenticated;
revoke execute on function public.set_email_status(uuid, text, integer)         from public, anon, authenticated;
revoke execute on function public.email_retry_batch(text, integer)              from public, anon, authenticated;
revoke execute on function public.sheet_pending(text, integer)                  from public, anon, authenticated;
revoke execute on function public.sheet_mark_synced(uuid[])                     from public, anon, authenticated;
revoke execute on function public.ops_summary(text)                             from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, integer, integer)        from public, anon, authenticated;
grant  execute on function public.registration_details(public.registrations)    to service_role;
grant  execute on function public.register_attendee(text, jsonb)               to service_role;
grant  execute on function public.set_email_status(uuid, text, integer)         to service_role;
grant  execute on function public.email_retry_batch(text, integer)              to service_role;
grant  execute on function public.sheet_pending(text, integer)                  to service_role;
grant  execute on function public.sheet_mark_synced(uuid[])                     to service_role;
grant  execute on function public.ops_summary(text)                             to service_role;
grant  execute on function public.rate_limit_hit(text, integer, integer)        to service_role;

-- Supabase's own SECURITY DEFINER helper for "automatic RLS" is executable by anon/authenticated
-- via /rest/v1/rpc (Security Advisor warning). Event triggers don't need the caller's EXECUTE.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
