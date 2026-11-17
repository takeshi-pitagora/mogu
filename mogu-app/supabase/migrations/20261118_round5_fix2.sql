-- =====================================================================
-- 第5回 手順3（⑱⑲）で使うもの
--   ・駅をさがす（漢字でも「よみ」でも、ひらがな・カタカナ・英字のどれでも）
--   ・ハッシュタグの「種類」と、さがす・作る
--   ・新しいタグのコインは「作った人が、はじめてお店に付けたとき」に
--   20261118_round5_fix1.sql のあとに、1回だけ実行してください
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 駅の「よみ」（⑱-2。「しぶ」で「渋谷」が出るように）
--     mogu_read_key は漢字をかなに直さないので、よみの列を別に持つ
-- ---------------------------------------------------------------------
alter table public.stations add column if not exists name_kana text;
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'stations'
                    and column_name = 'kana_key') then
    alter table public.stations
      add column kana_key text generated always as (public.mogu_read_key(name_kana)) stored;
  end if;
end $$;
create index if not exists stations_kana_idx on public.stations (kana_key);

-- ---------------------------------------------------------------------
-- 2. 駅をさがす（⑱-2。東京の駅の一覧から。地図・外の検索は使わない）
--     打った文字で前から当てる。漢字でも、よみでも当たる
--     同じ名前の駅（路線ちがい）は1つにまとめて出す
-- ---------------------------------------------------------------------
create or replace function public.search_stations(p_q text default null, p_limit int default 50)
returns table (id uuid, name text, ward text, line text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select public.mogu_read_key(coalesce(p_q, '')) as k),
  hit as (
    select distinct on (s.name, s.ward) s.id, s.name, s.ward, s.line
      from public.stations s, q
     where q.k is null or q.k = ''
        or s.read_key like q.k || '%'
        or (s.kana_key is not null and s.kana_key like q.k || '%')
     order by s.name, s.ward, s.line
  )
  select hit.id, hit.name, hit.ward, hit.line
    from hit
   order by char_length(hit.name), hit.name, hit.ward
   limit greatest(1, least(p_limit, 200))
$$;

revoke all on function public.search_stations(text, int) from public, anon;
grant execute on function public.search_stations(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. ハッシュタグの「種類」（⑲-2。何も打っていないときに種類ごとに並べる）
--     あとから運営が足せるように、ただの文字の列にする
--     みんなが作ったタグは種類なし（さがせば出る）
-- ---------------------------------------------------------------------
alter table public.tags add column if not exists category text;
alter table public.tags add column if not exists category_order int;
create index if not exists tags_category_idx on public.tags (category, category_order);

-- ---------------------------------------------------------------------
-- 4. タグをさがす（⑲-3。お店の数つき）
-- ---------------------------------------------------------------------
create or replace function public.search_tags(p_q text, p_limit int default 20)
returns table (id uuid, name text, shop_count int)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select public.mogu_read_key(coalesce(p_q, '')) as k)
  select t.id, t.name, t.shop_count
    from public.tags t, q
   where t.status = 'open'
     and t.kind = 'public'
     and q.k is not null and q.k <> ''
     and (t.read_key like q.k || '%'
          or exists (select 1 from unnest(t.aliases) a
                      where public.mogu_read_key(a) like q.k || '%'))
   order by (t.read_key = q.k) desc, t.shop_count desc, char_length(t.name), t.name
   limit greatest(1, least(p_limit, 50))
$$;

