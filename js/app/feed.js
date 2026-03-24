-- 1) add column
alter table public.posts
add column if not exists comments_count integer not null default 0;

-- 2) backfill existing posts
update public.posts p
set comments_count = coalesce(c.cnt, 0)
from (
  select post_id, count(*)::int as cnt
  from public.comments
  group by post_id
) c
where c.post_id = p.id;

-- 3) set zero where no comments matched in backfill
update public.posts
set comments_count = 0
where comments_count is null;

-- 4) trigger function
create or replace function public.sync_post_comments_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set comments_count = coalesce(comments_count, 0) + 1
    where id = new.post_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
    set comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
    where id = old.post_id;

    return old;
  end if;

  return null;
end;
$$;

-- 5) recreate trigger safely
drop trigger if exists trg_sync_post_comments_count_insert on public.comments;
drop trigger if exists trg_sync_post_comments_count_delete on public.comments;

create trigger trg_sync_post_comments_count_insert
after insert on public.comments
for each row
execute function public.sync_post_comments_count();

create trigger trg_sync_post_comments_count_delete
after delete on public.comments
for each row
execute function public.sync_post_comments_count();
