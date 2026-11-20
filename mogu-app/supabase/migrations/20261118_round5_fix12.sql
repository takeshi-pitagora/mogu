-- =====================================================================
-- 第5回 fix12：③ スタンプ帳
--   ・たまった来店スタンプを、行った順に読む
--   ・スタンプ1つのくわしく（行った日・お店・出たキャラ・自分の答え）
--   自分の分だけ読める。ほかの人のスタンプ帳は読めない。
--   fix11 のあとに実行する
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. スタンプ帳（③スタンプ帳-1〜3・6・7）
--    行った順（古い順）。9個ずつ台紙に並べるのはアプリ側。
-- ---------------------------------------------------------------------
create or replace function public.my_stamps()
returns table (
  id uuid,
  shop_id uuid,
  shop_name text,
  genre_main text,
  station_name text,
  visited_on date,
  stamp_character text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.shop_id, s.name, s.genre_main,
         (select st.name from public.stations st where st.id = s.station_id),
         v.visited_on, v.stamp_character
    from public.shop_visits v
    join public.shops s on s.id = v.shop_id
   where v.user_id = auth.uid()
     and s.status <> 'deleted'          -- 閉店したお店のスタンプは残す（status = 'closed' も出す）
   order by v.visited_on, v.created_at
$$;
revoke all on function public.my_stamps() from public, anon;
grant execute on function public.my_stamps() to authenticated;

-- ---------------------------------------------------------------------
-- 2. スタンプ1つのくわしく（③スタンプ帳-4）
--    自分の答え（よかった・予算・ひとこと）と、このお店のスタンプぜんぶ
-- ---------------------------------------------------------------------
create or replace function public.my_stamp(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_out jsonb;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;

  select v.id, v.shop_id, v.visited_on, v.stamp_character, v.highlights, v.created_at,
         s.name as shop_name, s.genre_main,
         (select st.name from public.stations st where st.id = s.station_id) as station_name
    into v_row
    from public.shop_visits v
    join public.shops s on s.id = v.shop_id
   where v.id = p_id and v.user_id = v_user and s.status <> 'deleted';
  if not found then raise exception 'not_found'; end if;

  v_out := jsonb_build_object(
    'id', v_row.id,
    'shop_id', v_row.shop_id,
    'shop_name', v_row.shop_name,
    'genre_main', v_row.genre_main,
    'station_name', v_row.station_name,
    'visited_on', v_row.visited_on,
    'stamp_character', v_row.stamp_character,
    'highlights', coalesce(to_jsonb(v_row.highlights), '[]'::jsonb),
    -- 予算：その日のあとに入れた分も含め、自分がこのお店に入れた予算感
    'budget', (
      select jsonb_agg(jsonb_build_object('time_of_day', b.time_of_day, 'bucket', b.bucket)
                       order by b.time_of_day)
        from public.budget_votes b
       where b.shop_id = v_row.shop_id and b.user_id = v_user
    ),
    -- ひとこと：このお店に自分が書いたもののうち、この来店にいちばん近いもの
    'comment', (
      select c.body from public.shop_comments c
       where c.shop_id = v_row.shop_id and c.user_id = v_user and c.status = 'open'
       order by abs(extract(epoch from (c.created_at - v_row.created_at)))
       limit 1
    ),
    -- このお店のスタンプ（新しい順）
    'shop_stamps', coalesce((
      select jsonb_agg(jsonb_build_object('id', v2.id, 'visited_on', v2.visited_on,
                                          'stamp_character', v2.stamp_character)
                       order by v2.visited_on desc)
        from public.shop_visits v2
       where v2.shop_id = v_row.shop_id and v2.user_id = v_user
    ), '[]'::jsonb)
  );
  return v_out;
end;
$$;
revoke all on function public.my_stamp(uuid) from public, anon;
grant execute on function public.my_stamp(uuid) to authenticated;
