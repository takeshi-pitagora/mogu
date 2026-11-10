-- =============================================================
-- 3回目（グループと通知）で使う表・列・関数・ルール
--   引き渡し書 §7-5（グループ）・§7-6（通知）・§7-7（並び順の集計）
--   何度実行しても同じ結果になる書き方（if not exists / create or replace）
--   SQL Editor でまとめて1回実行する
--
-- 「owner_id」は作らず、今ある groups.created_by をそのまま「作った人・今の持ち主」として使う
--   （delete-account の引き継ぎ処理と同じ考え方にそろえるため。表（案）の列名とは違うが、
--    今のアプリにすでにある仕組みと合わせるための判断。実装計画のとおり、ここに書いて報告する）
-- =============================================================


-- -------------------------------------------------------------
-- ① groups・group_members に足す列
-- -------------------------------------------------------------
alter table public.groups add column if not exists last_activity_at timestamptz not null default now();
alter table public.group_members add column if not exists pinned boolean not null default false;
alter table public.group_members add column if not exists muted boolean not null default false;

-- 動きのないグループの一覧・並びで使う
create index if not exists groups_last_activity_idx on public.groups (last_activity_at desc);


-- -------------------------------------------------------------
-- ② グループのお店（group_shops）・♡（group_hearts）・まだ見ていない（group_seen）
--    だれが入れた・だれが♡したかはアプリに返さない（§7-5・§7-7）。
--    読み書きは下の関数（toggle_group_heart など）を通す。表への直接の書き込みはできない
-- -------------------------------------------------------------
create table if not exists public.group_shops (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  source text not null default 'swipe' check (source in ('swipe', 'send')),
  created_at timestamptz not null default now(),
  matched_at timestamptz,
  unique (group_id, restaurant_id)
);
alter table public.group_shops enable row level security;
create index if not exists group_shops_group_idx on public.group_shops (group_id, created_at desc);

drop policy if exists group_shops_select_member on public.group_shops;
create policy group_shops_select_member on public.group_shops for select to authenticated
  using (exists (select 1 from public.group_members gm where gm.group_id = group_shops.group_id and gm.user_id = auth.uid()));

create table if not exists public.group_hearts (
  group_id uuid not null references public.groups(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, restaurant_id, user_id)
);
alter table public.group_hearts enable row level security;
-- 自分の♡だけ読める（他の人の♡は件数しか見せない。件数は get_group_board 関数で返す）
drop policy if exists group_hearts_select_own on public.group_hearts;
create policy group_hearts_select_own on public.group_hearts for select to authenticated using (user_id = auth.uid());

create table if not exists public.group_seen (
  group_id uuid not null references public.groups(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, restaurant_id, user_id)
);
alter table public.group_seen enable row level security;
drop policy if exists group_seen_select_own on public.group_seen;
create policy group_seen_select_own on public.group_seen for select to authenticated using (user_id = auth.uid());


-- -------------------------------------------------------------
-- ③ IDでの招待（group_invites）
-- -------------------------------------------------------------
create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table public.group_invites enable row level security;
create index if not exists group_invites_invitee_idx on public.group_invites (invitee_id, status);

drop policy if exists group_invites_select_party on public.group_invites;
create policy group_invites_select_party on public.group_invites for select to authenticated
  using (invitee_id = auth.uid() or inviter_id = auth.uid());


-- -------------------------------------------------------------
-- ④ 通知（notifications）・運営のお知らせ（announcements）・プッシュの宛先（push_tokens）
-- -------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('group_match', 'member_joined', 'id_invite', 'announcement')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
-- 既読にする（read_at だけ変えられる）のは本人のみ
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists announcements_select_all on public.announcements;
create policy announcements_select_all on public.announcements for select to authenticated using (true);
-- 作成・編集は Supabase の Table Editor（運営）から。アプリからの書き込みルールは作らない

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_all_own on public.push_tokens;
create policy push_tokens_all_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- -------------------------------------------------------------
-- ⑤ 通知の設定（profiles）・いいねの記録にタイプを残す（swipes）
-- -------------------------------------------------------------
alter table public.profiles add column if not exists notif_master boolean not null default true;
alter table public.profiles add column if not exists notif_match boolean not null default true;
alter table public.profiles add column if not exists notif_member_joined boolean not null default true;
alter table public.profiles add column if not exists notif_id_invite boolean not null default true;
alter table public.profiles add column if not exists notif_announcement boolean not null default false; -- お知らせだけ初めはオフ（§7-6）
alter table public.profiles add column if not exists notif_prompted_at timestamptz; -- 「通知の許可のお願い」を出した日時（初めてグループに入ったときに1度だけ）

