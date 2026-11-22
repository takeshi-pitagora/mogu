-- =====================================================================
-- 第5回 直し21：get_my_groups を確実に新しい形にする
--
--   get_my_groups は 1回目で5列、3回目と4回目で10列に増やしているが、
--   どちらも create or replace のままだった。Postgres は
--   create or replace で「返す列」を増やせないので、
--     ERROR: cannot change return type of existing function
--   となって、3回目・4回目の版が当たっていないDBがありうる。
--   その場合こうなる：
--     ・グループの「固定」「ミュート」が押しても効かない（列が返らない）
--     ・新着の件数・最後のできごとが出ない
--     ・メンバーの表示が古い20問診断のままになる（4回目の直しが未適用）
--
--   ここでは一度 drop してから作り直すので、どの状態のDBでも最後は同じ形になる。
--   20261122_round5_fix20.sql のあとに、1回だけ実行してください
-- =====================================================================

drop function if exists public.get_my_groups();

create function public.get_my_groups()
returns table (
  id uuid, name text, member_count int, members jsonb, created_at timestamptz,
  pinned boolean, muted boolean, last_activity_at timestamptz, unseen_count int, last_event text
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name,
    (select count(*)::int from public.group_members m where m.group_id = g.id) as member_count,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', p.id,
               'display_name', p.display_name,
               'handle', p.handle,
               'avatar_path', p.avatar_path,
               'mogu_type_code', p.mogu_type_code
             ) order by m2.joined_at), '[]'::jsonb)
        from public.group_members m2
        join public.profiles p on p.id = m2.user_id
       where m2.group_id = g.id
    ) as members,
    g.created_at,
    me.pinned, me.muted, g.last_activity_at,
    (
      select count(*)::int
        from public.group_shops gs
       where gs.group_id = g.id
         and not exists (select 1 from public.group_seen s where s.group_id = g.id and s.restaurant_id = gs.restaurant_id and s.user_id = auth.uid())
    ) as unseen_count,
    (
      select case
        when count(*) = 0 then null
        else '新しいお店が' || count(*) || '件'
      end
      from public.group_shops gs2
      join public.restaurants r on r.id = gs2.restaurant_id
      where gs2.group_id = g.id and gs2.created_at > now() - interval '7 days'
        and not exists (select 1 from public.group_seen s2 where s2.group_id = g.id and s2.restaurant_id = gs2.restaurant_id and s2.user_id = auth.uid())
    ) as last_event
  from public.groups g
  join public.group_members me on me.group_id = g.id and me.user_id = auth.uid()
  order by me.pinned desc, g.last_activity_at desc nulls last, g.created_at desc;
$$;

revoke all on function public.get_my_groups() from public, anon;
grant execute on function public.get_my_groups() to authenticated;

comment on function public.get_my_groups() is
  'グループの一覧（固定・ミュート・新着の件数つき）。fix21 で drop してから作り直した';
