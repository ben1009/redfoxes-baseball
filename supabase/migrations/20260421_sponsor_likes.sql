create table if not exists public.sponsor_like_counter (
  id text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.sponsor_like_counter (id, count)
values ('global', 0)
on conflict (id) do nothing;

alter table public.sponsor_like_counter enable row level security;

revoke all on table public.sponsor_like_counter from anon;
revoke all on table public.sponsor_like_counter from authenticated;
grant select, insert, update on table public.sponsor_like_counter to service_role;

create or replace function public.apply_sponsor_like_action(action text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  if action = 'like' then
    update public.sponsor_like_counter
    set count = count + 1,
        updated_at = now()
    where id = 'global'
    returning count into new_count;
  elsif action = 'unlike' then
    update public.sponsor_like_counter
    set count = greatest(0, count - 1),
        updated_at = now()
    where id = 'global'
    returning count into new_count;
  else
    raise exception 'invalid action';
  end if;

  if new_count is null then
    raise exception 'global counter row not found';
  end if;

  return new_count;
end;
$$;

revoke execute on function public.apply_sponsor_like_action(text) from public;
revoke execute on function public.apply_sponsor_like_action(text) from anon;
revoke execute on function public.apply_sponsor_like_action(text) from authenticated;
grant execute on function public.apply_sponsor_like_action(text) to service_role;
