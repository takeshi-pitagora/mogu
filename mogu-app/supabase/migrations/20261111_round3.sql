-- =============================================================
-- 3回目（グループと通知）で使う表・列・関数・ルール
--   引き渡し書 §7-5（グループ）・§7-6（通知）・§7-7（並び順のための集計）
--   何度実行しても同じ結果になる書き方（if not exists / create or replace）
--   SQL Editor でまとめて1回実行する
-- =============================================================

-- -------------------------------------------------------------
-- ① プロフィールに足す列（通知の設定。設定＞通知）
-- -------------------------------------------------------------
alter table public.profiles add column if not exists notif_enabled boolean not null default true;   -- ［通知を受け取る］の大きいスイッチ
alter table public.profiles add column if not exists notif_match boolean not null default true;      -- グループでマッチ
alter table public.profiles add column if not exists notif_join boolean not null default true;       -- メンバーの参加
alter table public.profiles add column if not exists notif_id_invite boolean not null default true;  -- IDでの招待
alter table public.profiles add column if not exists notif_announce boolean not null default false;  -- 運営からのお知らせ（初めはオフ）

-- -------------------------------------------------------------
-- ② グループ：動きのないグループの判定・ピン留め・通知オフ
-- -------------------------------------------------------------
alter table public.groups add column if not exists last_activity_at timestamptz not null default now();
alter table public.group_members add column if not exists pinned boolean not null default false;
alter table public.group_members add column if not exists muted boolean not null default false;      -- このグループの通知をオフ

-- -------------------------------------------------------------
-- ③ グループのお店（お店が「そのグループに入った」記録。1つのグループに1つだけ）
--    ♡そのものは今までどおり saved_restaurants（user_id・restaurant_id・group_id）を使う
-- -------------------------------------------------------------
create table if not exists public.group_shop_meta (
  group_id uuid not null references public.groups(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  source text not null default 'swipe' check (source in ('swipe', 'send')),
  created_at timestamptz not null default now(),
  matched_at timestamptz,
  primary key (group_id, restaurant_id)
);
alter table public.group_shop_meta enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'group_shop_meta' and policyname = 'group_shop_meta_select_member') then
    create policy group_shop_meta_select_member on public.group_shop_meta for select to authenticated
      using (exists (select 1 from public.group_members gm where gm.group_id = group_shop_meta.group_id and gm.user_id = auth.uid()));
  end if;
end $$;

-- ④ 流れで見た・見ていないの記録（グループの「お店」タブ用）
create table if not exists public.group_seen (
  group_id uuid not null references public.groups(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, restaurant_id, user_id)
);
alter table public.group_seen enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'group_seen' and policyname = 'group_seen_select_own') then
    create policy group_seen_select_own on public.group_seen for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ⑤ IDで招待（§7-5）
create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table public.group_invites enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'group_invites' and policyname = 'group_invites_select_party') then
    create policy group_invites_select_party on public.group_invites for select to authenticated
      using (invitee_id = auth.uid() or inviter_id = auth.uid());
  end if;
end $$;

-- ⑥ 通知（アプリの中の一覧・ベル）
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- group_match / group_join / group_id_invite / announcement
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_select_own') then
    create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_update_own') then
    create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- 運営からのお知らせ（本文）。全利用者に同じ内容を見せる。本人が通知オンのときだけプッシュする
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_select_all') then
    create policy announcements_select_all on public.announcements for select to authenticated using (true);
  end if;
end $$;

-- プッシュ通知の宛先（APNs の device token、または Expo Push Token）
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
alter table public.push_tokens enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_tokens' and policyname = 'push_tokens_all_own') then
    create policy push_tokens_all_own on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- -------------------------------------------------------------
-- ⑦ 並び順のためのいいねの集計（§7-7）：スワイプした時点のタイプを残す
-- -------------------------------------------------------------
alter table public.swipes add column if not exists mogu_type_code_at_swipe text;

create or replace function public.mogu_swipes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mogu_type_code_at_swipe is null then
    select mogu_type_code into new.mogu_type_code_at_swipe from public.profiles where id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists mogu_swipes_guard on public.swipes;
