-- =============================================================
-- 1回目（デザイン更新 1.2）で使う列と関数
--   何度実行しても同じ結果になる書き方（if not exists / create or replace）
--   グループの不具合の修正（join_group_by_code など）は別のファイル
-- =============================================================

-- ① スワイプの記録：ひとりかグループかの区別・保存から外した印・日時（実装計画 6章 #8・#9）
--    今までのいいねは group_id が空＝「ひとり」とみなす
alter table public.swipes add column if not exists group_id uuid;
alter table public.swipes add column if not exists hidden_from_saved boolean not null default false;
alter table public.swipes add column if not exists created_at timestamptz not null default now();
create index if not exists swipes_user_saved_idx on public.swipes (user_id, action) where group_id is null and hidden_from_saved = false;

-- 自分のスワイプの「外した印」を変えられるように（自分の行だけ）
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'swipes' and cmd = 'UPDATE') then
    create policy swipes_update_own on public.swipes for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ② お店：写真（最大10枚）と電話番号（places-search が保存する）
alter table public.restaurants add column if not exists photos jsonb;
alter table public.restaurants add column if not exists phone text;

-- ③ 参加中のグループ（探し方のシート・グループの一覧）：人数とメンバー4人までの名前
--    呼んだ本人がメンバーのグループだけ。メールアドレスなどは返さない
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
      select jsonb_agg(jsonb_build_object('id', x.id, 'display_name', x.display_name, 'food_style', x.food_style))
      from (
        select p.id, p.display_name, p.food_style
        from public.group_members m2
        join public.profiles p on p.id = m2.user_id
        where m2.group_id = g.id
        limit 4
      ) x
    ), '[]'::jsonb) as members,
    g.created_at
  from public.groups g
  where exists (select 1 from public.group_members me where me.group_id = g.id and me.user_id = auth.uid())
  order by g.created_at desc;
$$;

revoke all on function public.get_my_groups() from public, anon;
grant execute on function public.get_my_groups() to authenticated;
