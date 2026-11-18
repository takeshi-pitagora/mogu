-- =====================================================================
-- 第5回 退会したときの決まり（§9-1 の4）
--   お店は残し、見つけた人は「退会したユーザー」
--   写真とひとことは消す（表紙が消えたら、次に＋1の多い写真が表紙）
--   予算感・イチ押し・タグの＋1は、人にたどれない数だけ残す
--   20261118_round5_fix8.sql のあとに、1回だけ実行してください
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 予算感とイチ押しを「人にたどれない数」として残せるようにする
--    user_id を空にできる形に直す（退会したら空になる）
-- ---------------------------------------------------------------------
alter table public.shop_highlights add column if not exists id uuid default gen_random_uuid();
update public.shop_highlights set id = gen_random_uuid() where id is null;
alter table public.shop_highlights alter column id set not null;
alter table public.shop_highlights drop constraint if exists shop_highlights_pkey;
alter table public.shop_highlights add primary key (id);
alter table public.shop_highlights alter column user_id drop not null;
alter table public.shop_highlights drop constraint if exists shop_highlights_user_id_fkey;
alter table public.shop_highlights add constraint shop_highlights_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
create unique index if not exists shop_highlights_one_per_user
  on public.shop_highlights (shop_id, user_id) where user_id is not null;

alter table public.budget_votes add column if not exists id uuid default gen_random_uuid();
update public.budget_votes set id = gen_random_uuid() where id is null;
alter table public.budget_votes alter column id set not null;
alter table public.budget_votes drop constraint if exists budget_votes_pkey;
alter table public.budget_votes add primary key (id);
alter table public.budget_votes alter column user_id drop not null;
alter table public.budget_votes drop constraint if exists budget_votes_user_id_fkey;
alter table public.budget_votes add constraint budget_votes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
create unique index if not exists budget_votes_one_per_user
  on public.budget_votes (shop_id, user_id, time_of_day) where user_id is not null;

