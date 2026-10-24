-- 008_adjust_menu_quantities · live-safe (builder request 2026-10-24: rebalance menu quantities)
-- Reduces Spaghetti bolognese starting quantity from 20 to 10 (-10 plates).
-- Increases Ewa agoyin and plantain starting quantity from 10 to 20 (+10 plates).
-- Total plates across all 13 dishes remains 225. Existing choices remain untouched.
-- Rollback: 008_adjust_menu_quantities.down.sql

begin;

update public.menu_items
   set quantity = quantity - 10,
       remaining = remaining - 10
 where item_id = 'spaghetti-bolognese'
   and event in ('wives-hangout-2026', 'wives-hangout-2026-dev');

update public.menu_items
   set quantity = quantity + 10,
       remaining = remaining + 10
 where item_id = 'ewa-agoyin-plantain'
   and event in ('wives-hangout-2026', 'wives-hangout-2026-dev');

commit;
