-- Rollback for 008_adjust_menu_quantities · restores original quantities
begin;

update public.menu_items
   set quantity = quantity + 10,
       remaining = remaining + 10
 where item_id = 'spaghetti-bolognese'
   and event in ('wives-hangout-2026', 'wives-hangout-2026-dev');

update public.menu_items
   set quantity = quantity - 10,
       remaining = remaining - 10
 where item_id = 'ewa-agoyin-plantain'
   and event in ('wives-hangout-2026', 'wives-hangout-2026-dev');

commit;
