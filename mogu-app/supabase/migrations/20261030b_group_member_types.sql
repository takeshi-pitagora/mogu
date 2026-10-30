-- グループのおすすめ度（スワイプカード右上の％）で使う関数。
-- 指定したグループのメンバー全員（自分を含む）の、タイプ・4軸だけを返す。
-- 呼んだ本人がそのグループのメンバーでなければ、何も返さない。メールアドレスなどは返さない。

alter table public.profiles add column if not exists food_axes jsonb;

create or replace function public.get_group_member_types(gid uuid)
returns table (id uuid, display_name text, avatar text, food_style text, food_axes jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar, p.food_style, p.food_axes
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = gid
    and exists (
      select 1 from public.group_members me
      where me.group_id = gid and me.user_id = auth.uid()
    );
$$;

revoke all on function public.get_group_member_types(uuid) from public, anon;
grant execute on function public.get_group_member_types(uuid) to authenticated;
