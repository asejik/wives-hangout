-- Rollback for 006_seat · back to 004's table numbers (meal choices and plates stay; seat numbers are cleared).
-- Push code without the seat field first (or Promote the previous deployment), then run this, then run
-- 004_table.sql again (it restores the table functions and the Sheet's meal_list).
begin;

drop function if exists public.set_meal_seat(text, text, text, text);
drop function if exists public.choose_meal(text, text, text, text, text);
drop function if exists public.meal_list(text);
alter table public.meal_choices drop constraint if exists meal_choices_seat_no_check;
update public.meal_choices set seat_no = '' where seat_no <> '';
alter table public.meal_choices rename column seat_no to table_no;
alter table public.meal_choices add constraint meal_choices_table_no_check check (table_no ~ '^([1-9][0-9]{0,2})?$');
-- menu_choice_json reads the column, so it is recreated before anything calls it.
create or replace function public.menu_choice_json(p_registration_id uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('item_id', c.item_id, 'item_name', m.name, 'code', c.code, 'table_no', c.table_no,
                            'chosen_at', to_char(c.created_at at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM'))
    from public.meal_choices c
    join public.menu_items m on m.event = c.event and m.item_id = c.item_id
   where c.registration_id = p_registration_id;
$$;
drop function if exists public.valid_seat(text);

commit;