-- ---------------------------------------------------------------------
-- 2. ＋1の数は、数えなおさずに1つずつ足し引きする
--    （退会した人が押した＋1も、数として残るようにするため）
-- ---------------------------------------------------------------------
create or replace function public.toggle_photo_vote(p_photo_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_shop uuid;
  v_on boolean;
  v_n int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  select user_id, shop_id into v_owner, v_shop from public.shop_photos
   where id = p_photo_id and status = 'open';
  if v_shop is null then raise exception 'photo_not_found'; end if;

  if exists (select 1 from public.photo_votes where photo_id = p_photo_id and user_id = v_user) then
    delete from public.photo_votes where photo_id = p_photo_id and user_id = v_user;
    v_on := false;
  else
    insert into public.photo_votes (photo_id, user_id) values (p_photo_id, v_user)
      on conflict do nothing;
    v_on := true;
  end if;

  update public.shop_photos
     set plus_count = greatest(0, plus_count + case when v_on then 1 else -1 end)
   where id = p_photo_id
  returning plus_count into v_n;

  if v_owner is not null and v_owner <> v_user then
    insert into public.user_coin_totals (user_id, likes_received)
    values (v_owner, case when v_on then 1 else 0 end)
    on conflict (user_id) do update
      set likes_received = greatest(0, public.user_coin_totals.likes_received + case when v_on then 1 else -1 end),
          updated_at = now();
  end if;

  return v_n;
end;
$$;
revoke all on function public.toggle_photo_vote(uuid) from public, anon;
grant execute on function public.toggle_photo_vote(uuid) to authenticated;

create or replace function public.toggle_tag_vote(p_shop_id uuid, p_tag_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_on boolean;
  v_n int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if not exists (select 1 from public.shop_tags where shop_id = p_shop_id and tag_id = p_tag_id) then
    raise exception 'tag_not_on_shop';
  end if;

  if exists (select 1 from public.tag_votes where shop_id = p_shop_id and tag_id = p_tag_id and user_id = v_user) then
    delete from public.tag_votes where shop_id = p_shop_id and tag_id = p_tag_id and user_id = v_user;
    v_on := false;
  else
    insert into public.tag_votes (shop_id, tag_id, user_id) values (p_shop_id, p_tag_id, v_user)
      on conflict do nothing;
    v_on := true;
  end if;

  update public.shop_tags
     set plus_count = greatest(0, plus_count + case when v_on then 1 else -1 end)
   where shop_id = p_shop_id and tag_id = p_tag_id
  returning plus_count into v_n;

  return v_n;
end;
$$;
revoke all on function public.toggle_tag_vote(uuid, uuid) from public, anon;
grant execute on function public.toggle_tag_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. 退会するときの後始末（⑤の退会から、auth のユーザーを消す前に呼ぶ）
--    お店は残す。写真とひとことは消す。＋1・予算感・イチ押しは数だけ残す
-- ---------------------------------------------------------------------
create or replace function public.mogu_on_user_deleted(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- 写真を消す（表紙だったら、次に＋1の多い写真を表紙にする）
  for r in select distinct shop_id from public.shop_photos where user_id = p_user_id loop
    delete from public.shop_photos where shop_id = r.shop_id and user_id = p_user_id;
    update public.shops s
       set cover_photo_id = (select ph.id from public.shop_photos ph
                              where ph.shop_id = s.id and ph.status = 'open'
                              order by ph.plus_count desc, ph.created_at limit 1)
     where s.id = r.shop_id
       and (s.cover_photo_id is null
            or not exists (select 1 from public.shop_photos ph
                            where ph.id = s.cover_photo_id and ph.status = 'open'));
  end loop;

  -- ひとことを消す
  delete from public.shop_comments where user_id = p_user_id;

  -- おすすめメニューは、書いた人が分からない形で残す（お店の情報のため）
  update public.shop_menu_items set user_id = null where user_id = p_user_id;

  -- ＋1・予算感・イチ押しは、数だけ残す（人にたどれないように user_id を空に）
  update public.shop_highlights set user_id = null where user_id = p_user_id;
  update public.budget_votes set user_id = null where user_id = p_user_id;
  delete from public.photo_votes where user_id = p_user_id;  -- 数は shop_photos.plus_count に残る
  delete from public.tag_votes where user_id = p_user_id;    -- 数は shop_tags.plus_count に残る

  -- 下書き・保存・自分のタグ・通知の設定は消す（auth の削除でも消えるが、先に消しておく）
  delete from public.shop_drafts where user_id = p_user_id;
  delete from public.saved_shops where user_id = p_user_id;
  delete from public.user_tags where user_id = p_user_id;
end;
$$;
revoke all on function public.mogu_on_user_deleted(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. 退会した人が見つけたお店は「退会したユーザー」と出す
--    （見つけた人が空のときも、㉑に「見つけた人」の行を出す）
-- ---------------------------------------------------------------------
create or replace function public.shop_discoverer(p_shop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.discoverer_id is null then jsonb_build_object(
      'name', null, 'handle', null, 'avatar_path', null, 'dig', null,
      'found_at', s.created_at, 'reason', null, 'withdrawn', true)
    else (select jsonb_build_object(
      'name', p.display_name, 'handle', p.handle, 'avatar_path', p.avatar_path,
      'dig', coalesce(t.dig, 1), 'found_at', s.created_at, 'withdrawn', false,
      'reason', (select h.reason from public.shop_highlights h
                  where h.shop_id = s.id and h.user_id = s.discoverer_id))
      from public.profiles p
      left join public.user_coin_totals t on t.user_id = p.id
     where p.id = s.discoverer_id)
    end
    from public.shops s where s.id = p_shop_id
$$;
revoke all on function public.shop_discoverer(uuid) from public, anon;
grant execute on function public.shop_discoverer(uuid) to authenticated;


-- get_shop_profile も「退会したユーザー」に合わせて作り直す（ほかは fix4 と同じ）
create or replace function public.get_shop_profile(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_shop public.shops%rowtype;
  v_out jsonb;
  v_high_total int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into v_shop from public.shops where id = p_shop_id and status <> 'deleted';
  if v_shop.id is null then return null; end if;

  -- 閉店したお店は、保存していた人だけが開ける（㉑-17）
  if v_shop.status = 'closed'
     and not exists (select 1 from public.saved_shops where user_id = v_user and shop_id = p_shop_id)
     and v_shop.discoverer_id is distinct from v_user then
    return jsonb_build_object('closed_hidden', true);
  end if;

  select count(*) into v_high_total from public.shop_highlights where shop_id = p_shop_id;

  v_out := jsonb_build_object(
    'shop', jsonb_build_object(
      'id', v_shop.id,
      'name', v_shop.name,
      'genre_main', v_shop.genre_main,
      'genre_sub', v_shop.genre_sub,
      'status', v_shop.status,
      'saved_count', v_shop.saved_count,
      'created_at', v_shop.created_at,
      'editable_until', v_shop.editable_until,
      'walk_min', v_shop.walk_min,
      'station_name', (select name from public.stations where id = v_shop.station_id),
      'station_ward', (select ward from public.stations where id = v_shop.station_id),
      'is_mine', v_shop.discoverer_id is not distinct from v_user,
      'is_saved', exists (select 1 from public.saved_shops where user_id = v_user and shop_id = p_shop_id)
    ),

    'discoverer', public.shop_discoverer(p_shop_id),

    -- みんなのイチ押し（割合と行った人数）
    'highlights', coalesce((
      select jsonb_agg(jsonb_build_object('key', s.k, 'count', s.n,
                         'percent', round(s.n * 100.0 / greatest(1, v_high_total)))
                       order by s.n desc, s.k)
        from (select k, count(*) as n
                from public.shop_highlights h, unnest(h.highlight_keys) as k
               where h.shop_id = p_shop_id
               group by k) s
    ), '[]'::jsonb),
    'highlight_people', v_high_total,

    -- タグ（みんなのタグ・知っておきたいこと・お店の情報）
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'kind', t.kind,
               'count', st.plus_count,
               'voted', exists (select 1 from public.tag_votes v
                                 where v.shop_id = p_shop_id and v.tag_id = t.id and v.user_id = v_user))
               order by st.plus_count desc, t.name)
        from public.shop_tags st join public.tags t on t.id = st.tag_id
       where st.shop_id = p_shop_id and t.status = 'open'
    ), '[]'::jsonb),

    -- 予算感（男女別の、いちばん多い金額）
    'budget', coalesce((
      select jsonb_agg(jsonb_build_object(
               'time_of_day', b.time_of_day, 'gender', b.gender_at_vote,
               'bucket', b.bucket, 'count', b.n) order by b.n desc)
        from (select time_of_day, gender_at_vote, bucket, count(*) as n
                from public.budget_votes where shop_id = p_shop_id
               group by time_of_day, gender_at_vote, bucket) b
    ), '[]'::jsonb),
    'my_budget', coalesce((
      select jsonb_object_agg(time_of_day, bucket)
        from public.budget_votes where shop_id = p_shop_id and user_id = v_user
    ), '{}'::jsonb),

    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ph.id, 'kind', ph.kind, 'path', ph.path, 'card_path', ph.card_path,
               'width', ph.width, 'height', ph.height, 'plus_count', ph.plus_count,
               'is_cover', ph.id = v_shop.cover_photo_id,
               'voted', exists (select 1 from public.photo_votes v where v.photo_id = ph.id and v.user_id = v_user),
               'user_name', pr.display_name, 'user_avatar', pr.avatar_path)
               order by (ph.id = v_shop.cover_photo_id) desc, ph.created_at)
        from public.shop_photos ph left join public.profiles pr on pr.id = ph.user_id
       where ph.shop_id = p_shop_id and ph.status = 'open'
    ), '[]'::jsonb),

    'menu', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'name', m.name, 'price', m.price, 'limited_until', m.limited_until,
               'photo_path', (select card_path from public.shop_photos where id = m.photo_id),
               'user_name', pr.display_name)
               order by (m.limited_until is not null), m.created_at)
        from public.shop_menu_items m left join public.profiles pr on pr.id = m.user_id
       where m.shop_id = p_shop_id
    ), '[]'::jsonb),

    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', f.field_key, 'value', f.value,
               'filled_by', pr.display_name,
               'last_confirmed_at', coalesce(f.last_confirmed_at, f.filled_at),
               'confirm_count', f.confirm_count) order by f.field_key)
        from public.shop_fields f left join public.profiles pr on pr.id = f.filled_by
       where f.shop_id = p_shop_id
    ), '[]'::jsonb),

    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'body', t.body, 'created_at', t.created_at,
               'user_name', t.user_name, 'user_avatar', t.user_avatar)
               order by t.created_at desc)
        from (select sc.id, sc.body, sc.created_at,
                     pr.display_name as user_name, pr.avatar_path as user_avatar
                from public.shop_comments sc left join public.profiles pr on pr.id = sc.user_id
               where sc.shop_id = p_shop_id and sc.status = 'open'
               order by sc.created_at desc limit 30) t
    ), '[]'::jsonb),
    'comment_count', (select count(*) from public.shop_comments
                       where shop_id = p_shop_id and status = 'open')
  );

  return v_out;
