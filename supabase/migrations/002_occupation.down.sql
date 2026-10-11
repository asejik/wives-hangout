-- Rollback for 002_occupation · DESTRUCTIVE for occupations: drops the column and every occupation collected.
-- Deploy code WITHOUT the occupation field first (or Promote the previous deployment), then run this.
-- Restores 001's functions exactly.

create or replace function public.registration_details(r public.registrations) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'full_name', r.full_name, 'years_married', r.years_married, 'phone', r.phone, 'email', r.email,
    'church', r.church, 'church_other', r.church_other, 'heard_via', r.heard_via,
    'heard_other', r.heard_other, 'bringing_child', r.bringing_child);
$$;

create or replace function public.register_attendee(p_event text, p jsonb) returns jsonb
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

drop function if exists public.sheet_pending(text, integer);
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

alter table public.registrations drop column if exists occupation;

revoke execute on function public.registration_details(public.registrations) from public, anon, authenticated;
revoke execute on function public.register_attendee(text, jsonb)            from public, anon, authenticated;
revoke execute on function public.sheet_pending(text, integer)               from public, anon, authenticated;
grant  execute on function public.registration_details(public.registrations) to service_role;
grant  execute on function public.register_attendee(text, jsonb)            to service_role;
grant  execute on function public.sheet_pending(text, integer)               to service_role;
