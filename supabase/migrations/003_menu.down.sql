-- Rollback for 003_menu · DESTRUCTIVE: drops the menu and every meal choice. Registrations are untouched.
-- Also removes 004_table's and 006_seat's functions if present (the whole menu feature goes).
drop function if exists public.set_meal_seat(text, text, text, text);
drop function if exists public.valid_seat(text);
drop function if exists public.set_meal_table(text, text, text, text);
drop function if exists public.choose_meal(text, text, text, text, text);
drop function if exists public.meal_list(text);
drop function if exists public.choose_meal(text, text, text, text);
drop function if exists public.menu_lookup(text, text, text);
drop function if exists public.menu_choice_json(uuid);
drop function if exists public.menu_find_registrant(text, text, text);
drop function if exists public.menu_status(text);
drop trigger if exists meal_choices_return_plate on public.meal_choices;
drop table if exists public.meal_choices;
drop function if exists public.meal_choice_returned();
drop table if exists public.menu_items;
