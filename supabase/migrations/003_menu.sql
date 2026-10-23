-- 003_menu · ADDITIVE, live-safe (builder request 2026-10-23: meal selection at /menu)
-- New tables and functions only; registrations are read, never changed.
-- Rollback: 003_menu.down.sql (drops the menu and every meal choice).
--
-- Rules (builder decisions): a registrant finds herself by the phone number OR email she registered with;
-- one meal per person, no changes (a reset = delete her row in meal_choices, which puts the plate back).

create table public.menu_items (
  event     text not null check (event ~ '^[a-z0-9-]{1,40}$'),
  item_id   text not null check (item_id ~ '^[a-z0-9-]{1,40}$'),
  name      text not null check (char_length(name) between 2 and 60),
  position  integer not null,
  quantity  integer not null check (quantity >= 0),
  remaining integer not null,
  primary key (event, item_id),
  constraint menu_items_remaining_check check (remaining between 0 and quantity)
);

create table public.meal_choices (
  registration_id uuid primary key references public.registrations (id) on delete cascade, -- one meal per person
  event           text not null,
  item_id         text not null,
  -- Short code for the server to check against the Sheet (same unambiguous alphabet as The Awakening).
  code            text not null check (code ~ '^[2-9A-HJKMNP-Z]{4}$'),
  created_at      timestamptz not null default now(),
  foreign key (event, item_id) references public.menu_items (event, item_id),
  constraint meal_choices_event_code_key unique (event, code)
);
create index meal_choices_event_idx on public.meal_choices (event, item_id);

alter table public.menu_items enable row level security;
alter table public.meal_choices enable row level security;
revoke all on table public.menu_items from anon, authenticated;
revoke all on table public.meal_choices from anon, authenticated;

-- Deleting a choice (an admin reset, or its registration being deleted) puts the plate back.
create function public.meal_choice_returned() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.menu_items set remaining = remaining + 1
   where event = old.event and item_id = old.item_id and remaining < quantity;
  return old;
end $$;

create trigger meal_choices_return_plate
  after delete on public.meal_choices
  for each row execute function public.meal_choice_returned();

-- The menu as listed by the church, for production and for dev/preview testing.
insert into public.menu_items (event, item_id, name, position, quantity, remaining)
select e.event, m.item_id, m.name, m.position, m.quantity, m.quantity
  from (values ('wives-hangout-2026'), ('wives-hangout-2026-dev')) as e(event)
 cross join (values
   ('ofada-rice-sauce',       'Ofada rice and Ofada sauce',     1, 10),
   ('spaghetti-bolognese',    'Spaghetti bolognese',            2, 20),
   ('poundo-yam-egusi',       'Poundo yam and egusi',           3, 20),
   ('native-spaghetti',       'Native spaghetti',               4, 10),
   ('asun-rice',              'Asun rice',                      5, 10),
   ('singaporean-noodles',    'Singaporean noodles',            6, 20),
   ('ewa-agoyin-plantain',    'Ewa agoyin and plantain',        7, 10),
   ('fried-rice',             'Fried rice',                     8, 10),
   ('coconut-chicken-rice',   'Coconut chicken sauce and rice', 9, 10),
   ('native-jollof-rice',     'Native jollof rice',            10, 10),
   ('white-rice-ofada-sauce', 'White rice and Ofada sauce',    11, 10),
   ('jollof-rice-chicken',    'Jollof rice and chicken',       12, 75)
 ) as m(item_id, name, position, quantity);

-- The menu with live counts.
create function public.menu_status(p_event text)
returns table (item_id text, name text, quantity integer, remaining integer)
language sql stable set search_path = '' as $$
  select m.item_id, m.name, m.quantity, m.remaining
    from public.menu_items m
   where m.event = p_event
   order by m.position;
$$;

-- Finds a registrant by phone (normalised 0XXXXXXXXXX) or email (lower-cased); whichever is given.
create function public.menu_find_registrant(p_event text, p_phone text, p_email text)
returns public.registrations
language sql stable set search_path = '' as $$
  select r.*
    from public.registrations r
   where r.event = p_event
     and ((p_phone <> '' and r.phone = p_phone) or (p_email <> '' and r.email = lower(p_email)))
   order by (p_phone <> '' and r.phone = p_phone) desc
   limit 1;
$$;

-- Her existing choice, shaped for the page (null if none).
create function public.menu_choice_json(p_registration_id uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('item_id', c.item_id, 'item_name', m.name, 'code', c.code,
                            'chosen_at', to_char(c.created_at at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM'))
    from public.meal_choices c
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.registration_id = p_registration_id;
$$;

-- Lookup only: first name (to confirm it's her) and any existing choice. Never returns other details.
create function public.menu_lookup(p_event text, p_phone text, p_email text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  r public.registrations;
begin
  r := public.menu_find_registrant(p_event, coalesce(p_phone, ''), coalesce(p_email, ''));
  if r.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'found', 'full_name', r.full_name,
                            'choice', public.menu_choice_json(r.id));
end $$;

-- One round trip: find her, refuse a second choice, take one plate atomically, record it with a code.
-- Concurrent choosers of the last plate: the conditional UPDATE lets exactly one through.
create function public.choose_meal(p_event text, p_phone text, p_email text, p_item text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  r      public.registrations;
  v_code text;
  v_constraint text;
begin
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
      insert into public.meal_choices (registration_id, event, item_id, code)
      values (r.id, p_event, p_item, v_code);
      return jsonb_build_object('status', 'created', 'full_name', r.full_name,
                                'choice', public.menu_choice_json(r.id));
    exception when unique_violation then
      -- The plate decrement above is rolled back with this block.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'meal_choices_pkey' then
        -- She chose on another phone at the same instant: show that choice.
        return jsonb_build_object('status', 'already_chosen', 'full_name', r.full_name,
                                  'choice', public.menu_choice_json(r.id));
      end if;
      continue; -- code collision: try another code
    end;
  end loop;
  raise exception 'choose_meal: gave up after 8 attempts';
end $$;

-- For the Sheet's "Meals" tab (a full snapshot each sync; ~200 rows).
create function public.meal_list(p_event text)
returns table (chosen_at text, full_name text, phone text, dish text, code text)
language sql stable set search_path = '' as $$
  select to_char(c.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI:SS'),
         r.full_name, r.phone, m.name, c.code
    from public.meal_choices c
    join public.registrations r on r.id = c.registration_id
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.event = p_event
   order by m.position, r.full_name;
$$;

revoke execute on function public.meal_choice_returned()                         from public, anon, authenticated;
revoke execute on function public.menu_status(text)                              from public, anon, authenticated;
revoke execute on function public.menu_find_registrant(text, text, text)         from public, anon, authenticated;
revoke execute on function public.menu_choice_json(uuid)                         from public, anon, authenticated;
revoke execute on function public.menu_lookup(text, text, text)                  from public, anon, authenticated;
revoke execute on function public.choose_meal(text, text, text, text)            from public, anon, authenticated;
revoke execute on function public.meal_list(text)                                from public, anon, authenticated;
grant  execute on function public.menu_status(text)                              to service_role;
grant  execute on function public.menu_find_registrant(text, text, text)         to service_role;
grant  execute on function public.menu_choice_json(uuid)                         to service_role;
grant  execute on function public.menu_lookup(text, text, text)                  to service_role;
grant  execute on function public.choose_meal(text, text, text, text)            to service_role;
grant  execute on function public.meal_list(text)                                to service_role;
