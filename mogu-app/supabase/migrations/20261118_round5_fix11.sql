-- =====================================================================
-- 第5回 fix11：㉒ 2人目以降が足す・来店スタンプ
--   ・来店スタンプ（ハリーのアンケート1枚）
--   ・［＋ 足す］：写真・空いている項目・おすすめメニュー
--   ・2回目からの情報の確認（30日に1回・＋1）
--   fix10 のあとに実行する
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 来店スタンプに、アンケートで答えたものを残せるようにする
--    （スタンプのキャラ・よかったところ・ひとことの有無）
-- ---------------------------------------------------------------------
alter table public.shop_visits add column if not exists highlights text[];
alter table public.shop_visits add column if not exists has_comment boolean not null default false;
-- 1日1店に1つ。同じ日に同じ店へ2回押せない
create unique index if not exists shop_visits_one_a_day
  on public.shop_visits (user_id, shop_id, visited_on);

-- ---------------------------------------------------------------------
-- 2. 来店スタンプを押す（㉒-4〜9）
--    キャラは16体から同じ確率でランダムに1体。えらぶのはサーバー。
--    コインはスタンプ＋1（1店1回）とひとこと＋1。
-- ---------------------------------------------------------------------
create or replace function public.submit_visit_stamp(
  p_shop_id uuid,
  p_visited_on date,
  p_highlights text[] default null,
  p_budget_time text default null,
  p_budget_bucket int default null,
  p_comment text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_codes text[] := array['TFBL','TFBP','TFGL','TFGP','TNBL','TNBP','TNGL','TNGP',
                          'VFBL','VFBP','VFGL','VFGP','VNBL','VNBP','VNGL','VNGP'];
  v_code text;
  v_first boolean;
  v_has_comment boolean := p_comment is not null and btrim(p_comment) <> '';
  v_gender text;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if p_visited_on is null then raise exception 'date_required'; end if;
  -- 先の日は選べない（㉒-6）
  if p_visited_on > public.mogu_jst_today() then raise exception 'future_date'; end if;
  if array_length(p_highlights, 1) is null or array_length(p_highlights, 1) > 2 then
    raise exception 'highlights_invalid';
  end if;
  if v_has_comment and public.mogu_has_banned(p_comment) then raise exception 'banned_word'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status <> 'deleted') then
    raise exception 'shop_not_found';
  end if;
  if exists (select 1 from public.shop_visits
              where user_id = v_user and shop_id = p_shop_id and visited_on = p_visited_on) then
    raise exception 'already_stamped';
  end if;

  v_code := v_codes[1 + floor(random() * array_length(v_codes, 1))::int];
  v_first := not exists (select 1 from public.shop_visits where user_id = v_user and shop_id = p_shop_id);

  insert into public.shop_visits (shop_id, user_id, visited_on, stamp_character, highlights, has_comment)
  values (p_shop_id, v_user, p_visited_on, v_code, p_highlights, v_has_comment)
  returning id into v_id;

  -- よかったところ（みんなのイチ押し）。1人1店に1行
  insert into public.shop_highlights (shop_id, user_id, highlight_keys)
  values (p_shop_id, v_user, p_highlights)
  on conflict (shop_id, user_id) where user_id is not null
  do update set highlight_keys = excluded.highlight_keys;

  -- 予算感。性別は⑱で1回だけ聞いたもの（⑤で変えられる）
  if p_budget_time is not null and p_budget_bucket is not null then
    select budget_gender into v_gender from public.profiles where id = v_user;
    insert into public.budget_votes (shop_id, user_id, time_of_day, bucket, gender_at_vote)
    values (p_shop_id, v_user, p_budget_time, p_budget_bucket, v_gender)
    on conflict (shop_id, user_id, time_of_day) where user_id is not null
    do update set bucket = excluded.bucket, updated_at = now();
  end if;

  -- ひとこと
  if v_has_comment then
    insert into public.shop_comments (shop_id, user_id, body) values (p_shop_id, v_user, btrim(p_comment));
    if char_length(btrim(p_comment)) >= public.mogu_setting('limit_comment_min_len')::int then
      perform public.mogu_add_coin(v_user, 'comment', public.mogu_setting('coin_comment')::int, p_shop_id);
    end if;
  end if;

  -- スタンプのコインは1店1回。2回目からはスタンプだけ残る
  if v_first then
    perform public.mogu_add_coin(v_user, 'visit_stamp', public.mogu_setting('coin_visit_stamp')::int, p_shop_id);
  end if;

  return jsonb_build_object(
    'id', v_id,
    'stamp_character', v_code,
    'visited_on', p_visited_on,
    'first_time', v_first,
    'shop_name', (select name from public.shops where id = p_shop_id)
  );
