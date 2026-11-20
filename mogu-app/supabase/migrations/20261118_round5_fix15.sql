-- =====================================================================
-- 第5回 fix15：㉖ 探検手帳（記録・番付・いいね・見つけた）
--   コインの数を見るのはここだけ。自分のコインは自分だけが見られる。
--   番付は「ランキングに名前を出す」がオンの人だけ（引き渡し書 §6-5）
--   fix14 のあとに実行する
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 表紙のラベル（㉖-2）：コインの合計と仮、dig と次までのいいね
-- ---------------------------------------------------------------------
create or replace function public.my_notebook()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'coins', coalesce((select sum(amount) from public.coin_ledger
                        where user_id = auth.uid() and state = 'confirmed'), 0),
    'pending', coalesce((select sum(amount) from public.coin_ledger
                          where user_id = auth.uid() and state = 'pending'), 0),
    'dig', coalesce((select dig from public.user_coin_totals where user_id = auth.uid()), 1),
    'likes', coalesce((select likes_received from public.user_coin_totals where user_id = auth.uid()), 0),
    'since', (select to_char(min(created_at) at time zone 'Asia/Tokyo', 'YYYY.FMMM')
                from public.coin_ledger where user_id = auth.uid()),
    'rank_visible', coalesce((select show_in_ranking from public.profiles where id = auth.uid()), true)
  )
$$;
revoke all on function public.my_notebook() from public, anon;
grant execute on function public.my_notebook() to authenticated;