revoke all on function public.search_tags(text, int) from public, anon;
grant execute on function public.search_tags(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- 5. 何も打っていないときの候補（⑲-2。種類ごと・よく使われる順）
-- ---------------------------------------------------------------------
create or replace function public.suggest_tags(p_per_category int default 8)
returns table (id uuid, name text, shop_count int, category text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, shop_count, category from (
    select t.id, t.name, t.shop_count, t.category,
           row_number() over (partition by t.category
                              order by t.shop_count desc, t.category_order, t.name) as rn,
           min(t.category_order) over (partition by t.category) as cat_rank
      from public.tags t
     where t.status = 'open' and t.kind = 'public' and t.category is not null
  ) x
   where rn <= greatest(1, least(p_per_category, 20))
   order by cat_rank, rn
$$;

revoke all on function public.suggest_tags(int) from public, anon;
grant execute on function public.suggest_tags(int) to authenticated;

-- ---------------------------------------------------------------------
-- 6. 新しいタグを作る（⑲-5。作った時点でアプリのタグになる）
--     2〜15文字。空白・記号は使えない（ー・& は使える）
--     同じ読みのタグがもうあれば、それを返す（二重に作らない）
-- ---------------------------------------------------------------------
create or replace function public.create_tag(p_name text)
returns table (id uuid, name text, shop_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 15 then raise exception 'tag_length'; end if;
  -- 空白と記号は使えない（ー・& と、文字・数字だけ）
  if v_name ~ '[[:space:]]' then raise exception 'tag_chars'; end if;
  if v_name !~ '^[[:alnum:]ぁ-んァ-ヴー一-龥々ー・&]+$' then raise exception 'tag_chars'; end if;
  if public.mogu_has_banned(v_name) then raise exception 'banned_word'; end if;

  select t.id into v_id from public.tags t
   where t.read_key = public.mogu_read_key(v_name) and t.status = 'open';
  if v_id is null then
    insert into public.tags (name, kind, created_by) values (v_name, 'public', v_user)
    returning tags.id into v_id;
  end if;

  return query select t.id, t.name, t.shop_count from public.tags t where t.id = v_id;
end;
$$;

revoke all on function public.create_tag(text) from public, anon;
grant execute on function public.create_tag(text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. register_shop のタグの所を直す
--     ⑲で先に作られたタグでも、作った人がはじめてお店に付けたときは＋1
-- ---------------------------------------------------------------------
create or replace function public.mogu_tag_for_register(p_user uuid, p_name text, p_shop uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created_by uuid;
  v_count int;
begin
  select t.id, t.created_by, t.shop_count into v_id, v_created_by, v_count
    from public.tags t
   where t.read_key = public.mogu_read_key(p_name) and t.status = 'open';

  if v_id is null then
    insert into public.tags (name, kind, created_by) values (trim(p_name), 'public', p_user)
    returning tags.id into v_id;
    v_created_by := p_user;
    v_count := 0;
  end if;

  -- 新しいタグ＋1（§6-2。作った本人が、そのタグをはじめてお店に付けたときだけ）
  if v_created_by = p_user and v_count = 0 then
    perform public.mogu_add_coin(p_user, 'new_tag',
      public.mogu_setting('coin_new_tag')::int, p_shop, v_id);
  end if;

  return v_id;
end;
$$;

revoke all on function public.mogu_tag_for_register(uuid, text, uuid) from public, anon, authenticated;


-- register_shop のタグの所だけ差し替え（ほかは fix1 と同じ）
create or replace function public.register_shop(
  p_name            text,
  p_station_id      uuid,
  p_walk_min        int,
  p_genre_main      text,
  p_genre_sub       text,
  p_visited_on      date,
  p_time_of_day     text,
  p_budget_bucket   int,
  p_gender          text,
  p_highlight_keys  text[],
  p_highlight_reason text,
  p_photos          jsonb default '[]'::jsonb,   -- [{path, card_path, kind, width, height}]
  p_fields          jsonb default '{}'::jsonb,   -- {field_key: value}
  p_tags            text[] default '{}',
  p_menu            jsonb default '[]'::jsonb,   -- [{name, price, limited_until}]
  p_comment         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_shop uuid;
  v_today_shops int;
  v_limit int := public.mogu_setting('limit_shops_per_day')::int;
  v_min_side int := public.mogu_setting('photo_min_short_side')::int;
  v_photo jsonb;
  v_first_photo uuid := null;
  v_photo_id uuid;
  v_photo_count int := 0;
  v_field record;
  v_field_count int := 0;
  v_tag text;
  v_tag_id uuid;
  v_menu jsonb;
  v_full boolean;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;

  if public.mogu_is_suspended(v_user) then
    raise exception 'posting_suspended';
  end if;

  -- 1日に登録できるお店の数（§6-2。サーバーで止める。§8-2）
  select count(*) into v_today_shops
    from public.shops
   where discoverer_id = v_user
     and created_at >= public.mogu_jst_day_start();
  if v_today_shops >= v_limit then
    raise exception 'daily_shop_limit';
  end if;

  -- 必須（⑱）
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if p_station_id is null or p_walk_min is null then raise exception 'station_required'; end if;
  if coalesce(trim(p_genre_main), '') = '' then raise exception 'genre_required'; end if;
  if p_visited_on is null or p_visited_on > public.mogu_jst_today() then raise exception 'visited_on_invalid'; end if;
  if p_time_of_day not in ('lunch', 'dinner') then raise exception 'time_of_day_invalid'; end if;
  if p_gender is not null and p_gender not in ('male', 'female', 'no_answer') then raise exception 'gender_invalid'; end if;
  if p_budget_bucket is null or p_budget_bucket not between 1 and 8 then raise exception 'budget_invalid'; end if;
  if p_highlight_keys is null or array_length(p_highlight_keys, 1) is null then raise exception 'highlight_required'; end if;
  if jsonb_array_length(p_photos) < 1 then raise exception 'photo_required'; end if;

  -- 使えない言葉（⑬と同じ仕組み。サーバーでも確かめる）
  if public.mogu_has_banned(p_name)
     or public.mogu_has_banned(coalesce(p_highlight_reason, ''))
     or public.mogu_has_banned(coalesce(p_comment, '')) then
    raise exception 'banned_word';
  end if;

  insert into public.shops (
    name, station_id, walk_min, genre_main, genre_sub, discoverer_id, status
  ) values (
    trim(p_name), p_station_id, p_walk_min, p_genre_main, nullif(p_genre_sub, ''), v_user, 'pending'
  ) returning id into v_shop;

  -- 写真
  for v_photo in select * from jsonb_array_elements(p_photos) loop
    if least((v_photo ->> 'width')::int, (v_photo ->> 'height')::int) < v_min_side then
      raise exception 'photo_too_small';
    end if;
    insert into public.shop_photos (shop_id, user_id, kind, path, card_path, width, height)
    values (
      v_shop, v_user, coalesce(v_photo ->> 'kind', 'food'),
      v_photo ->> 'path', v_photo ->> 'card_path',
      (v_photo ->> 'width')::int, (v_photo ->> 'height')::int
    ) returning id into v_photo_id;
    if v_first_photo is null then v_first_photo := v_photo_id; end if;
    v_photo_count := v_photo_count + 1;
  end loop;
  update public.shops set cover_photo_id = v_first_photo where id = v_shop;

  -- イチ押し
  insert into public.shop_highlights (shop_id, user_id, highlight_keys, reason)
  values (v_shop, v_user, p_highlight_keys, nullif(p_highlight_reason, ''));

  -- 予算感（§6-6）。はじめて入れるときだけ性別を覚える
  if p_gender is not null then
    update public.profiles set budget_gender = p_gender
     where id = v_user and budget_gender is null;
  end if;
  insert into public.budget_votes (shop_id, user_id, time_of_day, bucket, gender_at_vote)
  values (v_shop, v_user, p_time_of_day, p_budget_bucket,
          (select budget_gender from public.profiles where id = v_user));

  -- 行った日（③のカレンダーはここと shop_visits を読む）
  insert into public.shop_visits (shop_id, user_id, visited_on, stamp_character)
  values (v_shop, v_user, p_visited_on, 'register')
  on conflict do nothing;

  -- 任意の項目
  for v_field in select key, value from jsonb_each_text(p_fields) loop
    if coalesce(trim(v_field.value), '') = '' then continue; end if;
    if public.mogu_has_banned(v_field.value) then raise exception 'banned_word'; end if;
    insert into public.shop_fields (shop_id, field_key, value, filled_by)
    values (v_shop, v_field.key, v_field.value, v_user)
    on conflict (shop_id, field_key) do nothing;
    v_field_count := v_field_count + 1;
  end loop;

  -- ハッシュタグ（⑲。1人が1店に5つまで）
  if array_length(p_tags, 1) > public.mogu_setting('limit_tags_per_shop_user')::int then
    raise exception 'tag_limit';
  end if;
  foreach v_tag in array coalesce(p_tags, '{}') loop
    if coalesce(trim(v_tag), '') = '' then continue; end if;
    if public.mogu_has_banned(v_tag) then raise exception 'banned_word'; end if;
    -- タグを引き当てる（無ければ作る）。＋1はこの中で決める（fix2）
    v_tag_id := public.mogu_tag_for_register(v_user, v_tag, v_shop);
    insert into public.shop_tags (shop_id, tag_id, created_by)
    values (v_shop, v_tag_id, v_user) on conflict do nothing;
    update public.tags set shop_count = shop_count + 1 where id = v_tag_id;
  end loop;

  -- おすすめメニュー
  for v_menu in select * from jsonb_array_elements(p_menu) loop
    if public.mogu_has_banned(coalesce(v_menu ->> 'name', '')) then raise exception 'banned_word'; end if;
    insert into public.shop_menu_items (shop_id, user_id, name, price, limited_until)
    values (v_shop, v_user, v_menu ->> 'name', (v_menu ->> 'price')::int,
            (v_menu ->> 'limited_until')::date);
  end loop;

  -- ひとこと
  if coalesce(trim(p_comment), '') <> '' then
    insert into public.shop_comments (shop_id, user_id, body) values (v_shop, v_user, trim(p_comment));
    if char_length(trim(p_comment)) >= public.mogu_setting('limit_comment_min_len')::int then
      perform public.mogu_add_coin(v_user, 'comment', public.mogu_setting('coin_comment')::int, v_shop);
    end if;
  end if;

  -- コイン（§6-2）。登録は上限の対象外
  perform public.mogu_add_coin(v_user, 'register',
    public.mogu_setting('coin_register')::int, v_shop, null, false);

  -- しっかり登録（写真3枚と任意の項目5つ）
  v_full := v_photo_count >= public.mogu_setting('full_register_photos')::int
        and v_field_count >= public.mogu_setting('full_register_fields')::int;
  if v_full then
    perform public.mogu_add_coin(v_user, 'full_register',
      public.mogu_setting('coin_full_register')::int, v_shop, null, false);
  end if;

  return v_shop;
end;
$$;

revoke all on function public.register_shop(text, uuid, int, text, text, date, text, int, text, text[], text, jsonb, jsonb, text[], jsonb, text) from public, anon;
grant execute on function public.register_shop(text, uuid, int, text, text, date, text, int, text, text[], text, jsonb, jsonb, text[], jsonb, text) to authenticated;


-- ---------------------------------------------------------------------
-- 8. はじめからあるタグ（⑲-2 の確定版の候補。種類と並び順つき）
--     同じ読みのタグがもうあれば、種類だけ入れる（名前は変えない）
-- ---------------------------------------------------------------------
with seed(name, category, category_order) as (values
  ('フルーツサワー', 'ドリンク', 101),
  ('レモンサワー', 'ドリンク', 102),
  ('クラフトビール', 'ドリンク', 103),
  ('ハイボール', 'ドリンク', 104),
  ('日本酒', 'ドリンク', 105),
  ('クリームソーダ', 'ドリンク', 106),
  ('焼き鳥', '料理', 201),
  ('餃子', '料理', 202),
  ('スパイスカレー', '料理', 203),
  ('担々麺', '料理', 204),
  ('オムライス', '料理', 205),
  ('ナポリピザ', '料理', 206),
  ('パンケーキ', 'スイーツ・パン', 301),
  ('パフェ', 'スイーツ・パン', 302),
  ('かき氷', 'スイーツ・パン', 303),
  ('プリン', 'スイーツ・パン', 304),
  ('フルーツサンド', 'スイーツ・パン', 305),
  ('コスパ最強', 'お得・量', 401),
  ('せんべろ', 'お得・量', 402),
  ('飲み放題', 'お得・量', 403),
  ('ランチがお得', 'お得・量', 404),
  ('大盛り無料', 'お得・量', 405),
  ('隠れ家', '雰囲気', 501),
  ('レトロ', '雰囲気', 502),
  ('落ち着く', '雰囲気', 503),
  ('にぎやか', '雰囲気', 504),
  ('夜景', '雰囲気', 505)
)
insert into public.tags (name, kind, category, category_order)
select s.name, 'public', s.category, s.category_order
  from seed s
 where not exists (
   select 1 from public.tags t
    where t.read_key = public.mogu_read_key(s.name) and t.status = 'open');

with seed(name, category, category_order) as (values
  ('フルーツサワー', 'ドリンク', 101),
  ('レモンサワー', 'ドリンク', 102),
  ('クラフトビール', 'ドリンク', 103),
  ('ハイボール', 'ドリンク', 104),
  ('日本酒', 'ドリンク', 105),
  ('クリームソーダ', 'ドリンク', 106),
  ('焼き鳥', '料理', 201),
  ('餃子', '料理', 202),
  ('スパイスカレー', '料理', 203),
  ('担々麺', '料理', 204),
  ('オムライス', '料理', 205),
  ('ナポリピザ', '料理', 206),
  ('パンケーキ', 'スイーツ・パン', 301),
  ('パフェ', 'スイーツ・パン', 302),
  ('かき氷', 'スイーツ・パン', 303),
  ('プリン', 'スイーツ・パン', 304),
  ('フルーツサンド', 'スイーツ・パン', 305),
  ('コスパ最強', 'お得・量', 401),
  ('せんべろ', 'お得・量', 402),
  ('飲み放題', 'お得・量', 403),
  ('ランチがお得', 'お得・量', 404),
  ('大盛り無料', 'お得・量', 405),
  ('隠れ家', '雰囲気', 501),
  ('レトロ', '雰囲気', 502),
  ('落ち着く', '雰囲気', 503),
  ('にぎやか', '雰囲気', 504),
  ('夜景', '雰囲気', 505)
)
update public.tags t
   set category = s.category, category_order = s.category_order
  from seed s
 where t.read_key = public.mogu_read_key(s.name)
   and t.status = 'open'
   and t.category is distinct from s.category;

-- =====================================================================
-- 確認（実行すると6行出ます。6つとも「あっています」が正解）
-- =====================================================================
select '駅をさがす関数' as "確認",
       case when to_regprocedure('public.search_stations(text,int)') is not null
            then 'あっています' else 'ちがいます' end as "結果"
union all
select '駅のよみの列',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'stations'
                            and column_name = 'kana_key')
            then 'あっています' else 'ちがいます' end
union all
select 'タグの種類の列',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'tags'
                            and column_name = 'category')
            then 'あっています' else 'ちがいます' end
union all
select 'タグをさがす・作る関数',
       case when to_regprocedure('public.search_tags(text,int)') is not null
             and to_regprocedure('public.create_tag(text)') is not null
             and to_regprocedure('public.suggest_tags(int)') is not null
            then 'あっています' else 'ちがいます' end
union all
select '新しいタグのコインの直し',
       case when to_regprocedure('public.mogu_tag_for_register(uuid,text,uuid)') is not null
            then 'あっています' else 'ちがいます' end
union all
select 'はじめからあるタグ（27が正解）',
       case when (select count(*) from public.tags where category is not null) = 27
            then 'あっています' else 'ちがいます（' ||
                 (select count(*) from public.tags where category is not null)::text || '）' end;