alter table public.swipes add column if not exists mogu_type_code text; -- いいねした時点のタイプ（§7-7の並び順で使う）


-- -------------------------------------------------------------
-- ⑥ グループを作る・招待コードで参加・IDで招待・ピン留め・ミュート・名前の変更
-- -------------------------------------------------------------

-- 招待コード（8文字）を groups 作成と同時に発行し直す必要はない。今までどおり invites テーブルを使う。
-- ここでは「IDで招待」「ピン留め」「ミュート」「グループ名の変更」「お店を足す」「♡」「見た」をまとめる

-- グループに最新の動きがあったとき last_activity_at を更新する共通関数
create or replace function public.mogu_touch_group(p_group_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.groups set last_activity_at = now() where id = p_group_id;
$$;

-- お店をグループに足す（ホームでそのグループを選んで♡した・保存／詳細から送った）。
-- 同じお店は1グループに1つだけ。足した人は自動で♡が付く（§7-5）
create or replace function public.add_group_shop(p_group_id uuid, p_restaurant_id uuid, p_source text default 'swipe')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'guest account cannot use groups';
  end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;

  insert into public.group_shops (group_id, restaurant_id, added_by, source)
  values (p_group_id, p_restaurant_id, auth.uid(), p_source)
  on conflict (group_id, restaurant_id) do nothing;

  insert into public.group_hearts (group_id, restaurant_id, user_id)
  values (p_group_id, p_restaurant_id, auth.uid())
  on conflict (group_id, restaurant_id, user_id) do nothing;

  -- 見た記録も付けておく（自分の流れに出さないため）
  insert into public.group_seen (group_id, restaurant_id, user_id)
  values (p_group_id, p_restaurant_id, auth.uid())
  on conflict (group_id, restaurant_id, user_id) do nothing;

  perform public.mogu_touch_group(p_group_id);
  perform public.mogu_check_group_match(p_group_id, p_restaurant_id);
end;
$$;
revoke all on function public.add_group_shop(uuid, uuid, text) from public, anon;
grant execute on function public.add_group_shop(uuid, uuid, text) to authenticated;

-- ♡を付ける・外す（トグル）。付け外しとも全員分の数を数え直し、全員分そろったら1回だけ通知する
create or replace function public.toggle_group_heart(p_group_id uuid, p_restaurant_id uuid)
returns boolean -- 戻り値：付いた(true)／外れた(false)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on boolean;
begin
  if auth.uid() is null then
    raise exception 'guest account cannot use groups';
  end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;

  delete from public.group_hearts where group_id = p_group_id and restaurant_id = p_restaurant_id and user_id = auth.uid();
  if found then
    v_on := false;
  else
    insert into public.group_hearts (group_id, restaurant_id, user_id) values (p_group_id, p_restaurant_id, auth.uid());
    v_on := true;
  end if;

  insert into public.group_seen (group_id, restaurant_id, user_id)
  values (p_group_id, p_restaurant_id, auth.uid())
  on conflict (group_id, restaurant_id, user_id) do nothing;

  perform public.mogu_touch_group(p_group_id);
  if v_on then
    perform public.mogu_check_group_match(p_group_id, p_restaurant_id);
  end if;
  return v_on;
end;
$$;
revoke all on function public.toggle_group_heart(uuid, uuid) from public, anon;
grant execute on function public.toggle_group_heart(uuid, uuid) to authenticated;

-- 全員が♡したかを確かめ、そろっていれば matched_at を入れて通知を1回だけ送る
create or replace function public.mogu_check_group_match(p_group_id uuid, p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members int;
  v_hearts int;
  v_matched timestamptz;
  v_name text;
begin
  select count(*) into v_members from public.group_members where group_id = p_group_id;
  select count(*) into v_hearts from public.group_hearts where group_id = p_group_id and restaurant_id = p_restaurant_id;
  select matched_at into v_matched from public.group_shops where group_id = p_group_id and restaurant_id = p_restaurant_id;

  if v_matched is null and v_members > 0 and v_hearts >= v_members then
    update public.group_shops set matched_at = now() where group_id = p_group_id and restaurant_id = p_restaurant_id;
    select name into v_name from public.restaurants where id = p_restaurant_id;
    insert into public.notifications (user_id, type, payload)
    select gm.user_id, 'group_match', jsonb_build_object('group_id', p_group_id, 'restaurant_id', p_restaurant_id, 'restaurant_name', v_name)
    from public.group_members gm
    where gm.group_id = p_group_id;
  end if;
end;
$$;

-- まだ見ていないお店だけを流す（「グループのお店」タブ）
create or replace function public.get_group_feed(p_group_id uuid)
returns table (restaurant_id uuid, name text, photo text, area text, genre text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name,
    case when jsonb_typeof(r.photos) = 'array' and jsonb_array_length(r.photos) > 0 then r.photos->>0 else null end,
    r.area, r.genre
  from public.group_shops gs
  join public.restaurants r on r.id = gs.restaurant_id
  where gs.group_id = p_group_id
    and exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid())
    and not exists (select 1 from public.group_seen s where s.group_id = p_group_id and s.restaurant_id = gs.restaurant_id and s.user_id = auth.uid())
    and not exists (select 1 from public.group_hearts h where h.group_id = p_group_id and h.restaurant_id = gs.restaurant_id and h.user_id = auth.uid())
  order by gs.created_at asc;
$$;
revoke all on function public.get_group_feed(uuid) from public, anon;
grant execute on function public.get_group_feed(uuid) to authenticated;

-- ボード（♡の多い順）。だれが♡したかは返さず、件数と自分が♡したかだけ返す（§7-5）
create or replace function public.get_group_board(p_group_id uuid)
returns table (restaurant_id uuid, name text, photo text, area text, genre text, heart_count int, self_hearted boolean, matched_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name,
    case when jsonb_typeof(r.photos) = 'array' and jsonb_array_length(r.photos) > 0 then r.photos->>0 else null end,
    r.area, r.genre,
    (select count(*)::int from public.group_hearts h where h.group_id = p_group_id and h.restaurant_id = gs.restaurant_id),
    exists (select 1 from public.group_hearts h2 where h2.group_id = p_group_id and h2.restaurant_id = gs.restaurant_id and h2.user_id = auth.uid()),
    gs.matched_at
  from public.group_shops gs
  join public.restaurants r on r.id = gs.restaurant_id
  where gs.group_id = p_group_id
    and exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid())
  order by 6 desc, gs.created_at desc;
$$;
revoke all on function public.get_group_board(uuid) from public, anon;
grant execute on function public.get_group_board(uuid) to authenticated;

-- IDで招待する。見つからない・ブロック・範囲=none は、すべて同じ文言にする（相手に知られない。§7-5）
create or replace function public.invite_by_handle(p_group_id uuid, p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_scope text;
begin
  if auth.uid() is null then
    raise exception 'guest account cannot invite';
  end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;

  select id, invite_scope into v_target, v_scope from public.profiles where lower(handle) = lower(trim(p_handle));

  if v_target is null
     or v_target = auth.uid()
     or coalesce(v_scope, 'anyone') <> 'anyone'
     or public.mogu_blocked_between(auth.uid(), v_target)
     or exists (select 1 from public.group_members gm2 where gm2.group_id = p_group_id and gm2.user_id = v_target)
  then
    raise exception 'not_found';
  end if;

  insert into public.group_invites (group_id, inviter_id, invitee_id)
  values (p_group_id, auth.uid(), v_target)
  on conflict do nothing;

  insert into public.notifications (user_id, type, payload)
  values (v_target, 'id_invite', jsonb_build_object('group_id', p_group_id, 'inviter_id', auth.uid()));
end;
$$;
revoke all on function public.invite_by_handle(uuid, text) from public, anon;
grant execute on function public.invite_by_handle(uuid, text) to authenticated;

-- IDでの招待に返事をする（参加する／断る）
create or replace function public.respond_group_invite(p_invite_id uuid, p_accept boolean)
returns table (group_id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
begin
  if auth.uid() is null then
    raise exception 'guest account cannot join';
  end if;

  select gi.group_id into v_group from public.group_invites gi
  where gi.id = p_invite_id and gi.invitee_id = auth.uid() and gi.status = 'pending';

  if v_group is null then
    raise exception 'invite not found';
  end if;

  update public.group_invites set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_invite_id;

  if p_accept then
    insert into public.group_members (group_id, user_id)
    select v_group, auth.uid()
    where not exists (select 1 from public.group_members gm where gm.group_id = v_group and gm.user_id = auth.uid());
    perform public.mogu_notify_member_joined(v_group, auth.uid());
  end if;

  return query select g.id, g.name from public.groups g where g.id = v_group;
end;
$$;
revoke all on function public.respond_group_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;

-- 新しいメンバーが入ったことを、ほかのメンバーに知らせる（招待コード参加・ID招待の受諾の両方から呼ぶ）
create or replace function public.mogu_notify_member_joined(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select display_name into v_name from public.profiles where id = p_user_id;
  insert into public.notifications (user_id, type, payload)
  select gm.user_id, 'member_joined', jsonb_build_object('group_id', p_group_id, 'user_id', p_user_id, 'display_name', v_name)
  from public.group_members gm
  where gm.group_id = p_group_id and gm.user_id <> p_user_id;
  perform public.mogu_touch_group(p_group_id);
end;
$$;

-- ピン留め・ミュート・グループ名の変更
create or replace function public.set_group_pinned(p_group_id uuid, p_pinned boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.group_members set pinned = p_pinned where group_id = p_group_id and user_id = auth.uid();
$$;
revoke all on function public.set_group_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_group_pinned(uuid, boolean) to authenticated;

create or replace function public.set_group_muted(p_group_id uuid, p_muted boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.group_members set muted = p_muted where group_id = p_group_id and user_id = auth.uid();
$$;
revoke all on function public.set_group_muted(uuid, boolean) from public, anon;
grant execute on function public.set_group_muted(uuid, boolean) to authenticated;

create or replace function public.rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;
  if trim(p_name) = '' or length(p_name) > 20 then
    raise exception 'invalid_name';
  end if;
  update public.groups set name = trim(p_name) where id = p_group_id;
end;
$$;
revoke all on function public.rename_group(uuid, text) from public, anon;
grant execute on function public.rename_group(uuid, text) to authenticated;


-- -------------------------------------------------------------
-- ⑦ グループの一覧（検索・ピン留め・未読数・最新の出来事・時刻）
--    get_my_groups を1回目のものから置き換える（引数なしは互換のため残す）
-- -------------------------------------------------------------
create or replace function public.get_my_groups()
returns table (
  id uuid, name text, member_count int, members jsonb, created_at timestamptz,
  pinned boolean, muted boolean, last_activity_at timestamptz, unseen_count int, last_event text
)
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
      select jsonb_agg(jsonb_build_object('id', x.id, 'display_name', x.display_name, 'food_style', x.food_style))
      from (
        select p.id, p.display_name, p.food_style
        from public.group_members m2
        join public.profiles p on p.id = m2.user_id
        where m2.group_id = g.id
        limit 4
      ) x
    ), '[]'::jsonb) as members,
    g.created_at,
    me.pinned,
    me.muted,
    g.last_activity_at,
    (
      select count(*)::int from public.group_shops gs
      where gs.group_id = g.id
        and not exists (select 1 from public.group_seen s where s.group_id = g.id and s.restaurant_id = gs.restaurant_id and s.user_id = auth.uid())
        and not exists (select 1 from public.group_hearts h where h.group_id = g.id and h.restaurant_id = gs.restaurant_id and h.user_id = auth.uid())
    ) as unseen_count,
    (
      select case
        when count(*) = 0 then null
        when count(*) = 1 then '新しいお店：' || max(r.name)
        else '新しいお店が' || count(*) || '件'
      end
      from public.group_shops gs2
      join public.restaurants r on r.id = gs2.restaurant_id
      where gs2.group_id = g.id and gs2.created_at > now() - interval '7 days'
        and not exists (select 1 from public.group_seen s2 where s2.group_id = g.id and s2.restaurant_id = gs2.restaurant_id and s2.user_id = auth.uid())
    ) as last_event
  from public.groups g
  join public.group_members me on me.group_id = g.id and me.user_id = auth.uid()
  order by me.pinned desc, g.last_activity_at desc;
$$;

revoke all on function public.get_my_groups() from public, anon;
grant execute on function public.get_my_groups() to authenticated;


-- -------------------------------------------------------------
-- ⑧ グループを抜ける・削除したとき、いちばん早く入った人に引き継ぐ（§7-5）
--    delete-account（Edge Function）が先に group_members(self) を消す流れとも揃う：
--    そちらは消したあとに自分で引き継ぎ先を探すので、このトリガーが先に片付けても
--    delete-account 側の対象が0件になるだけで、二重に動いても問題は起きない
-- -------------------------------------------------------------
create or replace function public.mogu_group_member_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_next uuid;
  v_remaining int;
begin
  select created_by into v_owner from public.groups where id = old.group_id;
  if v_owner is null or v_owner <> old.user_id then
    return old; -- 抜けたのが作った人でなければ何もしない
  end if;

  select count(*) into v_remaining from public.group_members where group_id = old.group_id;
  if v_remaining = 0 then
    delete from public.invites where group_id = old.group_id;
    delete from public.groups where id = old.group_id;
    return old;
  end if;

  select user_id into v_next from public.group_members
  where group_id = old.group_id
  order by joined_at asc
  limit 1;

  if v_next is not null then
    update public.groups set created_by = v_next where id = old.group_id;
  end if;
  return old;
end;
$$;

drop trigger if exists mogu_group_member_left on public.group_members;
create trigger mogu_group_member_left
  after delete on public.group_members
  for each row execute function public.mogu_group_member_left();


-- -------------------------------------------------------------
-- ⑨ 新しいメンバーの参加を通知する（招待コードでの参加）
--    join_group_by_code（グループの不具合の修正・0回目で作成）を置き換えて、通知と last_activity_at を足す
-- -------------------------------------------------------------
create or replace function public.join_group_by_code(p_code text)
returns table (group_id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_expires_at timestamptz;
  v_is_anon boolean;
  v_joined boolean;
begin
  if auth.uid() is null then
    raise exception 'guest account cannot join';
  end if;

  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) into v_is_anon;
  if v_is_anon then
    raise exception 'guest account cannot join';
  end if;

  select i.group_id, i.expires_at into v_group_id, v_expires_at
  from public.invites i
  where i.token = p_code
  limit 1;

  if v_group_id is null then
    raise exception 'invite not found';
  end if;

  if v_expires_at <= now() then
    raise exception 'invite expired';
  end if;

  v_joined := not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.user_id = auth.uid()
  );

  insert into public.group_members (group_id, user_id)
  select v_group_id, auth.uid()
  where v_joined;

  update public.invites set used_at = coalesce(used_at, now()) where token = p_code;

  if v_joined then
    perform public.mogu_notify_member_joined(v_group_id, auth.uid());
  end if;

  return query select g.id, g.name from public.groups g where g.id = v_group_id;
end;
$$;

revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;


-- -------------------------------------------------------------
-- ⑩ 招待を受けた人にも、招待した人のプロフィール（パス）を見せる（get_profile_view の拡張）
-- -------------------------------------------------------------
create or replace function public.get_profile_view(p_user uuid default null, p_handle text default null)
returns table (
  id uuid, handle text, display_name text, bio text, avatar_path text,
  type_code text, character_name text, linked_at timestamptz,
  blocked boolean, blocked_by_me boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  t public.profiles%rowtype;
  is_blocked boolean;
  by_me boolean;
  v_invited boolean;
begin
  if me is null then
    return;
  end if;
  if p_handle is not null then
    if not public.mogu_rate_ok('find_handle', 30, 60) then
      raise exception 'rate_limited';
    end if;
    select * into t from public.profiles where lower(profiles.handle) = lower(trim(p_handle));
  elsif p_user is not null then
    select * into t from public.profiles where profiles.id = p_user;
    if t.id is not null and t.id <> me then
      v_invited := exists (
        select 1 from public.group_invites gi
        where gi.status = 'pending' and (
          (gi.invitee_id = me and gi.inviter_id = t.id) or (gi.inviter_id = me and gi.invitee_id = t.id)
        )
      );
      -- IDを知らない人は、同じグループのメンバーか、招待のやり取りがある人だけ
      if not public.mogu_shares_group(me, t.id) and not v_invited then
        return;
      end if;
    end if;
  end if;
  if t.id is null or public.mogu_is_guest(t.id) then
    return;
  end if;

  by_me := exists (select 1 from public.blocks where blocker_id = me and blocked_id = t.id);
  is_blocked := t.id <> me and public.mogu_blocked_between(me, t.id);
  -- ブロックされている人がIDで探しても見つからない（ブロックした人は、自分の一覧から開ける）
  if is_blocked and not by_me and p_handle is not null then
    return;
  end if;
  if is_blocked then
    return query select t.id, t.handle, null::text, null::text, null::text, null::text, null::text, null::timestamptz, true, by_me;
    return;
  end if;
  return query select t.id, t.handle, t.display_name, t.bio, t.avatar_path,
    t.mogu_type_code, t.mogu_type_character_name, t.mogu_type_linked_at, false, false;
end;
$$;

revoke all on function public.get_profile_view(uuid, text) from public, anon;
grant execute on function public.get_profile_view(uuid, text) to authenticated;


-- -------------------------------------------------------------
-- ⑪ 通知の一覧・既読
-- -------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any(p_ids));
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

create or replace function public.mark_notif_prompted()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set notif_prompted_at = now() where id = auth.uid();
$$;
revoke all on function public.mark_notif_prompted() from public, anon;
grant execute on function public.mark_notif_prompted() to authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
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


-- -------------------------------------------------------------
-- ⑫ 並び順の集計：同じモグタイプに人気／急上昇中（§7-7）
--    毎回数え直さず、集計した表（materialized view）を定期的に作り直す
-- -------------------------------------------------------------
create materialized view if not exists public.mogu_restaurant_popularity as
select restaurant_id, mogu_type_code, count(*)::int as like_count
from public.swipes
where action = 'like' and mogu_type_code is not null
group by restaurant_id, mogu_type_code;

create unique index if not exists mogu_restaurant_popularity_key on public.mogu_restaurant_popularity (restaurant_id, mogu_type_code);

create materialized view if not exists public.mogu_restaurant_trending as
select restaurant_id, count(*)::int as like_count
from public.swipes
where action = 'like' and created_at > now() - interval '7 days'
group by restaurant_id;

create unique index if not exists mogu_restaurant_trending_key on public.mogu_restaurant_trending (restaurant_id);

create or replace function public.refresh_restaurant_popularity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mogu_restaurant_popularity;
  refresh materialized view concurrently public.mogu_restaurant_trending;
exception when others then
  -- 初回などユニークインデックスがまだ無い／行が無いときは concurrently が使えないので、ふつうに作り直す
  refresh materialized view public.mogu_restaurant_popularity;
  refresh materialized view public.mogu_restaurant_trending;
end;
$$;
revoke all on function public.refresh_restaurant_popularity() from public, anon, authenticated;

-- 「同じモグタイプに人気」：p_type は4文字のモグタイプのコード（例 VNBP）
create or replace function public.get_popular_restaurant_ids(p_type text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.mogu_restaurant_popularity
  where mogu_type_code = p_type
  order by like_count desc;
$$;
revoke all on function public.get_popular_restaurant_ids(text) from public, anon;
grant execute on function public.get_popular_restaurant_ids(text) to authenticated;

-- 「急上昇中」：直近7日のいいねが多い順
create or replace function public.get_trending_restaurant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.mogu_restaurant_trending
  order by like_count desc;
$$;
revoke all on function public.get_trending_restaurant_ids() from public, anon;
grant execute on function public.get_trending_restaurant_ids() to authenticated;

-- 集計の定期更新（pg_cron）。初回だけ手動での有効化が要ることがあります：
--   Supabase ダッシュボード → Database → Extensions → pg_cron を有効にしてから、
--   このファイルをもう一度 SQL Editor で実行してください（下のブロックだけで良い）
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('mogu-refresh-popularity') from cron.job where jobname = 'mogu-refresh-popularity';
    perform cron.schedule('mogu-refresh-popularity', '0 * * * *', 'select public.refresh_restaurant_popularity();');
  end if;
end $$;
