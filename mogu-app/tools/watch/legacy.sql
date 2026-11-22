-- 点検用：リポジトリのマイグレーションより前からある表を作る（本番にはすでにある）
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  muted boolean not null default false,
  pinned boolean not null default false,
  blocked boolean not null default false,
  primary key (group_id, user_id)
);
create table if not exists public.group_shops (
  group_id uuid not null references public.groups(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  added_by uuid references auth.users(id),
  source text,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (group_id, restaurant_id)
);
create table if not exists public.group_hearts (
  group_id uuid not null,
  restaurant_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (group_id, restaurant_id, user_id)
);
create table if not exists public.group_seen (
  group_id uuid not null, restaurant_id uuid not null, user_id uuid not null,
  primary key (group_id, restaurant_id, user_id)
);
create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null, inviter_id uuid, invitee_id uuid,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table if not exists public.invites (
  token text primary key, group_id uuid not null,
  status text default 'pending', expires_at timestamptz
);
create table if not exists public.swipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, restaurant_id uuid not null,
  action text not null, group_id uuid, mogu_type_code text,
  hidden_from_saved boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.saved_restaurants (
  user_id uuid not null, restaurant_id uuid not null, group_id uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists saved_restaurants_key
  on public.saved_restaurants (user_id, restaurant_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid));
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text, body text, published_at timestamptz not null default now()
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I disable row level security', t.tablename);
  end loop;
end $$;
