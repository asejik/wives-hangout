-- 006_seat · live-safe (builder request 2026-10-24: SEAT number with each meal; not everyone has a table)
-- Run in the Supabase SQL editor BEFORE pushing the code that sends the seat number.
-- Rollback: 006_seat.down.sql (back to 004's table numbers; meal choices stay).
--
-- Turns 004's unused table number into a seat number: renames the column, and replaces the 5-argument
-- choose_meal and set_meal_table with seat versions. Safe in both orders: the old 4-argument choose_meal
-- keeps working (seat_no = ''), so the live page is unaffected until the new code is pushed.
-- Seats are short labels with a digit, upper case, no spaces: "27", "B12", "12A".
-- One transaction: the column and the functions that read it change together.

begin;

alter table public.meal_choices rename column table_no to seat_no;
alter table public.meal_choices drop constraint if exists meal_choices_table_no_check;
-- 004's table numbers were never used in production (the step was withdrawn the same morning).
update public.meal_choices set seat_no = '' where seat_no <> '';
alter table public.meal_choices add constraint meal_choices_seat_no_check
  check (seat_no = '' or (seat_no ~ '^[A-Z0-9]{1,6}$' and seat_no ~ '[0-9]'));

drop function if exists public.set_meal_table(text, text, text, text);
drop function if exists public.choose_meal(text, text, text, text, text);

-- Her choice for the page, with the seat (same signature: grants kept).
create or replace function public.menu_choice_json(p_registration_id uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('item_id', c.item_id, 'item_name', m.name, 'code', c.code, 'seat_no', c.seat_no,
                            'chosen_at', to_char(c.created_at at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM'))
    from public.meal_choices c
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.registration_id = p_registration_id;
$$;

create function public.valid_seat(p_seat text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_seat, '') ~ '^[A-Z0-9]{1,6}$' and p_seat ~ '[0-9]';
$$;

-- choose_meal with the seat number (required by the page). Same logic as 003's version.
create function public.choose_meal(p_event text, p_phone text, p_email text, p_item text, p_seat text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  r      public.registrations;
  v_code text;
  v_constraint text;
begin
  if not public.valid_seat(p_seat) then
    return jsonb_build_object('status', 'invalid_seat');
  end if;
  r := public.menu_find_registrant(p_event, coalesce(p_phone, ''), coalesce(p_email, ''));
  if r.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if exists (select 1 from public.meal_choices where registration_id = r.id) then
    return jsonb_build_object('status', 'already_chosen', 'full_name', r.full_name,
                              'choice', public.menu_choice_json(r.id));
  end if;
  if not exists (select 1 from public.menu_items where event = p_event and item_id = p_item) then
    return jsonb_build_object('status', 'unknown_item');
  end if;

  for attempt in 1..8 loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * 31)::int, 1);
    end loop;
    begin
      update public.menu_items set remaining = remaining - 1
       where event = p_event and item_id = p_item and remaining > 0;
      if not found then
        return jsonb_build_object('status', 'sold_out');
      end if;
      insert into public.meal_choices (registration_id, event, item_id, code, seat_no)
      values (r.id, p_event, p_item, v_code, p_seat);
      return jsonb_build_object('status', 'created', 'full_name', r.full_name,
                                'choice', public.menu_choice_json(r.id));
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'meal_choices_pkey' then
        return jsonb_build_object('status', 'already_chosen', 'full_name', r.full_name,
                                  'choice', public.menu_choice_json(r.id));
      end if;
      continue;
    end;
  end loop;
  raise exception 'choose_meal: gave up after 8 attempts';
end $$;

-- Add or correct the seat number on her existing choice (the meal itself never changes).
create function public.set_meal_seat(p_event text, p_phone text, p_email text, p_seat text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  r public.registrations;
begin
  if not public.valid_seat(p_seat) then
    return jsonb_build_object('status', 'invalid_seat');
  end if;
  r := public.menu_find_registrant(p_event, coalesce(p_phone, ''), coalesce(p_email, ''));
  if r.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  update public.meal_choices set seat_no = p_seat where registration_id = r.id and event = p_event;
  if not found then
    return jsonb_build_object('status', 'no_choice');
  end if;
  return jsonb_build_object('status', 'updated', 'full_name', r.full_name, 'choice', public.menu_choice_json(r.id));
end $$;

-- The Sheet's "Meals" tab, sorted by seat (numbers in order: 2 before 10; no seat last).
drop function if exists public.meal_list(text);
create function public.meal_list(p_event text)
returns table (seat_no text, full_name text, dish text, code text, phone text, chosen_at text)
language sql stable set search_path = '' as $$
  select c.seat_no, r.full_name, m.name, c.code, r.phone,
         to_char(c.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI:SS')
    from public.meal_choices c
    join public.registrations r on r.id = c.registration_id
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.event = p_event
   order by c.seat_no = '', lpad(c.seat_no, 6, '0'), r.full_name;
$$;

revoke execute on function public.valid_seat(text)                          from public, anon, authenticated;
revoke execute on function public.menu_choice_json(uuid)                    from public, anon, authenticated;
revoke execute on function public.choose_meal(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.set_meal_seat(text, text, text, text)     from public, anon, authenticated;
revoke execute on function public.meal_list(text)                           from public, anon, authenticated;
grant  execute on function public.valid_seat(text)                          to service_role;
grant  execute on function public.menu_choice_json(uuid)                    to service_role;
grant  execute on function public.choose_meal(text, text, text, text, text) to service_role;
grant  execute on function public.set_meal_seat(text, text, text, text)     to service_role;
grant  execute on function public.meal_list(text)                           to service_role;

commit;
