-- Rollback for 005_pineapple_fried_rice · drops Pineapple Fried Rice from menu_items and any meal choices.
do $$
begin
  if exists (select 1 from pg_tables where tablename = 'meal_choices') then
    delete from public.meal_choices where item_id = 'pineapple-fried-rice';
  end if;
  if exists (select 1 from pg_tables where tablename = 'menu_items') then
    delete from public.menu_items where item_id = 'pineapple-fried-rice';
  end if;
end $$;
