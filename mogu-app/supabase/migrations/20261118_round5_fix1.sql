-- =====================================================================
-- 第5回 5-1 の土台の直し（1）：「今日」を日本時間で数える
--   ・Supabase のデータベースは UTC なので date_trunc('day', now()) は
--     日本時間の朝9時に日が変わってしまう（夜中〜朝9時が前日あつかい）
--   ・1日の上限（お店5件・コイン30）と「行った日」の判定を日本時間に直す
--   ・性別の値がちがうときは 'gender_invalid' で止める（今までは分かりにくい
--     制約のエラーになっていた）
--   ・あわせて、⑰を開いたときに上限を知らせるための関数を足す
--   20261118_round5_base.sql を実行したあとに、1回だけ実行してください
-- =====================================================================

create or replace function public.mogu_jst_day_start()
returns timestamptz
language sql
stable
as $$
  select (date_trunc('day', now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo'
$$;

create or replace function public.mogu_jst_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Tokyo')::date
$$;

grant execute on function public.mogu_jst_day_start() to authenticated;
grant execute on function public.mogu_jst_today() to authenticated;

-- ---------------------------------------------------------------------
-- 日本時間に直した2つの関数（中身は 20261118_round5_base.sql と同じ）
-- ---------------------------------------------------------------------
create or replace function public.mogu_add_coin(
  p_user uuid, p_action text, p_amount int,
  p_shop uuid default null, p_target uuid default null, p_capped boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_other int;
  v_cap int := public.mogu_setting('limit_daily_coin_other')::int;
begin
  if p_amount is null or p_amount <= 0 then return; end if;

  -- 「登録」「しっかり登録」「保存のボーナス」以外は、合わせて1日30コインまで（§6-2）
  if p_capped then
    select coalesce(sum(amount), 0) into v_today_other
      from public.coin_ledger
     where user_id = p_user
       and state <> 'cancelled'
       and action not in ('register', 'full_register', 'saved_bonus')
       and created_at >= public.mogu_jst_day_start();
    if v_today_other >= v_cap then return; end if;
    if v_today_other + p_amount > v_cap then
      p_amount := v_cap - v_today_other;
    end if;
  end if;

  insert into public.coin_ledger (user_id, action, shop_id, target_id, amount, state)
  values (p_user, p_action, p_shop, p_target, p_amount, 'pending');

  insert into public.user_coin_totals (user_id, pending_total)
  values (p_user, p_amount)
  on conflict (user_id) do update
    set pending_total = public.user_coin_totals.pending_total + excluded.pending_total,
        updated_at = now();
end;
$$;

revoke all on function public.mogu_add_coin(uuid, text, int, uuid, uuid, boolean) from public, anon, authenticated;

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
    select id into v_tag_id from public.tags
     where read_key = public.mogu_read_key(v_tag) and status = 'open';
    if v_tag_id is null then
      insert into public.tags (name, created_by) values (trim(v_tag), v_user)
      returning id into v_tag_id;
      -- 新しいタグ＋1（§6-2。ほかの2人が＋1したら確定）
      perform public.mogu_add_coin(v_user, 'new_tag',
        public.mogu_setting('coin_new_tag')::int, v_shop, v_tag_id);
    end if;
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
-- ⑰を開いたときに「今日はもう登録できない」を出すための関数
--   返り値：{"used": 今日登録した数, "limit": 上限, "suspended": 投稿を止められているか}
-- ---------------------------------------------------------------------
create or replace function public.my_shop_quota()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'used', (select count(*) from public.shops
              where discoverer_id = auth.uid()
                and created_at >= public.mogu_jst_day_start()),
    'limit', public.mogu_setting('limit_shops_per_day')::int,
    'suspended', public.mogu_is_suspended(auth.uid())
  )
$$;

revoke all on function public.my_shop_quota() from public, anon;
grant execute on function public.my_shop_quota() to authenticated;

-- ---------------------------------------------------------------------
-- お店の写真の置き場（⑱・㉒で使う）
--   shop-photos：だれでも読める（アプリの中でみんなに見せる写真のため）
--   書けるのは本人のフォルダだけ。消すのも本人だけ（運営は service role で消す）
--   1枚 8MB まで。大きい写真と、カード用の小さい写真の2つを入れる
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-photos', 'shop-photos', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mogu_shopphotos_insert_own on storage.objects;
create policy mogu_shopphotos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and not public.mogu_is_guest(auth.uid())
              and not public.mogu_is_suspended(auth.uid()));
drop policy if exists mogu_shopphotos_delete_own on storage.objects;
create policy mogu_shopphotos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'shop-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 確認（実行すると4行出ます。4つとも「あっています」が正解）
-- =====================================================================
select '日本時間の今日' as "確認",
       case when public.mogu_jst_today() = (now() at time zone 'Asia/Tokyo')::date
            then 'あっています' else 'ちがいます' end as "結果"
union all
select '1日の始まり（日本時間の0時）',
       case when public.mogu_jst_day_start() + interval '24 hours' > now()
             and public.mogu_jst_day_start() <= now()
            then 'あっています' else 'ちがいます' end
union all
select '上限を読む関数',
       case when (public.my_shop_quota() ->> 'limit')::int > 0
            then 'あっています' else 'ちがいます' end
union all
select '写真の置き場（shop-photos）',
       case when exists (select 1 from storage.buckets where id = 'shop-photos')
            then 'あっています' else 'ちがいます' end;
