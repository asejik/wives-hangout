-- 005_pineapple_fried_rice · ADDITIVE, live-safe (builder request 2026-10-24: additional menu item)
-- Run in the Supabase SQL editor to add Pineapple Fried Rice (10 plates) to the menu.
-- Rollback: 005_pineapple_fried_rice.down.sql
--
-- Safe on a running database: existing registrations and meal choices are untouched.
-- Adds 10 plates of Pineapple Fried Rice to both production and dev slugs.

insert into public.menu_items (event, item_id, name, position, quantity, remaining)
select e.event, 'pineapple-fried-rice', 'Pineapple Fried Rice', 13, 10, 10
  from (values ('wives-hangout-2026'), ('wives-hangout-2026-dev')) as e(event)
on conflict (event, item_id) do nothing;