create trigger mogu_swipes_guard before insert on public.swipes for each row execute function public.mogu_swipes_guard();

-- 同じタイプの人に人気（自分がまだ診断していなければ空を返す＝アプリ側で「同じモグタイプ」を出さない判定に使う）
create or replace function public.popular_restaurants_for_type(p_limit int default 50)
returns table (restaurant_id uuid, like_count int)
language sql
stable
security definer
set search_path = public
as $$
  select s.restaurant_id, count(*)::int as like_count
  from public.swipes s
  where s.action = 'like'
    and s.mogu_type_code_at_swipe = (select mogu_type_code from public.profiles where id = auth.uid())
    and (select mogu_type_code from public.profiles where id = auth.uid()) is not null
  group by s.restaurant_id
  order by like_count desc
  limit p_limit;
$$;
revoke all on function public.popular_restaurants_for_type(int) from public, anon;
grant execute on function public.popular_restaurants_for_type(int) to authenticated;

-- 急上昇中（直近7日でいいねが増えた順）
create or replace function public.trending_restaurants(p_limit int default 50)
returns table (restaurant_id uuid, like_count int)
language sql
stable
security definer
set search_path = public
as $$
  select s.restaurant_id, count(*)::int as like_count
  from public.swipes s
  where s.action = 'like' and s.created_at >= now() - interval '7 days'
  group by s.restaurant_id
  order by like_count desc
  limit p_limit;
$$;
revoke all on function public.trending_restaurants(int) from public, anon;
grant execute on function public.trending_restaurants(int) to authenticated;

-- -------------------------------------------------------------
-- ⑧ グループのお店まわりの関数
-- -------------------------------------------------------------

-- 通知を1件作る（本人の設定・グループごとの通知オフを確かめてから）。種類ごとのオン/オフの列名を渡す
create or replace function public.mogu_notify(p_user uuid, p_type text, p_payload jsonb, p_pref_col text default null, p_group_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_user is null then return; end if;
  select coalesce(notif_enabled, true)
    and (p_pref_col is null or case p_pref_col
      when 'notif_match' then notif_match
      when 'notif_join' then notif_join
      when 'notif_id_invite' then notif_id_invite
      when 'notif_announce' then notif_announce
      else true
    end)
  into v_ok
  from public.profiles where id = p_user;
  if not coalesce(v_ok, true) then return; end if;
  if p_group_id is not null and exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user and muted) then
    return;
  end if;
  insert into public.notifications (user_id, type, payload) values (p_user, p_type, p_payload);
end;
$$;

