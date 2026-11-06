-- =============================================================
-- 2回目（プロフィールと安全）で使う表・列・関数・ルール
--   引き渡し書 §7-1（ユーザーID）・§7-2（プロフィール）・§7-3（ブロック・通報・使えない言葉）・§7-4（モグタイプ連携 v2 §4-7）
--   何度実行しても同じ結果になる書き方（if not exists / create or replace）
--   SQL Editor でまとめて1回実行する
-- =============================================================


-- -------------------------------------------------------------
-- ① プロフィールに足す列
-- -------------------------------------------------------------
alter table public.profiles add column if not exists handle text;                         -- ユーザーID（小文字で保存）
alter table public.profiles add column if not exists handle_changed_at timestamptz;       -- 本人がIDを決めた・変えた日時（2週間に1回の判定）
alter table public.profiles add column if not exists handle_confirmed boolean not null default false; -- 本人が決めたIDか（false＝仮のID）
alter table public.profiles add column if not exists handle_prompted_at timestamptz;      -- 「IDを決めよう」を出した日時（1度だけ出す）
alter table public.profiles add column if not exists bio text;                            -- 自己紹介（70文字・改行4回まで）
alter table public.profiles add column if not exists avatar_path text;                    -- 写真（Storage の avatars の中の場所）
alter table public.profiles add column if not exists invite_scope text not null default 'anyone'; -- 招待を受け取る範囲 anyone / none

-- モグタイプ連携（連携仕様 v2 §4-7 のまま。マイページコードの列は作らない）
alter table public.profiles add column if not exists mogu_type_friend_code text;
alter table public.profiles add column if not exists mogu_type_code text;
alter table public.profiles add column if not exists mogu_type_character_name text;
alter table public.profiles add column if not exists mogu_type_axis_values jsonb;
alter table public.profiles add column if not exists mogu_type_nickname text;
alter table public.profiles add column if not exists mogu_type_completed_at timestamptz;
alter table public.profiles add column if not exists mogu_type_linked_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_invite_scope_check') then
    alter table public.profiles add constraint profiles_invite_scope_check check (invite_scope in ('anyone', 'none'));
  end if;
end $$;

-- IDは小文字にそろえた値で一意（Kento と kento は同じID）
create unique index if not exists profiles_handle_lower_key on public.profiles (lower(handle)) where handle is not null;

-- グループに入った日時（いちばん早く入った人に引き継ぐときに使う。今までの行は、この更新の日時になる）
alter table public.group_members add column if not exists joined_at timestamptz not null default now();


-- -------------------------------------------------------------
-- ② 言葉の表：使えないID・使えない言葉
--    運営があとから Supabase の Table Editor で足せる（word は小文字・ひらがなで入れる）
-- -------------------------------------------------------------
create table if not exists public.reserved_handles (
  word text primary key,
  match text not null default 'exact' check (match in ('exact', 'contains'))  -- exact＝同じとき、contains＝含むとき
);
alter table public.reserved_handles enable row level security;

create table if not exists public.banned_words (
  word text primary key  -- mogu_norm() をかけた形（英字は小文字・カタカナはひらがな・空白や記号なし）
);
alter table public.banned_words enable row level security;
-- どちらの表も、アプリからは直接読めない（読み書きのルールを作らない）。確かめるのは下の関数だけ

insert into public.reserved_handles (word, match) values
  ('mogu', 'exact'), ('moguapp', 'exact'), ('mogu_app', 'exact'), ('mogujp', 'exact'), ('mogu_jp', 'exact'),
  ('help', 'exact'), ('info', 'exact'), ('contact', 'exact'), ('team', 'exact'), ('system', 'exact'), ('root', 'exact'),
  ('settings', 'exact'), ('profile', 'exact'), ('guest', 'exact'), ('user', 'exact'), ('users', 'exact'),
  ('null', 'exact'), ('undefined', 'exact'), ('api', 'exact'), ('www', 'exact'), ('app', 'exact'), ('appstore', 'exact'),
  ('apple', 'exact'), ('google', 'exact'),
  ('mogutype', 'contains'), ('mogu_type', 'contains'), ('mogusync', 'contains'), ('mogu_sync', 'contains'),
  ('official', 'contains'), ('admin', 'contains'), ('support', 'contains'), ('staff', 'contains'),
  ('moderator', 'contains'), ('operator', 'contains'), ('unei', 'contains')
on conflict (word) do nothing;

