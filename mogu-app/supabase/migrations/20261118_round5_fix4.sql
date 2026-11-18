-- =====================================================================
-- 第5回 手順4（㉑ お店のプロフィール）で使うもの
--   ・お店を保存する表（今の saved_restaurants は古い restaurants 用なので別に作る）
--   ・プロフィールの中身をまとめて読む関数
--   ・写真の＋1、タグの＋1
--   ・⑳（登録が終わったとき）に出す、見つけたお店の手帳とコイン
--   20261118_round5_fix3.sql のあとに、1回だけ実行してください
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. お店を保存する（㉑の下の［保存］・「128人が保存」）
-- ---------------------------------------------------------------------
create table if not exists public.saved_shops (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);
create index if not exists saved_shops_shop_idx on public.saved_shops (shop_id);
alter table public.saved_shops enable row level security;
drop policy if exists saved_shops_own on public.saved_shops;
create policy saved_shops_own on public.saved_shops for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.toggle_save_shop(p_shop_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_saved boolean;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.saved_shops where user_id = v_user and shop_id = p_shop_id) then
    delete from public.saved_shops where user_id = v_user and shop_id = p_shop_id;
    v_saved := false;
  else
    insert into public.saved_shops (user_id, shop_id) values (v_user, p_shop_id)
      on conflict do nothing;
    v_saved := true;
  end if;
  update public.shops s
     set saved_count = (select count(*) from public.saved_shops x where x.shop_id = s.id)
   where s.id = p_shop_id;
  return v_saved;
end;
$$;
revoke all on function public.toggle_save_shop(uuid) from public, anon;
grant execute on function public.toggle_save_shop(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. 写真の＋1（㉑-5・6）
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

  update public.shop_photos p
     set plus_count = (select count(*) from public.photo_votes v where v.photo_id = p.id)
   where p.id = p_photo_id;

  -- ＋1はコインにはならない（§6-2の表にない）。もらった数だけ数える（③・㉖で使う）
  if v_owner is not null and v_owner <> v_user then
    insert into public.user_coin_totals (user_id, likes_received)
    values (v_owner, case when v_on then 1 else 0 end)
    on conflict (user_id) do update
      set likes_received = greatest(0, public.user_coin_totals.likes_received + case when v_on then 1 else -1 end),
          updated_at = now();
  end if;

  return (select plus_count from public.shop_photos where id = p_photo_id);
end;
$$;
revoke all on function public.toggle_photo_vote(uuid) from public, anon;
grant execute on function public.toggle_photo_vote(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. タグの＋1（㉑-4。タグの右の数を押す）
-- ---------------------------------------------------------------------
create or replace function public.toggle_tag_vote(p_shop_id uuid, p_tag_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_on boolean;
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

  update public.shop_tags t
     set plus_count = (select count(*) from public.tag_votes v
                        where v.shop_id = t.shop_id and v.tag_id = t.tag_id)
   where t.shop_id = p_shop_id and t.tag_id = p_tag_id;

  return (select plus_count from public.shop_tags where shop_id = p_shop_id and tag_id = p_tag_id);
end;
$$;
revoke all on function public.toggle_tag_vote(uuid, uuid) from public, anon;
grant execute on function public.toggle_tag_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. お店のプロフィールをまとめて読む（㉑）
--   1回の読み込みで、タブ5つぶんの中身を全部返す
-- ---------------------------------------------------------------------
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

    'discoverer', (
      select jsonb_build_object(
        'name', p.display_name, 'handle', p.handle, 'avatar_path', p.avatar_path,
        'dig', coalesce(t.dig, 1),
        'found_at', v_shop.created_at,
        'reason', (select h.reason from public.shop_highlights h
                    where h.shop_id = p_shop_id and h.user_id = v_shop.discoverer_id))
        from public.profiles p
        left join public.user_coin_totals t on t.user_id = p.id
       where p.id = v_shop.discoverer_id
    ),

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


-- ---------------------------------------------------------------------
-- 5. 登録が終わったときに出すもの（⑳-1〜4）
--   「あなたが見つけたお店」の手帳と、モグコインの数
-- ---------------------------------------------------------------------
create or replace function public.my_register_result(p_shop_id uuid, p_limit int default 3)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  mine as (
    select s.id, s.name, s.created_at,
           row_number() over (order by s.created_at) as no,
           coalesce((select sum(c.amount) from public.coin_ledger c
                      where c.shop_id = s.id and c.user_id = s.discoverer_id
                        and c.state <> 'cancelled'), 0) as gained,
           exists (select 1 from public.coin_ledger c
                    where c.shop_id = s.id and c.user_id = s.discoverer_id
                      and c.state = 'pending') as pending
      from public.shops s, me
     where s.discoverer_id = me.uid and s.status <> 'deleted'
  )
  select jsonb_build_object(
    'coins', jsonb_build_object(
      'total', coalesce((select t.confirmed_total from public.user_coin_totals t, me where t.user_id = me.uid), 0),
      'pending', coalesce((select t.pending_total from public.user_coin_totals t, me where t.user_id = me.uid), 0),
      'gained', coalesce((select m.gained from mine m where m.id = p_shop_id), 0),
      'full_register', exists (select 1 from public.coin_ledger c, me
                                where c.shop_id = p_shop_id and c.user_id = me.uid
                                  and c.action = 'full_register' and c.state <> 'cancelled')
    ),
    'found', coalesce((
      select jsonb_agg(jsonb_build_object(
               'no', m.no, 'name', m.name, 'created_at', m.created_at,
               'gained', m.gained, 'pending', m.pending) order by m.created_at desc)
        from (select * from mine order by created_at desc limit greatest(1, least(p_limit, 10))) m
    ), '[]'::jsonb),
    'shop_count', (select count(*) from mine),
    'first_ever', (select count(*) from mine) = 1,
    'new_account', (select count(*) from mine) <= 3
  )
$$;

revoke all on function public.my_register_result(uuid, int) from public, anon;
grant execute on function public.my_register_result(uuid, int) to authenticated;

-- =====================================================================
-- 確認（実行すると5行出ます。5つとも「あっています」が正解）
-- =====================================================================
select 'お店を保存する表' as "確認",
       case when to_regclass('public.saved_shops') is not null
            then 'あっています' else 'ちがいます' end as "結果"
union all
select 'プロフィールを読む関数',
       case when to_regprocedure('public.get_shop_profile(uuid)') is not null
            then 'あっています' else 'ちがいます' end
union all
select '写真の＋1',
       case when to_regprocedure('public.toggle_photo_vote(uuid)') is not null
            then 'あっています' else 'ちがいます' end
union all
select 'タグの＋1と保存',
       case when to_regprocedure('public.toggle_tag_vote(uuid,uuid)') is not null
             and to_regprocedure('public.toggle_save_shop(uuid)') is not null
            then 'あっています' else 'ちがいます' end
union all
select '登録が終わったときの関数',
       case when to_regprocedure('public.my_register_result(uuid,int)') is not null
            then 'あっています' else 'ちがいます' end;