-- ---------------------------------------------------------------------
-- 2. ［記録］（㉖-2〜4）：日付ごとの行。取り消しは理由つき
-- ---------------------------------------------------------------------
create or replace function public.my_coin_log(p_limit int default 120)
returns table (
  id uuid,
  day date,
  action text,
  amount int,
  state text,
  reason text,
  shop_id uuid,
  shop_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         (c.created_at at time zone 'Asia/Tokyo')::date,
         c.action, c.amount, c.state, c.reason, c.shop_id, s.name
    from public.coin_ledger c
    left join public.shops s on s.id = c.shop_id
   where c.user_id = auth.uid()
   order by c.created_at desc
   limit greatest(1, least(coalesce(p_limit, 120), 300))
$$;
revoke all on function public.my_coin_log(int) from public, anon;
grant execute on function public.my_coin_log(int) to authenticated;

-- 月ごとの合計（㉖-2 の「11月 +27 確定 +12 仮」）
create or replace function public.my_coin_months()
returns table (month date, confirmed int, pending int)
language sql
stable
security definer
set search_path = public
as $$
  select date_trunc('month', (created_at at time zone 'Asia/Tokyo'))::date as month,
         coalesce(sum(amount) filter (where state = 'confirmed'), 0)::int,
         coalesce(sum(amount) filter (where state = 'pending'), 0)::int
    from public.coin_ledger
   where user_id = auth.uid()
   group by 1
   order by 1 desc
$$;
revoke all on function public.my_coin_months() from public, anon;
grant execute on function public.my_coin_months() to authenticated;

-- ---------------------------------------------------------------------
-- 3. ［番付］（㉖-5〜8）：今月＝その月に確定した分、ずっと＝確定の合計
--    名前を出していない人・投稿停止中の人は出さない。自分はいつも最後に付ける
-- ---------------------------------------------------------------------
create or replace function public.coin_rank(p_scope text default 'month')
returns table (
  rank int,
  user_id uuid,
  name text,
  handle text,
  avatar_path text,
  dig int,
  coins int,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select c.user_id,
           sum(c.amount)::int as coins,
           min(c.confirmed_at) as reached     -- 同じ数なら、先に届いた人を上に
      from public.coin_ledger c
     where c.state = 'confirmed'
       and (p_scope <> 'month'
            or (c.confirmed_at at time zone 'Asia/Tokyo')
                 >= date_trunc('month', public.mogu_jst_today()))
     group by c.user_id
  ),
  ok as (
    select b.*
      from base b
      join public.profiles p on p.id = b.user_id
     where coalesce(p.show_in_ranking, true)
       and not public.mogu_is_suspended(b.user_id)
       and b.coins > 0
  ),
  ranked as (
    select row_number() over (order by coins desc, reached, user_id)::int as rank, *
      from ok
  )
  select r.rank, r.user_id, p.display_name, p.handle, p.avatar_path,
         coalesce(t.dig, 1), r.coins, r.user_id = auth.uid()
    from ranked r
    join public.profiles p on p.id = r.user_id
    left join public.user_coin_totals t on t.user_id = r.user_id
   where r.rank <= 100 or r.user_id = auth.uid()
   order by r.rank
$$;
revoke all on function public.coin_rank(text) from public, anon;
grant execute on function public.coin_rank(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. ［いいね］（㉖-9・10）：合計と内訳、いいねの多い順
-- ---------------------------------------------------------------------
create or replace function public.my_likes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', coalesce((select likes_received from public.user_coin_totals where user_id = auth.uid()), 0),
    'saved', coalesce((select count(*) from public.saved_shops sv
                        join public.shops s on s.id = sv.shop_id
                       where s.discoverer_id = auth.uid() and sv.user_id <> auth.uid()), 0),
    'photo', coalesce((select count(*) from public.photo_votes v
                        join public.shop_photos ph on ph.id = v.photo_id
                       where ph.user_id = auth.uid() and v.user_id <> auth.uid()), 0),
    'tag', coalesce((select count(*) from public.tag_votes v
                      join public.shop_tags st on st.shop_id = v.shop_id and st.tag_id = v.tag_id
                     where st.created_by = auth.uid() and v.user_id <> auth.uid()), 0),
    -- いいねの多い順（自分が見つけたお店・自分の写真）
    'top', coalesce((
      select jsonb_agg(x order by (x->>'n')::int desc)
        from (
          select jsonb_build_object('kind', 'shop', 'id', s.id, 'name', s.name,
                                    'photo', (select ph.card_path from public.shop_photos ph
                                               where ph.shop_id = s.id and ph.status = 'open'
                                               order by ph.plus_count desc, ph.created_at limit 1),
                                    'n', s.saved_count) as x
            from public.shops s
           where s.discoverer_id = auth.uid() and s.status = 'open' and s.saved_count > 0
           order by s.saved_count desc
           limit 6
        ) t
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.my_likes() from public, anon;
grant execute on function public.my_likes() to authenticated;

-- ---------------------------------------------------------------------
-- 5. ［見つけた］（㉖-11・12）：確定・仮・取消のはんこの数と、お店の行
-- ---------------------------------------------------------------------
create or replace function public.my_found()
returns table (
  shop_id uuid,
  name text,
  photo text,
  state text,
  found_on date
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name,
         (select ph.card_path from public.shop_photos ph
           where ph.shop_id = s.id and ph.status = 'open'
           order by ph.plus_count desc, ph.created_at limit 1),
         coalesce((select c.state from public.coin_ledger c
                    where c.user_id = auth.uid() and c.shop_id = s.id and c.action = 'register'
                    order by c.created_at limit 1), 'pending'),
         (s.created_at at time zone 'Asia/Tokyo')::date
    from public.shops s
   where s.discoverer_id = auth.uid() and s.status <> 'deleted'
   order by s.created_at desc
$$;
revoke all on function public.my_found() from public, anon;
grant execute on function public.my_found() to authenticated;

-- ---------------------------------------------------------------------
-- 6. ⑤「ランキングに名前を出す」（㉖-21）
-- ---------------------------------------------------------------------
create or replace function public.set_rank_visible(p_on boolean)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.profiles set show_in_ranking = coalesce(p_on, true)
   where id = auth.uid()
  returning show_in_ranking
$$;
revoke all on function public.set_rank_visible(boolean) from public, anon;
grant execute on function public.set_rank_visible(boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 7. ㉖-15・16 ほかの人が見つけたお店（コインは出さない）
-- ---------------------------------------------------------------------
create or replace function public.user_found_shops(p_user uuid)
returns table (shop_id uuid, name text, photo text, genre_main text, station_name text, saved_count int)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name,
         (select ph.card_path from public.shop_photos ph
           where ph.shop_id = s.id and ph.status = 'open'
           order by ph.plus_count desc, ph.created_at limit 1),
         s.genre_main,
         (select st.name from public.stations st where st.id = s.station_id),
         s.saved_count
    from public.shops s
   where s.discoverer_id = p_user and s.status = 'open'
   order by s.saved_count desc, s.created_at desc
   limit 100
$$;
revoke all on function public.user_found_shops(uuid) from public, anon;
grant execute on function public.user_found_shops(uuid) to authenticated;
