-- =====================================================================
-- 第5回 fix19：⑰-2「このお店ですか？」が、途中まで打っても出るようにする
--
--   これまでは pg_trgm の「%」だけで探していました。% は3文字ずつの重なりの
--   割合（similarity）が 0.3 以上のときだけ true になるので、長い店名だと
--   ほとんど打ち終わるまで候補が出ませんでした。
--     「サンプル食堂 渋谷店」に対して
--       「サン」  = 0.18（出ない）
--       「サンプ」= 0.27（出ない）
--       「サンプル」= 0.36（やっと出る）
--     「トラットリア ダ・サンプル 代官山店」だと「トラットリア」まで打って
--     ようやく出る、という状態でした。
--
--   そこで「頭から一致」と「途中に含む」を足して、
--     ① 頭から一致 → ② 途中に含む → ③ 似ている（これまでどおり）
--   の順に出します。2文字から効きます。
--
--   出どころは mogu に登録ずみのお店だけです（地図や検索のサービスは使いません。
--   引き渡し書 §1-3・§8-2）。
--   fix18 のあとに実行する
-- =====================================================================

create or replace function public.search_shops_by_name(p_name text, p_limit int default 3)
returns table (
  id uuid, name text, station_name text, walk_min int,
  discoverer_name text, discoverer_avatar_path text, cover_path text, similarity real
)
language sql
stable
security definer
set search_path = public
as $$
  with k as (select public.mogu_read_key(p_name) as key)
  select s.id, s.name, st.name, s.walk_min,
         p.display_name, p.avatar_path,
         ph.card_path,
         similarity(s.name_key, k.key) as sim
    from public.shops s
    cross join k
    left join public.stations st on st.id = s.station_id
    left join public.profiles p on p.id = s.discoverer_id
    left join public.shop_photos ph on ph.id = s.cover_photo_id
   where s.status <> 'deleted'
     and k.key is not null
     and (position(k.key in s.name_key) > 0 or s.name_key % k.key)
   order by
     -- ① 頭から一致（「サン」→「サンプル食堂 渋谷店」）
     case when s.name_key like k.key || '%' then 0
     -- ② 途中に含む（「渋谷」→「サンプル食堂 渋谷店」）
          when position(k.key in s.name_key) > 0 then 1
     -- ③ 似ている（打ちまちがい・ゆらぎ）
          else 2 end,
     -- 同じ並びのなかでは、短い名前（＝打った分に近い）を先に
     length(s.name_key),
     sim desc,
     s.created_at
   limit greatest(1, least(p_limit, 10))
$$;
revoke all on function public.search_shops_by_name(text, int) from public, anon;
grant execute on function public.search_shops_by_name(text, int) to authenticated;

comment on function public.search_shops_by_name(text, int) is
  '⑰-2「このお店ですか？」。頭から一致→途中に含む→似ている の順。'
  '出どころは mogu に登録ずみのお店だけ（地図・検索のサービスは使わない）';
