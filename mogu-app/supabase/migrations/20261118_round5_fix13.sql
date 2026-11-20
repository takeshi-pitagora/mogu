-- =====================================================================
-- 第5回 fix13：dig（もらったいいねで上がる。引き渡し書 §6-4）
--   ・dig n に必要な累計 = 5 × n × (n − 1)（dig1 から。上限なし）
--   ・数えるもの：見つけたお店が保存された（1人1店で1）／自分の写真への＋1／
--     自分が付けたタグへの＋1。本人・登録から7日未満のアカウントは数えない
--   ・上がったときは、次にアプリを開いたときに1回だけ全画面（㉖-17〜20）
--   fix12 のあとに実行する
-- =====================================================================

-- 上がったことを1回だけ見せるための印
alter table public.user_coin_totals add column if not exists dig_shown int not null default 1;

-- ---------------------------------------------------------------------
-- 1. いいねの数から dig を出す。5n(n−1) <= likes をみたす、いちばん大きい n
-- ---------------------------------------------------------------------
create or replace function public.mogu_dig_for(p_likes int)
returns int
language sql
immutable
as $$
  select greatest(1, floor((1 + sqrt(1 + 4 * greatest(p_likes, 0)::numeric / 5)) / 2)::int)
$$;

-- dig n に届くのに必要な、もらったいいねの累計
create or replace function public.mogu_dig_at(p_dig int)
returns int
language sql
immutable
as $$
  select (5 * greatest(p_dig, 1) * (greatest(p_dig, 1) - 1))::int
$$;

-- ---------------------------------------------------------------------
-- 2. いいねを足し引きして、dig を数えなおす
--    いいねをあげた人が、本人・登録から7日未満なら数えない
-- ---------------------------------------------------------------------
create or replace function public.mogu_bump_likes(p_owner uuid, p_voter uuid, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_likes int;
  v_old int;
  v_new int;
begin
  if p_owner is null or p_delta = 0 then return; end if;
  if p_voter is not null and p_voter = p_owner then return; end if;        -- 本人のいいねは数えない
  if p_voter is not null and exists (
       select 1 from auth.users u where u.id = p_voter and u.created_at > now() - interval '7 days'
     ) then
    return;                                                                -- 登録から7日未満は数えない
  end if;

  insert into public.user_coin_totals (user_id, likes_received)
  values (p_owner, greatest(p_delta, 0))
  on conflict (user_id) do update
    set likes_received = greatest(0, public.user_coin_totals.likes_received + p_delta),
        updated_at = now()
  returning likes_received, dig into v_likes, v_old;

  v_new := public.mogu_dig_for(v_likes);
  if v_new <> v_old then
    update public.user_coin_totals set dig = v_new, updated_at = now() where user_id = p_owner;
    -- 上がったときだけ、お知らせにも出す（㉗-22 から探検手帳へ）
    if v_new > v_old then
      insert into public.notifications (user_id, type, payload)
      values (p_owner, 'dig_up', jsonb_build_object('from', v_old, 'to', v_new));
    end if;
  end if;
end;
$$;
revoke all on function public.mogu_bump_likes(uuid, uuid, int) from public, anon;

-- ---------------------------------------------------------------------
-- 3. 保存されたら、そのお店を見つけた人のいいねを1つ増やす（1人1店で1）
--    グループの♡（group_hearts）は数えない
-- ---------------------------------------------------------------------
create or replace function public.toggle_save_shop(p_shop_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_saved boolean;
  v_owner uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select discoverer_id into v_owner from public.shops where id = p_shop_id;

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

  perform public.mogu_bump_likes(v_owner, v_user, case when v_saved then 1 else -1 end);
  return v_saved;
end;
$$;
revoke all on function public.toggle_save_shop(uuid) from public, anon;
grant execute on function public.toggle_save_shop(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. 写真の＋1・タグの＋1も、同じ数えかたに寄せる
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
  v_on boolean;
  v_n int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  select user_id into v_owner from public.shop_photos where id = p_photo_id and status = 'open';
  if v_owner is null then raise exception 'photo_not_found'; end if;

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

  perform public.mogu_bump_likes(v_owner, v_user, case when v_on then 1 else -1 end);
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
  v_owner uuid;
  v_on boolean;
  v_n int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if not exists (select 1 from public.shop_tags where shop_id = p_shop_id and tag_id = p_tag_id) then
    raise exception 'tag_not_on_shop';
  end if;
  select created_by into v_owner from public.shop_tags where shop_id = p_shop_id and tag_id = p_tag_id;

  if exists (select 1 from public.tag_votes where shop_id = p_shop_id and tag_id = p_tag_id and user_id = v_user) then
    delete from public.tag_votes where shop_id = p_shop_id and tag_id = p_tag_id and user_id = v_user;
    v_on := false;
  else
    insert into public.tag_votes (shop_id, tag_id, user_id) values (p_shop_id, p_tag_id, v_user)
      on conflict do nothing;
    v_on := true;
  end if;

  select count(*) into v_n from public.tag_votes where shop_id = p_shop_id and tag_id = p_tag_id;
  perform public.mogu_bump_likes(v_owner, v_user, case when v_on then 1 else -1 end);
  return v_n;
end;
$$;
revoke all on function public.toggle_tag_vote(uuid, uuid) from public, anon;
grant execute on function public.toggle_tag_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. 自分の dig（③-1 の写真の右下・㉖の表紙）
-- ---------------------------------------------------------------------
create or replace function public.my_dig()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'dig', coalesce(t.dig, 1),
    'likes', coalesce(t.likes_received, 0),
    'at', public.mogu_dig_at(coalesce(t.dig, 1)),
    'next_at', public.mogu_dig_at(coalesce(t.dig, 1) + 1),
    -- 上がったのをまだ見せていないとき（㉖-17〜20 を1回だけ出す）
    'pending_from', case when coalesce(t.dig, 1) > coalesce(t.dig_shown, 1) then coalesce(t.dig_shown, 1) end
  )
  from (select 1) z
  left join public.user_coin_totals t on t.user_id = auth.uid()
$$;
revoke all on function public.my_dig() from public, anon;
grant execute on function public.my_dig() to authenticated;

-- 全画面を出したあと（もう出さない）
create or replace function public.mark_dig_shown()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_coin_totals set dig_shown = dig, updated_at = now() where user_id = auth.uid()
$$;
revoke all on function public.mark_dig_shown() from public, anon;
grant execute on function public.mark_dig_shown() to authenticated;

-- ほかの人の dig と「見つけたお店」（㉖-15・16／③-11。コインは出さない）
create or replace function public.user_dig(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'dig', coalesce((select dig from public.user_coin_totals where user_id = p_user), 1),
    'found', (select count(*) from public.shops where discoverer_id = p_user and status = 'open')
  )
$$;
revoke all on function public.user_dig(uuid) from public, anon;
grant execute on function public.user_dig(uuid) to authenticated;