-- 使えない言葉（最初のリスト）。ふつうの言葉に含まれてしまう語は入れていない
--   例：しね→シネマ、くそ→くそうまい、ころす→いいところすぎる、ふぇら→フェラーリ、shit→shitake（しいたけ）
insert into public.banned_words (word) values
  -- 性的な言葉
  ('ちんこ'), ('ちんぽ'), ('まんこ'), ('せっくす'), ('ふぇらちお'), ('ぱいずり'), ('おなにー'), ('なかだし'),
  ('強姦'), ('痴漢'), ('売春'), ('ばいしゅん'), ('援交'), ('ぱぱかつ'), ('精液'), ('せいえき'), ('射精'), ('巨乳'),
  ('きょにゅう'), ('爆乳'), ('おっぱい'), ('陰茎'), ('膣'), ('肉便器'), ('にくべんき'),
  ('chinko'), ('chinpo'), ('manko'), ('sekkusu'), ('sex'), ('porn'), ('pussy'), ('penis'), ('vagina'), ('nude'),
  ('hentai'), ('dildo'), ('slut'), ('whore'), ('xxx'), ('onlyfans'), ('boobs'), ('milf'),
  -- 人を傷つける言葉
  ('死ね'), ('氏ね'), ('殺す'), ('ぶっころ'), ('ぶっ殺'), ('殺害'), ('きちがい'), ('基地外'), ('気違い'), ('池沼'),
  ('白痴'), ('低能'), ('土人'), ('つんぼ'),
  ('fuck'), ('bullshit'), ('bitch'), ('cunt'), ('nigger'), ('nigga'), ('faggot'), ('retard'), ('asshole'), ('bastard'),
  ('rapist'), ('killyourself'), ('nazi'), ('hitler'), ('korosu'), ('kichigai'),
  -- 違法・危険なこと
  ('覚醒剤'), ('かくせいざい'), ('大麻'), ('麻薬'), ('脱法'), ('闇ばいと'), ('やみばいと'), ('殺人'), ('さつじん'), ('cocaine')
on conflict (word) do nothing;


-- -------------------------------------------------------------
-- ③ 言葉を確かめる関数
-- -------------------------------------------------------------
-- 形をそろえる：全角→半角（NFKC）・小文字・カタカナ→ひらがな・空白と記号を消す
create or replace function public.mogu_norm(t text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(normalize(coalesce(t, ''), NFKC)),
      'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ',
      'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ'
    ),
    '[[:space:][:punct:]・、。「」『』（）［］【】！？〜～＿－]', '', 'g'
  );
$$;

-- 使えない言葉が含まれているか（どの言葉かは返さない）
create or replace function public.mogu_has_banned(t text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t, '') <> '' and exists (
    select 1 from public.banned_words b
    where b.word <> '' and position(b.word in public.mogu_norm(t)) > 0
  );
$$;

