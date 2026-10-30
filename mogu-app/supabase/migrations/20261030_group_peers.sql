-- マイページの「相性診断 Top3」「友達と相性診断する」で使う関数。
-- 自分と同じグループにいるメンバーの、表示に必要な列（名前・アイコン・タイプ・4軸）だけを返す。
-- メールアドレスなどは返さない。ログイン中のユーザーだけが呼べる。

-- 4軸スコアの列（20261022_add_food_axes.sql と同じ。未実行でもこのファイルだけで動くように）
alter table public.profiles add column if not exists food_axes jsonb;

create or replace function public.get_group_peers()
returns table (id uuid, display_name text, avatar text, food_style text, food_axes jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.display_name, p.avatar, p.food_style, p.food_axes
  from public.group_members me
  join public.group_members gm
    on gm.group_id = me.group_id
   and gm.user_id <> me.user_id
  join public.profiles p
    on p.id = gm.user_id
  where me.user_id = auth.uid();
$$;

revoke all on function public.get_group_peers() from public, anon;
grant execute on function public.get_group_peers() to authenticated;
