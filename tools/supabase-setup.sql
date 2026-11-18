-- By the Book: shared storage for the librarian's picks and anonymous usage numbers.
-- Paste this whole file into Supabase → SQL Editor → Run. Running it again is safe.
--
-- Who can do what:
--   * Everyone (the app):   read the picks, add anonymous usage events.
--   * Signed-in librarian:   write the picks, read the usage events.
-- Turn OFF "Allow new users to sign up" in Authentication, so the only
-- signed-in user is the librarian account you create yourself.

-- The librarian's weekly picks: up to three books per week.
create table if not exists public.picks (
  id          bigint generated always as identity primary key,
  week_start  date not null,                                   -- the Sunday of that week
  position    smallint not null check (position between 1 and 3),
  book_id     text not null check (char_length(book_id) <= 80),
  note        text check (char_length(note) <= 120),          -- the handwritten note
  created_at  timestamptz not null default now(),
  unique (week_start, position)
);

-- Anonymous usage: a random id per phone (no name, no email), and what happened.
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid not null,
  kind        text not null check (kind in ('open', 'taken', 'read', 'disliked', 'rejected', 'restored', 'rated')),
  book_id     text check (char_length(book_id) <= 80),
  rating      smallint check (rating between 1 and 5)
);
create index if not exists events_created_at on public.events (created_at);

alter table public.picks  enable row level security;
alter table public.events enable row level security;

drop policy if exists "anyone reads picks"       on public.picks;
drop policy if exists "librarian writes picks"   on public.picks;
drop policy if exists "app adds events"          on public.events;
drop policy if exists "librarian reads events"   on public.events;

create policy "anyone reads picks"     on public.picks  for select to anon, authenticated using (true);
create policy "librarian writes picks" on public.picks  for all    to authenticated using (true) with check (true);
create policy "app adds events"        on public.events for insert to anon, authenticated with check (true);
create policy "librarian reads events" on public.events for select to authenticated using (true);

grant select                 on public.picks  to anon, authenticated;
grant insert, update, delete on public.picks  to authenticated;
grant insert                 on public.events to anon, authenticated;
grant select                 on public.events to authenticated;
