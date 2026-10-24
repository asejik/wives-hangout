-- Rollback for 007_seat_unique · drops unique index and restores 006 functions without seat uniqueness.
begin;

drop index if exists public.meal_choices_event_seat_no_idx;

create or replace function public.choose_meal(p_event text, p_phone text, p_email text, p_item text, p_seat text) returns jsonb
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

create or replace function public.set_meal_seat(p_event text, p_phone text, p_email text, p_seat text) returns jsonb
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

revoke execute on function public.choose_meal(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.set_meal_seat(text, text, text, text)     from public, anon, authenticated;
grant  execute on function public.choose_meal(text, text, text, text, text) to service_role;
grant  execute on function public.set_meal_seat(text, text, text, text)     to service_role;

commit;