-- アプリが入力中に呼ぶ：使えない言葉が含まれていれば true（どの言葉かは返さない）
create or replace function public.check_text(p_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mogu_has_banned(left(coalesce(p_text, ''), 1000));
$$;

-- 運営と見間違えやすいID
create or replace function public.mogu_is_reserved_handle(h text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reserved_handles r
    where (r.match = 'exact' and r.word = h)
       or (r.match = 'contains' and position(r.word in h) > 0)
  );
$$;


-- -------------------------------------------------------------
-- ④ 短い時間に何度も呼べないようにする（IDの確認・IDでの検索）
-- -------------------------------------------------------------
create table if not exists public.rate_events (
  key text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_key_idx on public.rate_events (kind, key, at);
alter table public.rate_events enable row level security;

create or replace function public.mogu_rate_ok(p_kind text, p_limit int, p_window_secs int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_count int;
begin
  -- ログイン中は利用者ごと、登録前（新規登録の画面）は通信元ごとに数える
  v_key := coalesce(
    auth.uid()::text,
    split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1)
  );
  delete from public.rate_events where at < now() - interval '1 hour';
  select count(*) into v_count from public.rate_events
   where kind = p_kind and key = v_key and at > now() - make_interval(secs => p_window_secs);
  if v_count >= p_limit then
    return false;
  end if;
  insert into public.rate_events (key, kind) values (v_key, p_kind);
  return true;
end;
$$;


-- -------------------------------------------------------------
-- ⑤ 古いID（変えたあと14日間はほかの人が取れない）
-- -------------------------------------------------------------
create table if not exists public.handle_history (
  handle text primary key,
  user_id uuid not null,
  released_at timestamptz not null default now()
);
alter table public.handle_history enable row level security;


-- -------------------------------------------------------------
-- ⑥ ゲストか（メールアドレスを付けている途中のゲストは、登録した人とみなす）
-- -------------------------------------------------------------
create or replace function public.mogu_is_guest(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((
    select coalesce(u.is_anonymous, false) and u.email is null and coalesce(u.email_change, '') = ''
    from auth.users u where u.id = uid
  ), false);
$$;


-- -------------------------------------------------------------
-- ⑦ IDの決まり（§7-1）
-- -------------------------------------------------------------
-- 形：英小文字・数字・_ の4〜20文字。最初は英小文字か数字
create or replace function public.mogu_handle_format_ok(h text)
returns boolean
language sql
immutable
as $$
  select h ~ '^[a-z0-9][a-z0-9_]{3,19}$';
$$;

-- 仮のID（user_ と英数字8文字）。重ならないものを作る
create or replace function public.mogu_temp_handle()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  loop
    v := 'user_' || substr(md5(gen_random_uuid()::text), 1, 8);
    exit when not exists (select 1 from public.profiles where lower(handle) = v)
          and not exists (select 1 from public.handle_history where handle = v);
  end loop;
  return v;
end;
$$;

-- 入力中の確認（目安。最後は保存の時点でサーバーが決める）
--   返す値 status：ok / same / taken / format / reserved / banned / cooldown / rate、cooldown のとき next_at
create or replace function public.check_handle(p_handle text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  h text := lower(trim(coalesce(p_handle, '')));
  me uuid := auth.uid();
  my public.profiles%rowtype;
begin
  if not public.mogu_rate_ok('check_handle', 30, 60) then
    return jsonb_build_object('status', 'rate');
  end if;
  if me is not null then
    select * into my from public.profiles where id = me;
    if my.id is not null and lower(coalesce(my.handle, '')) = h then
      return jsonb_build_object('status', 'same');
    end if;
    if my.id is not null and my.handle_confirmed and my.handle_changed_at is not null
       and my.handle_changed_at > now() - interval '14 days' then
      return jsonb_build_object('status', 'cooldown', 'next_at', my.handle_changed_at + interval '14 days');
    end if;
  end if;
  if not public.mogu_handle_format_ok(h) then
    return jsonb_build_object('status', 'format');
  end if;
  if public.mogu_is_reserved_handle(h) then
    return jsonb_build_object('status', 'reserved');
  end if;
  if public.mogu_has_banned(h) then
    return jsonb_build_object('status', 'banned');
  end if;
  if exists (select 1 from public.profiles p where lower(p.handle) = h and (me is null or p.id <> me))
     or exists (select 1 from public.handle_history x where x.handle = h and x.released_at > now() - interval '14 days' and (me is null or x.user_id <> me)) then
    return jsonb_build_object('status', 'taken');
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.check_handle(text) from public;
grant execute on function public.check_handle(text) to anon, authenticated;
revoke all on function public.check_text(text) from public;
grant execute on function public.check_text(text) to anon, authenticated;


-- -------------------------------------------------------------
-- ⑧ プロフィールの見張り役（アプリを通さずにサーバーへ送っても弾く）
--    エラーの文字（handle_format など）はアプリが見て、画面の言葉に直す
-- -------------------------------------------------------------
create or replace function public.mogu_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  by_user boolean := auth.uid() is not null and auth.uid() = new.id;  -- 本人が変えようとしている
  handle_changed boolean;
  name_changed boolean;
  bio_changed boolean;
  avatar_changed boolean;
begin
  if tg_op = 'INSERT' then
    handle_changed := new.handle is not null;
    name_changed := new.display_name is not null;
    bio_changed := new.bio is not null;
    avatar_changed := new.avatar_path is not null;
  else
    handle_changed := new.handle is distinct from old.handle;
    name_changed := new.display_name is distinct from old.display_name;
    bio_changed := new.bio is distinct from old.bio;
    avatar_changed := new.avatar_path is distinct from old.avatar_path;
    -- IDを決めた日時・本人が決めたかは、アプリから直接は変えられない
    if by_user then
      new.handle_changed_at := old.handle_changed_at;
      new.handle_confirmed := old.handle_confirmed;
    end if;
  end if;

  -- ゲストは写真・ID・自己紹介を使えない（§7-8）
  if by_user and public.mogu_is_guest(new.id) and (handle_changed or bio_changed or avatar_changed) then
    raise exception 'guest_not_allowed';
  end if;

  if handle_changed and new.handle is not null then
    new.handle := lower(trim(new.handle));
    if not public.mogu_handle_format_ok(new.handle) then
      raise exception 'handle_format';
    end if;
    if public.mogu_is_reserved_handle(new.handle) and new.handle !~ '^user_[0-9a-f]{8}$' then
      raise exception 'handle_reserved';
    end if;
    if public.mogu_has_banned(new.handle) then
      raise exception 'banned_word';
    end if;
    if exists (select 1 from public.handle_history x
               where x.handle = new.handle and x.user_id <> new.id and x.released_at > now() - interval '14 days') then
      raise exception 'handle_taken';
    end if;
    if tg_op = 'UPDATE' and by_user then
      -- 2週間に1回（仮のIDから初めて決めるときは待たなくてよい）
      if old.handle_confirmed and old.handle_changed_at is not null and old.handle_changed_at > now() - interval '14 days' then
        raise exception 'handle_cooldown';
      end if;
      new.handle_changed_at := now();
      new.handle_confirmed := true;
    end if;
    if tg_op = 'UPDATE' and old.handle is not null then
      insert into public.handle_history (handle, user_id, released_at)
      values (lower(old.handle), new.id, now())
      on conflict (handle) do update set user_id = excluded.user_id, released_at = excluded.released_at;
    end if;
  elsif handle_changed and new.handle is null and tg_op = 'UPDATE' and by_user then
    raise exception 'handle_format';  -- 本人がIDを空にはできない
  end if;

  if name_changed then
    new.display_name := trim(coalesce(new.display_name, ''));
    if by_user and new.display_name = '' then
      raise exception 'nickname_empty';
    end if;
    if char_length(new.display_name) > 9 then
      if by_user then
        raise exception 'nickname_too_long';
      end if;
      new.display_name := left(new.display_name, 9);  -- 登録のときにアプリ以外から長い名前が来たときは切る
    end if;
    if public.mogu_has_banned(new.display_name) then
      raise exception 'banned_word';
    end if;
  end if;

  if bio_changed and new.bio is not null then
    if char_length(new.bio) > 70 then
      raise exception 'bio_too_long';
    end if;
    if (char_length(new.bio) - char_length(replace(new.bio, E'\n', ''))) > 4 then
      raise exception 'bio_too_many_lines';
    end if;
    if public.mogu_has_banned(new.bio) then
      raise exception 'banned_word';
    end if;
  end if;

  if avatar_changed and new.avatar_path is not null and by_user then
    -- 写真は自分のフォルダの中だけ
    if split_part(new.avatar_path, '/', 1) <> new.id::text then
      raise exception 'avatar_path';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists mogu_profiles_guard on public.profiles;
create trigger mogu_profiles_guard
  before insert or update on public.profiles
  for each row execute function public.mogu_profiles_guard();


-- -------------------------------------------------------------
-- ⑨ 今の利用者に仮のIDを付ける（ゲストは付けない。IDは登録するときに決める）
--    次に開いたとき「IDを決めよう」を1度だけ出す
-- -------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.id from public.profiles p
    join auth.users u on u.id = p.id
    where p.handle is null
      and not (coalesce(u.is_anonymous, false) and u.email is null)
  loop
    update public.profiles set handle = public.mogu_temp_handle(), handle_confirmed = false where id = r.id;
  end loop;
end $$;


-- -------------------------------------------------------------
-- ⑩ ブロック
-- -------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- 2人のどちらかがブロックしているか
create or replace function public.mogu_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- 2人が同じグループにいるか
create or replace function public.mogu_shares_group(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members x
    join public.group_members y on y.group_id = x.group_id
    where x.user_id = a and y.user_id = b
  );
$$;

create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_user is null or p_user = auth.uid() then
    raise exception 'invalid';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user)
  on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

-- 設定の「ブロックしたユーザー」：写真・ニックネーム・@ID（新しい順）
create or replace function public.list_blocked()
returns table (id uuid, handle text, display_name text, avatar_path text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name, p.avatar_path, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.unblock_user(uuid) to authenticated;
revoke all on function public.list_blocked() from public, anon;
grant execute on function public.list_blocked() to authenticated;


-- -------------------------------------------------------------
-- ⑪ プロフィールが見える範囲（§7-2）
--    自分、同じグループのメンバー（ブロックしていない）だけが、表から直接読める。
--    IDを完全一致で入れた人は、下の get_profile_view を通して読む
-- -------------------------------------------------------------
alter table public.profiles enable row level security;

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy profiles_select_visible on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (public.mogu_shares_group(auth.uid(), id) and not public.mogu_blocked_between(auth.uid(), id))
  );
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ほかの人のプロフィール（③の「ほかの人から見た形」・⑬のブロック中の形）
--   p_user：同じグループのメンバーを開くとき／p_handle：IDを完全一致で入れたとき（QR など）
--   ブロックしている・されているときは、IDとブロックの印だけ返す
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
    -- IDを知らない人は、同じグループのメンバーだけ
    if t.id is not null and t.id <> me and not public.mogu_shares_group(me, t.id) then
      return;
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
-- ⑫ 「IDを決めよう」を出したことを残す（1度だけ出すため）
-- -------------------------------------------------------------
create or replace function public.mark_handle_prompted()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set handle_prompted_at = now() where id = auth.uid() and handle_prompted_at is null;
$$;
revoke all on function public.mark_handle_prompted() from public, anon;
grant execute on function public.mark_handle_prompted() to authenticated;


-- -------------------------------------------------------------
-- ⑬ 通報（§7-3）。運営へのメールは Edge Function「report-notify」が送る
-- -------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,  -- 削除したあとも通報の記録は残す（§10 の提案）
  kind text not null check (kind in ('user', 'group', 'general')),
  target_user_id uuid,
  target_group_id uuid,
  target_handle text,           -- 設定の「通報したい内容がある」で入れた相手のID
  reason text not null,
  detail text,
  screenshot_paths text[] not null default '{}',
  snapshot jsonb,               -- 通報したときの相手の名前・ID・自己紹介・写真の場所／グループ名（あとで消されても運営が確かめられる）
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
-- アプリからは読めない・直接は書けない（下の関数を通す）。運営は Supabase の Table Editor で見る

create or replace function public.submit_report(
  p_kind text, p_reason text, p_detail text default null,
  p_target_user uuid default null, p_target_group uuid default null, p_target_handle text default null,
  p_screenshots text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
  v_snap jsonb;
  v_target uuid := p_target_user;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  if not public.mogu_rate_ok('report', 10, 600) then
    raise exception 'rate_limited';
  end if;
  if p_kind not in ('user', 'group', 'general') or coalesce(trim(p_reason), '') = '' then
    raise exception 'invalid';
  end if;
  if char_length(coalesce(p_detail, '')) > 1000 then
    raise exception 'detail_too_long';
  end if;
  if coalesce(array_length(p_screenshots, 1), 0) > 3 then
    raise exception 'too_many_screenshots';
  end if;
  if exists (select 1 from unnest(coalesce(p_screenshots, '{}')) s where split_part(s, '/', 1) <> me::text) then
    raise exception 'invalid_screenshot';
  end if;

  if v_target is null and coalesce(trim(p_target_handle), '') <> '' then
    select id into v_target from public.profiles where lower(handle) = lower(trim(replace(p_target_handle, '@', '')));
  end if;
  if v_target is not null then
    select jsonb_build_object('handle', handle, 'display_name', display_name, 'bio', bio, 'avatar_path', avatar_path)
      into v_snap from public.profiles where id = v_target;
  elsif p_target_group is not null then
    select jsonb_build_object('group_name', name) into v_snap from public.groups where id = p_target_group;
  end if;

  insert into public.reports (reporter_id, kind, target_user_id, target_group_id, target_handle, reason, detail, screenshot_paths, snapshot)
  values (me, p_kind, v_target, p_target_group, nullif(trim(p_target_handle), ''), p_reason, nullif(trim(coalesce(p_detail, '')), ''),
          coalesce(p_screenshots, '{}'), v_snap)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_report(text, text, text, uuid, uuid, text, text[]) from public, anon;
grant execute on function public.submit_report(text, text, text, uuid, uuid, text, text[]) to authenticated;


-- -------------------------------------------------------------
-- ⑭ グループ名：20文字まで・使えない言葉。ゲストはグループを作れない（サーバーでも確かめる）
-- -------------------------------------------------------------
create or replace function public.mogu_groups_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null and public.mogu_is_guest(auth.uid()) then
    raise exception 'guest_not_allowed';
  end if;
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    new.name := trim(coalesce(new.name, ''));
    if new.name = '' then
      raise exception 'group_name_empty';
    end if;
    if char_length(new.name) > 20 then
      raise exception 'group_name_too_long';
    end if;
    if public.mogu_has_banned(new.name) then
      raise exception 'banned_word';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mogu_groups_guard on public.groups;
create trigger mogu_groups_guard
  before insert or update on public.groups
  for each row execute function public.mogu_groups_guard();


-- -------------------------------------------------------------
-- ⑮ 写真とスクリーンショットの置き場所（Storage）
--    avatars：プロフィールの写真。ファイル名は毎回ちがう長い名前（一覧は取れない）。本人のフォルダにだけ書ける
--    report-screenshots：通報のスクリーンショット。運営だけが読める（アプリからは書くだけ）
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-screenshots', 'report-screenshots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mogu_avatars_select_own on storage.objects;
create policy mogu_avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists mogu_avatars_insert_own on storage.objects;
create policy mogu_avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and not public.mogu_is_guest(auth.uid()));
drop policy if exists mogu_avatars_delete_own on storage.objects;
create policy mogu_avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists mogu_reportshots_insert_own on storage.objects;
create policy mogu_reportshots_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'report-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);


-- -------------------------------------------------------------
-- ⑯ グループの関数を、新しい列（モグタイプ連携・写真・ID・ブロック）で返すように直す
--    今のアプリの20問の結果（food_style・food_axes）は使わない＝未診断に戻る（決定済み）。列とデータは消さない
-- -------------------------------------------------------------
create or replace function public.get_my_groups()
returns table (id uuid, name text, member_count int, members jsonb, created_at timestamptz)
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
    g.created_at
  from public.groups g
  where exists (select 1 from public.group_members me where me.group_id = g.id and me.user_id = auth.uid())
  order by g.created_at desc;
$$;

drop function if exists public.get_group_member_types(uuid);
create function public.get_group_member_types(gid uuid)
returns table (id uuid, display_name text, avatar text, food_style text, food_axes jsonb, handle text, avatar_path text, blocked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         case when public.mogu_blocked_between(auth.uid(), p.id) then null else p.display_name end,
         null::text,
         p.mogu_type_code,
         p.mogu_type_axis_values,
         p.handle,
         case when public.mogu_blocked_between(auth.uid(), p.id) then null else p.avatar_path end,
         public.mogu_blocked_between(auth.uid(), p.id)
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = gid
    and exists (select 1 from public.group_members me where me.group_id = gid and me.user_id = auth.uid())
  order by gm.joined_at;
$$;
revoke all on function public.get_group_member_types(uuid) from public, anon;
grant execute on function public.get_group_member_types(uuid) to authenticated;

create or replace function public.get_group_peers()
returns table (id uuid, display_name text, avatar text, food_style text, food_axes jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.display_name, null::text, p.mogu_type_code, p.mogu_type_axis_values
  from public.group_members me
  join public.group_members gm on gm.group_id = me.group_id and gm.user_id <> me.user_id
  join public.profiles p on p.id = gm.user_id
  where me.user_id = auth.uid()
    and not public.mogu_blocked_between(auth.uid(), p.id);
$$;

create or replace function public.preview_group_by_code(p_code text)
returns table (id uuid, name text, member_count int, members jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'guest account cannot preview invite';
  end if;
  select i.group_id into v_group_id from public.invites i where i.token = p_code and i.expires_at > now() limit 1;
  if v_group_id is null then
    return;
  end if;
  return query
  select g.id, g.name,
    (select count(*)::int from public.group_members m where m.group_id = g.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'display_name', x.display_name, 'food_style', x.mogu_type_code, 'avatar_path', x.avatar_path))
      from (
        select p.id, p.display_name, p.mogu_type_code,
               case when public.mogu_blocked_between(auth.uid(), p.id) then null else p.avatar_path end as avatar_path
        from public.group_members m2 join public.profiles p on p.id = m2.user_id
        where m2.group_id = g.id order by m2.joined_at limit 4
      ) x
    ), '[]'::jsonb)
  from public.groups g where g.id = v_group_id;
end;
$$;

-- ゲストはコードで参加できない（今の join_group_by_code と同じ判定に、メールを付けている途中のゲストを足す）
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
  insert into public.group_members (group_id, user_id)
  select v_group_id, auth.uid()
  where not exists (select 1 from public.group_members gm where gm.group_id = v_group_id and gm.user_id = auth.uid());
  update public.invites set used_at = coalesce(used_at, now()) where token = p_code;
  return query select g.id, g.name from public.groups g where g.id = v_group_id;
end;
$$;
revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;
