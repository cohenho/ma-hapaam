create or replace function public.top_rated_books(min_count int default 2, max_rows int default 5)
returns table (book_id text, avg_rating numeric, ratings bigint)
language sql
security definer
set search_path = public
as $$
  select book_id, round(avg(rating)::numeric, 1), count(*)
  from (
    select distinct on (user_id, book_id) user_id, book_id, rating
    from events
    where kind = 'rated' and rating is not null and book_id is not null
    order by user_id, book_id, created_at desc
  ) latest
  group by book_id
  having count(*) >= min_count
  order by avg(rating) desc, count(*) desc
  limit max_rows;
$$;

grant execute on function public.top_rated_books(int, int) to anon, authenticated;
