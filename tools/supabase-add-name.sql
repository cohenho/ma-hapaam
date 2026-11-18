alter table public.events add column if not exists display_name text check (char_length(display_name) <= 40);