-- お店をグループに入れる（ホームでグループを選んで♡・保存/詳細から「グループに送る」の両方から呼ぶ）
create or replace function public.group_add_shop(p_group_id uuid, p_restaurant_id uuid, p_source text default 'swipe')
returns table (like_count int, matched boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_count int;
  v_like_count int;
  v_already_matched timestamptz;
  v_name text;
  v_rname text;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'not a member';
  end if;

  insert into public.group_shop_meta (group_id, restaurant_id, added_by, source)
  values (p_group_id, p_restaurant_id, auth.uid(), p_source)
  on conflict (group_id, restaurant_id) do nothing;

  insert into public.saved_restaurants (user_id, restaurant_id, group_id)
  values (auth.uid(), p_restaurant_id, p_group_id)
  on conflict (user_id, restaurant_id, group_id) do nothing;

  insert into public.group_seen (group_id, restaurant_id, user_id)
  values (p_group_id, p_restaurant_id, auth.uid())
  on conflict do nothing;

  update public.groups set last_activity_at = now() where id = p_group_id;

  select count(*)::int into v_member_count from public.group_members where group_id = p_group_id;
  select count(*)::int into v_like_count from public.saved_restaurants where group_id = p_group_id and restaurant_id = p_restaurant_id;
  select matched_at into v_already_matched from public.group_shop_meta where group_id = p_group_id and restaurant_id = p_restaurant_id;

  if v_already_matched is null and v_member_count > 0 and v_like_count >= v_member_count then
    update public.group_shop_meta set matched_at = now() where group_id = p_group_id and restaurant_id = p_restaurant_id;
    select name into v_name from public.groups where id = p_group_id;
    select name into v_rname from public.restaurants where id = p_restaurant_id;
    perform public.mogu_notify(gm.user_id, 'group_match',
      jsonb_build_object('group_id', p_group_id, 'group_name', v_name, 'restaurant_id', p_restaurant_id, 'restaurant_name', v_rname, 'member_count', v_member_count),
      'notif_match', p_group_id)
    from public.group_members gm where gm.group_id = p_group_id;
    return query select v_like_count, true;
    return;
  end if;
  return query select v_like_count, false;
end;
$$;
revoke all on function public.group_add_shop(uuid, uuid, text) from public, anon;
grant execute on function public.group_add_shop(uuid, uuid, text) to authenticated;

-- ボードの♡を付ける・外す（お店のタブ：流れ・ボードの両方のハートから呼ぶ）
create or replace function public.group_toggle_heart(p_group_id uuid, p_restaurant_id uuid)
returns table (like_count int, my_heart boolean, matched boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing boolean;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'not a member';
  end if;
  select exists (select 1 from public.saved_restaurants where user_id = auth.uid() and restaurant_id = p_restaurant_id and group_id = p_group_id) into v_existing;

  if v_existing then
    delete from public.saved_restaurants where user_id = auth.uid() and restaurant_id = p_restaurant_id and group_id = p_group_id;
    return query select
      (select count(*)::int from public.saved_restaurants where group_id = p_group_id and restaurant_id = p_restaurant_id),
      false,
      false;
    return;
  end if;

  -- 初めて♡するお店なら、グループに入れるところから（マッチの判定も group_add_shop に任せる）
  if not exists (select 1 from public.group_shop_meta where group_id = p_group_id and restaurant_id = p_restaurant_id) then
    return query select r.like_count, true, r.matched from public.group_add_shop(p_group_id, p_restaurant_id, 'swipe') r;
    return;
  end if;

  insert into public.saved_restaurants (user_id, restaurant_id, group_id) values (auth.uid(), p_restaurant_id, p_group_id)
  on conflict (user_id, restaurant_id, group_id) do nothing;
  insert into public.group_seen (group_id, restaurant_id, user_id) values (p_group_id, p_restaurant_id, auth.uid()) on conflict do nothing;

  declare
    v_member_count int;
    v_like_count int;
    v_already_matched timestamptz;
    v_name text;
    v_rname text;
  begin
    select count(*)::int into v_member_count from public.group_members where group_id = p_group_id;
    select count(*)::int into v_like_count from public.saved_restaurants where group_id = p_group_id and restaurant_id = p_restaurant_id;
    select matched_at into v_already_matched from public.group_shop_meta where group_id = p_group_id and restaurant_id = p_restaurant_id;
    if v_already_matched is null and v_member_count > 0 and v_like_count >= v_member_count then
      update public.group_shop_meta set matched_at = now() where group_id = p_group_id and restaurant_id = p_restaurant_id;
      select name into v_name from public.groups where id = p_group_id;
      select name into v_rname from public.restaurants where id = p_restaurant_id;
      perform public.mogu_notify(gm.user_id, 'group_match',
        jsonb_build_object('group_id', p_group_id, 'group_name', v_name, 'restaurant_id', p_restaurant_id, 'restaurant_name', v_rname, 'member_count', v_member_count),
        'notif_match', p_group_id)
      from public.group_members gm where gm.group_id = p_group_id;
      return query select v_like_count, true, true;
      return;
    end if;
    return query select v_like_count, true, false;
  end;
end;
$$;
revoke all on function public.group_toggle_heart(uuid, uuid) from public, anon;
grant execute on function public.group_toggle_heart(uuid, uuid) to authenticated;

-- 見た（パスした）だけの印（ハートは付けない）
create or replace function public.group_mark_seen(p_group_id uuid, p_restaurant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.group_seen (group_id, restaurant_id, user_id)
  select p_group_id, p_restaurant_id, auth.uid()
  where exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid())
  on conflict do nothing;
$$;
revoke all on function public.group_mark_seen(uuid, uuid) from public, anon;
grant execute on function public.group_mark_seen(uuid, uuid) to authenticated;

-- お店のタブ「流れ」：自分がまだ見ていないお店（新しい順）
create or replace function public.group_unseen_shops(p_group_id uuid)
returns table (restaurant_id uuid, added_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.restaurant_id, m.created_at
  from public.group_shop_meta m
  where m.group_id = p_group_id
    and exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid())
    and not exists (select 1 from public.group_seen s where s.group_id = m.group_id and s.restaurant_id = m.restaurant_id and s.user_id = auth.uid())
  order by m.created_at asc;
$$;
revoke all on function public.group_unseen_shops(uuid) from public, anon;
grant execute on function public.group_unseen_shops(uuid) to authenticated;

-- まだ見ていないお店の数（一覧のバッジ）
create or replace function public.group_unseen_count(p_group_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.group_shop_meta m
  where m.group_id = p_group_id
    and exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid())
    and not exists (select 1 from public.group_seen s where s.group_id = m.group_id and s.restaurant_id = m.restaurant_id and s.user_id = auth.uid());
$$;
revoke all on function public.group_unseen_count(uuid) from public, anon;
grant execute on function public.group_unseen_count(uuid) to authenticated;

-- ボード：♡の多い順（同じなら新しい順）。だれが♡したかは返さない
create or replace function public.group_board(p_group_id uuid)
returns table (restaurant_id uuid, like_count int, my_heart boolean, added_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.restaurant_id,
    (select count(*)::int from public.saved_restaurants sr where sr.group_id = p_group_id and sr.restaurant_id = m.restaurant_id),
    exists (select 1 from public.saved_restaurants sr where sr.group_id = p_group_id and sr.restaurant_id = m.restaurant_id and sr.user_id = auth.uid()),
    m.created_at
  from public.group_shop_meta m
  where m.group_id = p_group_id
    and exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid())
  order by 2 desc, m.created_at desc;
$$;
revoke all on function public.group_board(uuid) from public, anon;
grant execute on function public.group_board(uuid) to authenticated;

-- -------------------------------------------------------------
-- ⑨ 一覧（検索・ピン留め・最新の出来事・まだ見ていないお店の数）
-- -------------------------------------------------------------
-- 戻り値の列を増やしたため、CREATE OR REPLACE だけでは型を変えられない（42P13）。先に消してから作り直す
drop function if exists public.get_my_groups();
create or replace function public.get_my_groups()
returns table (id uuid, name text, member_count int, members jsonb, created_at timestamptz, pinned boolean, muted boolean, last_activity_at timestamptz, unseen_count int, last_event text)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members m where m.group_id = g.id) as member_count,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'display_name', x.display_name, 'food_style', x.mogu_type_code,
        'avatar_path', x.avatar_path, 'handle', x.handle, 'blocked', x.blocked))
      from (
        select p.id, p.display_name, p.mogu_type_code, p.handle,
               case when public.mogu_blocked_between(auth.uid(), p.id) then null else p.avatar_path end as avatar_path,
               public.mogu_blocked_between(auth.uid(), p.id) as blocked
        from public.group_members m2
        join public.profiles p on p.id = m2.user_id
        where m2.group_id = g.id
        order by m2.joined_at
        limit 4
      ) x
    ), '[]'::jsonb) as members,
    g.created_at,
    me.pinned,
    me.muted,
    g.last_activity_at,
    public.group_unseen_count(g.id),
    (select r.name from public.group_shop_meta sm join public.restaurants r on r.id = sm.restaurant_id where sm.group_id = g.id order by sm.created_at desc limit 1) as last_event
  from public.groups g
  join public.group_members me on me.group_id = g.id and me.user_id = auth.uid()
  order by me.pinned desc, g.last_activity_at desc;
