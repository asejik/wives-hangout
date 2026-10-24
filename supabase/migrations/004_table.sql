-- 004_table · ADDITIVE, live-safe (builder request 2026-10-24: table number with each meal choice)
-- Run in the Supabase SQL editor BEFORE pushing the code that sends the table number.
-- Rollback: 004_table.down.sql (drops table numbers; meal choices stay).
--
-- Safe in both orders: the old 4-argument choose_meal keeps working (table_no = ''), so the live page
-- is unaffected until the new code is pushed. Choices made before this keep table_no = '' and the page
-- prompts her to add it. Table numbers are plain numbers ("1", "14"); many people share a table.

alter table public.meal_choices
  add column if not exists table_no text not null default '' check (table_no ~ '^([1-9][0-9]{0,2})?$');

-- Her choice for the page, now with the table (same signature: grants kept).
create or replace function public.menu_choice_json(p_registration_id uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('item_id', c.item_id, 'item_name', m.name, 'code', c.code, 'table_no', c.table_no,
                            'chosen_at', to_char(c.created_at at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM'))
    from public.meal_choices c
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.registration_id = p_registration_id;
$$;

-- choose_meal with the table number (required by the page). Same logic as 003's version.
create or replace function public.choose_meal(p_event text, p_phone text, p_email text, p_item text, p_table text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  r      public.registrations;
  v_code text;
  v_constraint text;
begin
  if coalesce(p_table, '') !~ '^[1-9][0-9]{0,2}$' then
    return jsonb_build_object('status', 'invalid_table');
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
      insert into public.meal_choices (registration_id, event, item_id, code, table_no)
      values (r.id, p_event, p_item, v_code, p_table);
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

-- Add or correct the table number on her existing choice (the meal itself never changes).
create function public.set_meal_table(p_event text, p_phone text, p_email text, p_table text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  r public.registrations;
begin
  if coalesce(p_table, '') !~ '^[1-9][0-9]{0,2}$' then
    return jsonb_build_object('status', 'invalid_table');
  end if;
  r := public.menu_find_registrant(p_event, coalesce(p_phone, ''), coalesce(p_email, ''));
  if r.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  update public.meal_choices set table_no = p_table where registration_id = r.id and event = p_event;
  if not found then
    return jsonb_build_object('status', 'no_choice');
  end if;
  return jsonb_build_object('status', 'updated', 'full_name', r.full_name, 'choice', public.menu_choice_json(r.id));
end $$;

-- The Sheet's "Meals" tab, now with the table, sorted by table so servers can work table by table.
-- The return shape changes, so the function is dropped and recreated (grants re-applied below).
drop function if exists public.meal_list(text);
create function public.meal_list(p_event text)
returns table (table_no text, full_name text, dish text, code text, phone text, chosen_at text)
language sql stable set search_path = '' as $$
  select c.table_no, r.full_name, m.name, c.code, r.phone,
         to_char(c.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI:SS')
    from public.meal_choices c
    join public.registrations r on r.id = c.registration_id
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.event = p_event
   order by nullif(c.table_no, '')::integer nulls last, r.full_name;
$$;

revoke execute on function public.menu_choice_json(uuid)                    from public, anon, authenticated;
revoke execute on function public.choose_meal(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.set_meal_table(text, text, text, text)    from public, anon, authenticated;
revoke execute on function public.meal_list(text)                           from public, anon, authenticated;
grant  execute on function public.menu_choice_json(uuid)                    to service_role;
grant  execute on function public.choose_meal(text, text, text, text, text) to service_role;
grant  execute on function public.set_meal_table(text, text, text, text)    to service_role;
grant  execute on function public.meal_list(text)                           to service_role;