end;
$$;
revoke all on function public.submit_visit_stamp(uuid, date, text[], text, int, text) from public, anon;
grant execute on function public.submit_visit_stamp(uuid, date, text[], text, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. 前に押したスタンプ（㉒-11 2回目に行ったとき）
-- ---------------------------------------------------------------------
create or replace function public.my_last_visit(p_shop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('stamp_character', v.stamp_character, 'visited_on', v.visited_on, 'n',
                            (select count(*) from public.shop_visits
                              where user_id = auth.uid() and shop_id = p_shop_id))
    from public.shop_visits v
   where v.user_id = auth.uid() and v.shop_id = p_shop_id
   order by v.visited_on desc
   limit 1
$$;
revoke all on function public.my_last_visit(uuid) from public, anon;
grant execute on function public.my_last_visit(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. ［＋ 足す］写真を足す（1枚＋1・1店に5枚・1日20枚）
-- ---------------------------------------------------------------------
create or replace function public.add_shop_photo(
  p_shop_id uuid, p_kind text, p_path text, p_card_path text, p_width int, p_height int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if least(p_width, p_height) < public.mogu_setting('photo_min_short_side')::int then
    raise exception 'photo_too_small';
  end if;
  if (select count(*) from public.shop_photos
       where shop_id = p_shop_id and user_id = v_user and status <> 'deleted')
     >= public.mogu_setting('limit_photos_per_shop')::int then
    raise exception 'photo_shop_limit';
  end if;
  if (select count(*) from public.shop_photos
       where user_id = v_user and created_at >= public.mogu_jst_day_start())
     >= public.mogu_setting('limit_photos_per_day')::int then
    raise exception 'photo_day_limit';
  end if;

  insert into public.shop_photos (shop_id, user_id, kind, path, card_path, width, height)
  values (p_shop_id, v_user, p_kind, p_path, p_card_path, p_width, p_height)
  returning id into v_id;

  perform public.mogu_add_coin(v_user, 'photo', public.mogu_setting('coin_photo')::int, p_shop_id, v_id);
  return v_id;
end;
$$;
revoke all on function public.add_shop_photo(uuid, text, text, text, int, int) from public, anon;
grant execute on function public.add_shop_photo(uuid, text, text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ［＋ 足す］空いている項目を書く（1項目＋1・名前が残る）
--    すでに書かれた情報は書き換えられない（㉒の決まり）
-- ---------------------------------------------------------------------
create or replace function public.add_shop_field(
  p_shop_id uuid, p_field_key text, p_value text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if p_value is null or btrim(p_value) = '' then raise exception 'value_required'; end if;
  if public.mogu_has_banned(p_value) then raise exception 'banned_word'; end if;
  if exists (select 1 from public.shop_fields where shop_id = p_shop_id and field_key = p_field_key) then
    raise exception 'already_filled';
  end if;

  insert into public.shop_fields (shop_id, field_key, value, filled_by)
  values (p_shop_id, p_field_key, btrim(p_value), v_user);

  perform public.mogu_add_coin(v_user, 'field', public.mogu_setting('coin_field')::int, p_shop_id);
end;
$$;
revoke all on function public.add_shop_field(uuid, text, text) from public, anon;
grant execute on function public.add_shop_field(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. ［＋ 足す］おすすめメニューを足す（1品＋2・3品まで）
-- ---------------------------------------------------------------------
create or replace function public.add_shop_menu_item(
  p_shop_id uuid, p_name text, p_price int default null,
  p_photo_id uuid default null, p_limited_until date default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'name_required'; end if;
  if public.mogu_has_banned(p_name) then raise exception 'banned_word'; end if;
  if (select count(*) from public.shop_menu_items where shop_id = p_shop_id and user_id = v_user)
     >= public.mogu_setting('limit_menu_per_shop')::int then
    raise exception 'menu_limit';
  end if;

  insert into public.shop_menu_items (shop_id, user_id, name, price, photo_id, limited_until)
  values (p_shop_id, v_user, btrim(p_name), p_price, p_photo_id, p_limited_until)
  returning id into v_id;

  perform public.mogu_add_coin(v_user, 'menu', public.mogu_setting('coin_menu')::int, p_shop_id, v_id);
  return v_id;
end;
$$;
revoke all on function public.add_shop_menu_item(uuid, text, int, uuid, date) from public, anon;
grant execute on function public.add_shop_menu_item(uuid, text, int, uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 7. ［＋ 足す］に出す「あと何枚・何品・何項目」と、空いている項目
-- ---------------------------------------------------------------------
create or replace function public.shop_add_room(p_shop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'photos_left', greatest(0, public.mogu_setting('limit_photos_per_shop')::int
      - (select count(*) from public.shop_photos
          where shop_id = p_shop_id and user_id = auth.uid() and status <> 'deleted')),
    'photos_day_left', greatest(0, public.mogu_setting('limit_photos_per_day')::int
      - (select count(*) from public.shop_photos
          where user_id = auth.uid() and created_at >= public.mogu_jst_day_start())),
    'menu_left', greatest(0, public.mogu_setting('limit_menu_per_shop')::int
      - (select count(*) from public.shop_menu_items where shop_id = p_shop_id and user_id = auth.uid())),
    'tags_left', greatest(0, public.mogu_setting('limit_tags_per_shop_user')::int
      - (select count(*) from public.shop_tags where shop_id = p_shop_id and created_by = auth.uid())),
    'open_fields', coalesce((
      select jsonb_agg(k order by k)
        from unnest(array['hours_0','hours_1','hours_2','hours_3','hours_4','hours_5','hours_6',
                          'last_order','reserve','payment','seats','seat_count','party','smoking',
                          'facility','address','phone','link','limited','note']) as k
       where not exists (select 1 from public.shop_fields f
                          where f.shop_id = p_shop_id and f.field_key = k)
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.shop_add_room(uuid) from public, anon;
grant execute on function public.shop_add_room(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. 2回目からの情報の確認（30日に1回・＋1）（㉒-12）
--    「違う」は㉓の修正依頼へ。ここでは答えだけ残す。
-- ---------------------------------------------------------------------
create or replace function public.confirm_shop_field(
  p_shop_id uuid, p_field_key text, p_answer text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if p_answer not in ('same', 'different') then raise exception 'answer_invalid'; end if;
  if exists (select 1 from public.shop_confirmations
              where shop_id = p_shop_id and user_id = v_user
                and created_at > now() - interval '30 days') then
    raise exception 'confirm_too_soon';
  end if;

  insert into public.shop_confirmations (shop_id, user_id, field_key, answer)
  values (p_shop_id, v_user, p_field_key, p_answer);

  if p_answer = 'same' then
    update public.shop_fields
       set last_confirmed_at = now(), confirm_count = coalesce(confirm_count, 0) + 1
     where shop_id = p_shop_id and field_key = p_field_key;
  end if;

  perform public.mogu_add_coin(v_user, 'confirm', public.mogu_setting('coin_confirm')::int, p_shop_id);
end;
$$;
revoke all on function public.confirm_shop_field(uuid, text, text) from public, anon;
grant execute on function public.confirm_shop_field(uuid, text, text) to authenticated;

-- 確認に出す項目を1つえらぶ（いちばん長く確かめられていないもの）
create or replace function public.shop_field_to_confirm(p_shop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('field_key', f.field_key, 'value', f.value)
    from public.shop_fields f
   where f.shop_id = p_shop_id
     and not exists (select 1 from public.shop_confirmations c
                      where c.shop_id = p_shop_id and c.user_id = auth.uid()
                        and c.created_at > now() - interval '30 days')
   order by coalesce(f.last_confirmed_at, f.filled_at) asc
   limit 1
$$;
revoke all on function public.shop_field_to_confirm(uuid) from public, anon;
grant execute on function public.shop_field_to_confirm(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. ㉒-19 ［＋ 足す］からハッシュタグを付ける
--    あるタグは＋1、ないものは足す。新しいタグ＋1は mogu_tag_for_register の決まりのまま。
-- ---------------------------------------------------------------------
create or replace function public.add_shop_tags(p_shop_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_mine int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status <> 'deleted') then
    raise exception 'shop_not_found';
  end if;

  select count(*) into v_mine from public.shop_tags
   where shop_id = p_shop_id and created_by = v_user;
  if v_mine + coalesce(array_length(p_tag_ids, 1), 0)
     > public.mogu_setting('limit_tags_per_shop_user')::int then
    raise exception 'tag_limit';
  end if;

  foreach v_id in array coalesce(p_tag_ids, '{}') loop
    select name into v_name from public.tags where id = v_id and status = 'open';
    if v_name is null then continue; end if;
    if exists (select 1 from public.shop_tags where shop_id = p_shop_id and tag_id = v_id) then
      -- もうあるタグは＋1（自分がまだ押していなければ）
      perform public.toggle_tag_vote(p_shop_id, v_id);
    else
      perform public.mogu_tag_for_register(v_user, v_name, p_shop_id);
    end if;
  end loop;
end;
$$;
revoke all on function public.add_shop_tags(uuid, uuid[]) from public, anon;
grant execute on function public.add_shop_tags(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- 10. ㉔-4 人気のタグ（お店に付いている数の多い順）
-- ---------------------------------------------------------------------
create or replace function public.popular_tags(p_limit int default 8)
returns table (id uuid, name text, shop_count int)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.shop_count
    from public.tags t
   where t.status = 'open' and t.shop_count > 0
   order by t.shop_count desc, t.name
   limit greatest(1, least(coalesce(p_limit, 8), 30))
$$;
revoke all on function public.popular_tags(int) from public, anon;
grant execute on function public.popular_tags(int) to authenticated;
