-- Rollback for 004_table · drops table numbers (meal choices and plates stay). Push code without the table
-- field first (or Promote the previous deployment), then run this. Restores 003's functions.
drop function if exists public.set_meal_table(text, text, text, text);
drop function if exists public.choose_meal(text, text, text, text, text);

create or replace function public.menu_choice_json(p_registration_id uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('item_id', c.item_id, 'item_name', m.name, 'code', c.code,
                            'chosen_at', to_char(c.created_at at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM'))
    from public.meal_choices c
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.registration_id = p_registration_id;
$$;

drop function if exists public.meal_list(text);
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

alter table public.meal_choices drop column if exists table_no;

revoke execute on function public.menu_choice_json(uuid) from public, anon, authenticated;
revoke execute on function public.meal_list(text)        from public, anon, authenticated;
grant  execute on function public.menu_choice_json(uuid) to service_role;
grant  execute on function public.meal_list(text)        to service_role;
