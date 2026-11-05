-- =============================================================
-- グループの招待コードで参加できない不具合の修正
--
-- 原因：
--   invites テーブルの SELECT の RLS ルール（invites group members）が
--   「すでにそのグループのメンバーであること」を求める作りになっていた。
--   しかしコードで参加しようとしている人は、参加する前はまだメンバーではないため、
--   自分が入ろうとしているグループの招待を一件も読めず、
--   毎回「コードが見つかりません」になっていた。
--
-- 直し方：
--   招待コードの確認・参加だけを、RLSを経由しない安全な関数（SECURITY DEFINER）にする。
--   groups / group_members / invites 本体のRLSは変えない
--   （一覧やメンバーの読み書きは今のルールのまま。関数の中だけ必要な行に限って読み書きする）。
--
-- 何度実行しても同じ結果になります（create or replace）。
-- =============================================================

-- 招待コードの確認（参加する前の「このグループに参加しますか」の画面で使う）。
-- ログインしていれば、まだメンバーでなくても呼べる。コードが無効なら空を返す（誰のグループか分からない形にする）
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

  select i.group_id into v_group_id
  from public.invites i
  where i.token = p_code
    and i.expires_at > now()
  limit 1;

  if v_group_id is null then
    return;
  end if;

  return query
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
    ), '[]'::jsonb) as members
  from public.groups g
  where g.id = v_group_id;
end;
$$;

revoke all on function public.preview_group_by_code(text) from public, anon;
grant execute on function public.preview_group_by_code(text) to authenticated;


-- 招待コードで参加する。
-- 戻り値：参加したグループの id と name。
-- エラーメッセージは呼び出し側（src/lib/groups.js）が文字で判定するので、文言を変えないこと
--   「not found」→ コードが見つからない／「expired」→ 期限切れ／「guest」「anonymous」→ ゲストは参加不可
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

  insert into public.group_members (group_id, user_id)
  select v_group_id, auth.uid()
  where not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.user_id = auth.uid()
  );

  update public.invites set used_at = coalesce(used_at, now()) where token = p_code;

  return query select g.id, g.name from public.groups g where g.id = v_group_id;
end;
$$;

revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;