end;
$$;
revoke all on function public.get_shop_profile(uuid) from public, anon;
grant execute on function public.get_shop_profile(uuid) to authenticated;

-- =====================================================================
-- 確認（実行すると4行出ます。4つとも「あっています」が正解）
-- =====================================================================
select '予算感とイチ押しが数として残せる' as "確認",
       case when (select is_nullable from information_schema.columns
                   where table_schema = 'public' and table_name = 'budget_votes' and column_name = 'user_id') = 'YES'
             and (select is_nullable from information_schema.columns
                   where table_schema = 'public' and table_name = 'shop_highlights' and column_name = 'user_id') = 'YES'
            then 'あっています' else 'ちがいます' end as "結果"
union all
select '＋1は足し引きで数える',
       case when pg_get_functiondef('public.toggle_photo_vote(uuid)'::regprocedure) like '%plus_count + case%'
            then 'あっています' else 'ちがいます' end
union all
select '退会の後始末の関数',
       case when to_regprocedure('public.mogu_on_user_deleted(uuid)') is not null
            then 'あっています' else 'ちがいます' end
union all
select '「退会したユーザー」の出し方',
       case when pg_get_functiondef('public.get_shop_profile(uuid)'::regprocedure) like '%shop_discoverer%'
            then 'あっています' else 'ちがいます' end;
