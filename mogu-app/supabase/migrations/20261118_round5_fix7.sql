-- =====================================================================
-- 第5回 手順7：ホームと保存を、みんなが登録したお店（shops）だけにする
--   ・Google からお店を取ってくるのをやめる（§7・けんとの決定）
--   ・ホーム・保存・グループのマッチは restaurants 表を見ているので、
--     shops に登録されたお店を restaurants にも自動で写す
--     （こうすると、グループの仕組みをこわさずに Google を外せる）
--   ・restaurants にどの列があるかはプロジェクトによって違うので、
--     「ある列にだけ書く」形で作る
--   20261118_round5_fix6.sql のあとに、1回だけ実行してください
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. shops → restaurants に写す関数を、restaurants の列に合わせて作る
-- ---------------------------------------------------------------------
do $do$
declare
  -- 左：restaurants の列の名前、右：shops の行から取る式
  v_pairs text[][] := array[
    ['name',               'new.name'],
    ['genre',              'coalesce(new.genre_main, '''')'],
    ['is_excluded',        '(new.status <> ''open'')'],
    ['lat',                '(select lat from public.stations where id = new.station_id)'],
    ['lng',                '(select lng from public.stations where id = new.station_id)'],
    ['area',               '(select ward from public.stations where id = new.station_id)'],
    ['station',            '(select name from public.stations where id = new.station_id)'],
    ['walk_minutes',       'new.walk_min'],
    ['price_level',        'public.mogu_shop_price_level(new.id)'],
    ['photos',             'public.mogu_shop_photo_urls(new.id)'],
    ['photo_food',         '(public.mogu_shop_photo_urls(new.id) ->> 0)'],
    ['updated_at',         'now()']
  ];
  v_cols text := 'id';
  v_vals text := 'new.id';
  v_set  text := '';
  i int;
begin
  for i in 1 .. array_length(v_pairs, 1) loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'restaurants'
                  and column_name = v_pairs[i][1]) then
      v_cols := v_cols || ', ' || quote_ident(v_pairs[i][1]);
      v_vals := v_vals || ', ' || v_pairs[i][2];
      v_set := v_set || case when v_set = '' then '' else ', ' end
               || quote_ident(v_pairs[i][1]) || ' = excluded.' || quote_ident(v_pairs[i][1]);
    end if;
  end loop;

  execute format($f$
    create or replace function public.mogu_shop_to_restaurant()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    begin
      insert into public.restaurants (%s) values (%s)
      on conflict (id) do update set %s;
      return new;
    end;
    $body$;
  $f$, v_cols, v_vals, coalesce(nullif(v_set, ''), 'id = excluded.id'));
end
$do$;

-- 予算感（みんなの投票のいちばん多い段）を、今の price_level（1〜4）に直す
create or replace function public.mogu_shop_price_level(p_shop_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when b.bucket is null then null
    when b.bucket <= 2 then 1
    when b.bucket <= 4 then 2
    when b.bucket <= 6 then 3
    else 4 end
    from (select bucket from public.budget_votes
           where shop_id = p_shop_id
           group by bucket order by count(*) desc, bucket limit 1) b
$$;

-- お店の写真（表紙が先）のURL
create or replace function public.mogu_shop_photo_urls(p_shop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(t.u order by t.u_order), '[]'::jsonb) from (
    select ph.path as u,
           row_number() over (order by (ph.id = s.cover_photo_id) desc, ph.created_at) as u_order
      from public.shop_photos ph join public.shops s on s.id = ph.shop_id
     where ph.shop_id = p_shop_id and ph.status = 'open'
  ) t
$$;

drop trigger if exists shops_to_restaurants on public.shops;
create trigger shops_to_restaurants after insert or update on public.shops
  for each row execute function public.mogu_shop_to_restaurant();

-- ---------------------------------------------------------------------
-- 2. いまある shops を restaurants に写す（1回だけ）
-- ---------------------------------------------------------------------
update public.shops set name = name where status <> 'deleted';

-- ---------------------------------------------------------------------
-- 3. ホーム・保存のカードに出すもの（㉔・確定版 Final-24）
--    星はやめて、みんなのタグ3つ・予算感・「○人が保存」
-- ---------------------------------------------------------------------
create or replace function public.shop_cards(p_ids uuid[])
returns table (
  id uuid, name text, genre_main text, station_name text, walk_min int,
  saved_count int, cover_path text, budget_label text, tags text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.genre_main,
         (select st.name from public.stations st where st.id = s.station_id),
         s.walk_min,
         s.saved_count,
         (select ph.card_path from public.shop_photos ph
           where ph.id = s.cover_photo_id and ph.status = 'open'),
         (select case b.bucket
                   when 1 then '〜¥1,000'    when 2 then '¥1,000〜¥2,000'
                   when 3 then '¥2,000〜¥3,000' when 4 then '¥3,000〜¥4,000'
                   when 5 then '¥4,000〜¥5,000' when 6 then '¥5,000〜¥7,000'
                   when 7 then '¥7,000〜¥10,000' else '¥10,000〜' end
            from (select bucket from public.budget_votes
                   where shop_id = s.id group by bucket
                   order by count(*) desc, bucket limit 1) b),
         (select coalesce(array_agg(t.name order by st2.plus_count desc, t.name), '{}')
            from (select tag_id, plus_count from public.shop_tags
                   where shop_id = s.id order by plus_count desc limit 3) st2
            join public.tags t on t.id = st2.tag_id
           where t.status = 'open' and t.kind = 'public')
    from public.shops s
   where s.id = any(p_ids) and s.status <> 'deleted'
$$;
revoke all on function public.shop_cards(uuid[]) from public, anon;
grant execute on function public.shop_cards(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- 4. ③ 行ったお店のカレンダー（行った日にお店の写真）
--    「行った日」は、お店を登録したときと、来店スタンプの日
-- ---------------------------------------------------------------------
create or replace function public.my_visit_calendar(p_from date, p_to date)
returns table (visited_on date, shop_id uuid, shop_name text, card_path text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (v.visited_on)
         v.visited_on, v.shop_id, s.name,
         (select ph.card_path from public.shop_photos ph
           where ph.id = s.cover_photo_id and ph.status = 'open')
    from public.shop_visits v join public.shops s on s.id = v.shop_id
   where v.user_id = auth.uid()
     and v.visited_on between p_from and p_to
     and s.status <> 'deleted'
   order by v.visited_on, v.created_at desc
$$;
revoke all on function public.my_visit_calendar(date, date) from public, anon;
grant execute on function public.my_visit_calendar(date, date) to authenticated;

-- 行った月の一覧（月のタブに出す）
create or replace function public.my_visit_months()
returns table (ym text, n int)
language sql
stable
security definer
set search_path = public
as $$
  select to_char(visited_on, 'YYYY-MM') as ym, count(*)::int
    from public.shop_visits where user_id = auth.uid()
   group by 1 order by 1 desc
$$;
revoke all on function public.my_visit_months() from public, anon;
grant execute on function public.my_visit_months() to authenticated;

-- ---------------------------------------------------------------------
-- 5. ③ 自分のハッシュタグ（プロフィールの編集で選ぶ）
-- ---------------------------------------------------------------------
alter table public.user_tags enable row level security;
drop policy if exists user_tags_read on public.user_tags;
create policy user_tags_read on public.user_tags for select to authenticated using (true);
drop policy if exists user_tags_own on public.user_tags;
create policy user_tags_own on public.user_tags for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_my_tags(p_tag_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  i int := 0;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if array_length(p_tag_ids, 1) > 5 then raise exception 'tag_limit'; end if;
  delete from public.user_tags where user_id = v_user;
  foreach v_id in array coalesce(p_tag_ids, '{}') loop
    insert into public.user_tags (user_id, tag_id, sort) values (v_user, v_id, i)
      on conflict do nothing;
    i := i + 1;
  end loop;
end;
$$;
revoke all on function public.set_my_tags(uuid[]) from public, anon;
grant execute on function public.set_my_tags(uuid[]) to authenticated;

create or replace function public.user_tags_of(p_user_id uuid)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name from public.user_tags ut join public.tags t on t.id = ut.tag_id
   where ut.user_id = p_user_id and t.status = 'open'
   order by ut.sort
$$;
revoke all on function public.user_tags_of(uuid) from public, anon;
grant execute on function public.user_tags_of(uuid) to authenticated;

-- =====================================================================
-- 確認（実行すると5行出ます。5つとも「あっています」が正解）
-- =====================================================================
select 'shops を restaurants に写す' as "確認",
       case when exists (select 1 from pg_trigger where tgname = 'shops_to_restaurants')
            then 'あっています' else 'ちがいます' end as "結果"
union all
select '写したお店の数が合っている',
       case when (select count(*) from public.shops where status <> 'deleted')
             <= (select count(*) from public.restaurants)
            then 'あっています' else 'ちがいます' end
union all
select 'カードの中身を読む関数',
       case when to_regprocedure('public.shop_cards(uuid[])') is not null
            then 'あっています' else 'ちがいます' end
union all
select '行ったお店のカレンダー',
       case when to_regprocedure('public.my_visit_calendar(date,date)') is not null
             and to_regprocedure('public.my_visit_months()') is not null
            then 'あっています' else 'ちがいます' end
union all
select '自分のハッシュタグ',
       case when to_regprocedure('public.set_my_tags(uuid[])') is not null
             and to_regprocedure('public.user_tags_of(uuid)') is not null
            then 'あっています' else 'ちがいます' end;