$$;

create or replace function public.group_set_pinned(p_group_id uuid, p_pinned boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.group_members set pinned = p_pinned where group_id = p_group_id and user_id = auth.uid();
$$;
revoke all on function public.group_set_pinned(uuid, boolean) from public, anon;
grant execute on function public.group_set_pinned(uuid, boolean) to authenticated;

create or replace function public.group_set_muted(p_group_id uuid, p_muted boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.group_members set muted = p_muted where group_id = p_group_id and user_id = auth.uid();
$$;
revoke all on function public.group_set_muted(uuid, boolean) from public, anon;
grant execute on function public.group_set_muted(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- ⑩ 抜ける・作った人（いちばん早く入った人に引き継ぐ）
-- -------------------------------------------------------------
create or replace function public.mogu_group_handoff(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_next uuid;
begin
  select created_by into v_owner from public.groups where id = p_group_id;
  if v_owner is null or exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_owner) then
    return; -- 作った人がまだ残っている、または作った人の記録がない
  end if;
  select user_id into v_next from public.group_members where group_id = p_group_id order by joined_at asc limit 1;
  if v_next is not null then
    update public.groups set created_by = v_next where id = p_group_id;
  else
    delete from public.groups where id = p_group_id; -- メンバーがいなければ消す
  end if;
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  delete from public.group_members where group_id = p_group_id and user_id = auth.uid();
  perform public.mogu_group_handoff(p_group_id);
end;
$$;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- メンバーの参加の通知（join_group_by_code の成功のあとで呼ぶ。本人以外の全員に送る）
create or replace function public.mogu_notify_group_join(p_group_id uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_display text;
begin
  select name into v_name from public.groups where id = p_group_id;
  select display_name into v_display from public.profiles where id = p_user;
  perform public.mogu_notify(gm.user_id, 'group_join',
    jsonb_build_object('group_id', p_group_id, 'group_name', v_name, 'user_id', p_user, 'display_name', v_display),
    'notif_join', p_group_id)
  from public.group_members gm where gm.group_id = p_group_id and gm.user_id <> p_user;
end;
$$;

-- join_group_by_code に、参加の通知を足す（2回目までの関数を上書き）
create or replace function public.join_group_by_code(p_code text)
returns table (group_id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_expires_at timestamptz;
begin
  if auth.uid() is null or public.mogu_is_guest(auth.uid()) then
    raise exception 'guest account cannot join';
  end if;
  select i.group_id, i.expires_at into v_group_id, v_expires_at from public.invites i where i.token = p_code limit 1;
  if v_group_id is null then
    raise exception 'invite not found';
  end if;
  if v_expires_at <= now() then
    raise exception 'invite expired';
  end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = v_group_id and gm.user_id = auth.uid()) then
    insert into public.group_members (group_id, user_id) values (v_group_id, auth.uid());
    update public.groups set last_activity_at = now() where id = v_group_id;
    perform public.mogu_notify_group_join(v_group_id, auth.uid());
  end if;
  update public.invites set used_at = coalesce(used_at, now()) where token = p_code;
  return query select g.id, g.name from public.groups g where g.id = v_group_id;
end;
$$;
revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;

-- -------------------------------------------------------------
-- ⑪ IDで招待（§7-5：招待を受け取らない人・ブロックしている人には届かない）
-- -------------------------------------------------------------
create or replace function public.find_user_by_handle(p_handle text)
returns table (id uuid, handle text, display_name text, avatar_path text, mogu_type_code text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name,
    case when public.mogu_blocked_between(auth.uid(), p.id) then null else p.avatar_path end,
    p.mogu_type_code
  from public.profiles p
  where lower(p.handle) = lower(p_handle)
    and p.id <> auth.uid()
    and p.invite_scope = 'anyone'
    and not public.mogu_blocked_between(auth.uid(), p.id)
  limit 1;
$$;
revoke all on function public.find_user_by_handle(text) from public, anon;
grant execute on function public.find_user_by_handle(text) to authenticated;

create or replace function public.invite_group_by_handle(p_group_id uuid, p_handle text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_id uuid;
  v_group_name text;
  v_display text;
  v_handle text;
  v_avatar text;
  v_type_code text;
  v_linked_at timestamptz;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'not a member';
  end if;
  select p.id into v_target from public.profiles p
    where lower(p.handle) = lower(p_handle) and p.invite_scope = 'anyone' and not public.mogu_blocked_between(auth.uid(), p.id);
  if v_target is null then
    raise exception 'user_not_found';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_target) then
    raise exception 'already_member';
  end if;
  insert into public.group_invites (group_id, inviter_id, invitee_id) values (p_group_id, auth.uid(), v_target)
  returning id into v_id;
  select name into v_group_name from public.groups where id = p_group_id;
  -- 招待の確認画面（お知らせ⑩）に「招待した人」のパスをそのまま出せるよう、通知の時点のスナップショットを持たせる
  select display_name, handle, avatar_path, mogu_type_code, mogu_type_linked_at
    into v_display, v_handle, v_avatar, v_type_code, v_linked_at
    from public.profiles where id = auth.uid();
  perform public.mogu_notify(v_target, 'group_id_invite',
    jsonb_build_object(
      'invite_id', v_id, 'group_id', p_group_id, 'group_name', v_group_name,
      'inviter_id', auth.uid(), 'inviter_display_name', v_display, 'inviter_handle', v_handle,
      'inviter_avatar_path', v_avatar, 'inviter_type_code', v_type_code, 'inviter_type_linked_at', v_linked_at),
    'notif_id_invite', null);
  return v_id;
end;
$$;
revoke all on function public.invite_group_by_handle(uuid, text) from public, anon;
grant execute on function public.invite_group_by_handle(uuid, text) to authenticated;

create or replace function public.respond_group_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_invitee uuid;
begin
  select group_id, invitee_id into v_group, v_invitee from public.group_invites where id = p_invite_id;
  if v_invitee is null or v_invitee <> auth.uid() then
    raise exception 'not yours';
  end if;
  update public.group_invites set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = p_invite_id;
  if p_accept then
    insert into public.group_members (group_id, user_id)
    select v_group, auth.uid()
    where not exists (select 1 from public.group_members where group_id = v_group and user_id = auth.uid());
    update public.groups set last_activity_at = now() where id = v_group;
    perform public.mogu_notify_group_join(v_group, auth.uid());
  end if;
end;
$$;
revoke all on function public.respond_group_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- ⑫ 通知の一覧（ベル）
-- -------------------------------------------------------------
-- invite_status：group_id_invite のときだけ pending/accepted/declined（お知らせ一覧の「返事待ち」振り分け用）
create or replace function public.list_notifications()
returns table (id uuid, type text, payload jsonb, read_at timestamptz, created_at timestamptz, invite_status text)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.type, n.payload, n.read_at, n.created_at,
    case when n.type = 'group_id_invite' then gi.status else null end as invite_status
  from public.notifications n
  left join public.group_invites gi on gi.id = (n.payload->>'invite_id')::uuid and n.type = 'group_id_invite'
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 200;
$$;
revoke all on function public.list_notifications() from public, anon;
grant execute on function public.list_notifications() to authenticated;

-- 運営からのお知らせを全員（通知オンの人だけ）に送る。SQL Editor から運営が直接呼ぶ（アプリからは呼べない）
create or replace function public.publish_announcement(p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.announcements (title, body) values (p_title, p_body) returning id into v_id;
  perform public.mogu_notify(p.id, 'announcement', jsonb_build_object('announcement_id', v_id, 'title', p_title), 'notif_announce', null)
  from public.profiles p;
  return v_id;
end;
$$;
revoke all on function public.publish_announcement(text, text) from public, anon, authenticated;

create or replace function public.notifications_unread_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.notifications_unread_count() from public, anon;
grant execute on function public.notifications_unread_count() to authenticated;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- プッシュ通知の宛先の登録・削除（ログイン中の端末から呼ぶ）
create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (user_id, token) do update set updated_at = now(), platform = excluded.platform;
$$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where user_id = auth.uid() and token = p_token;
$$;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- -------------------------------------------------------------
-- ⑬ アカウント削除（3回目分の追加）：通知・プッシュ宛先・グループの印を消す／グループを引き継ぐ
--    delete-account（Edge Function）側は、このテーブル名を知らなくても
--    profiles の削除（on delete cascade）でまとめて消えるものは手を加えない。
--    「作ったグループの引き継ぎ」は mogu_group_handoff を使うよう、delete-account 側の対応が必要
-- -------------------------------------------------------------
-- notifications / push_tokens / group_shop_meta(added_by) / group_seen / group_invites は
-- 上のテーブル定義で user_id 列に on delete cascade / set null を付けているので、
-- プロフィール削除時に自動で消える（追加の処理は不要）
